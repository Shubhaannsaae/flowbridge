// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IMetaMaskCard.sol";
import "../libraries/SafeMath.sol";

/**
 * @title LiquidityManager
 * @dev Manages liquidity for MetaMask Card spending and instant settlements
 * Ensures sufficient liquidity for card transactions while maximizing yield
 */
contract LiquidityManager is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20;
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant CARD_ROLE = keccak256("CARD_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // Liquidity pool configuration
    struct LiquidityPool {
        address token;
        uint256 totalLiquidity;
        uint256 availableLiquidity;
        uint256 reservedLiquidity;
        uint256 emergencyReserve;
        uint256 minReserveRatio; // Basis points
        uint256 maxUtilization; // Basis points
        bool isActive;
    }

    // User liquidity position
    struct UserLiquidity {
        uint256 totalDeposited;
        uint256 availableBalance;
        uint256 lockedBalance;
        uint256 cardBalance;
        uint256 lastUpdate;
        bool isCardLinked;
    }

    // Liquidity request for card transactions
    struct LiquidityRequest {
        address user;
        address token;
        uint256 amount;
        uint256 deadline;
        bytes32 requestId;
        bool isInstant;
    }

    // State variables
    mapping(address => LiquidityPool) public liquidityPools; // token -> pool
    mapping(address => mapping(address => UserLiquidity)) public userLiquidity; // user -> token -> liquidity
    mapping(bytes32 => LiquidityRequest) public liquidityRequests; // requestId -> request
    mapping(address => address[]) public supportedTokens; // user -> tokens
    
    // Global liquidity parameters
    uint256 public instantSettlementThreshold; // Max amount for instant settlement
    uint256 public liquidityBufferRatio; // Buffer ratio in basis points
    uint256 public rebalanceThreshold; // Threshold for rebalancing
    uint256 public emergencyThreshold; // Emergency reserve threshold

    // Card interface
    address public cardInterface;
    address public vaultContract;

    // Events
    event LiquidityDeposited(address indexed user, address indexed token, uint256 amount);
    event LiquidityWithdrawn(address indexed user, address indexed token, uint256 amount);
    event CardTransactionProcessed(address indexed user, address indexed token, uint256 amount, bytes32 requestId);
    event LiquidityRebalanced(address indexed token, uint256 newAvailable, uint256 newReserved);
    event EmergencyWithdrawal(address indexed token, uint256 amount);
    event PoolUpdated(address indexed token, LiquidityPool pool);

    /**
     * @dev Initializes the liquidity manager
     * @param _admin Admin address
     * @param _cardInterface MetaMask Card interface
     * @param _vaultContract Vault contract address
     */
    function initialize(
        address _admin,
        address _cardInterface,
        address _vaultContract
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);

        cardInterface = _cardInterface;
        vaultContract = _vaultContract;
        
        // Set default parameters
        instantSettlementThreshold = 1000 * 1e6; // $1000 USDC
        liquidityBufferRatio = 1000; // 10%
        rebalanceThreshold = 500; // 5%
        emergencyThreshold = 500; // 5%
    }

    /**
     * @dev Deposits liquidity for card usage
     * @param token Token address
     * @param amount Amount to deposit
     */
    function depositLiquidity(address token, uint256 amount) 
        external 
        nonReentrant 
    {
        require(amount > 0, "Amount must be greater than 0");
        require(liquidityPools[token].isActive, "Token not supported");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Update user liquidity
        UserLiquidity storage userLiq = userLiquidity[msg.sender][token];
        userLiq.totalDeposited = userLiq.totalDeposited.add(amount);
        userLiq.availableBalance = userLiq.availableBalance.add(amount);
        userLiq.lastUpdate = block.timestamp;

        // Update pool liquidity
        LiquidityPool storage pool = liquidityPools[token];
        pool.totalLiquidity = pool.totalLiquidity.add(amount);
        pool.availableLiquidity = pool.availableLiquidity.add(amount);

        // Add to supported tokens if first deposit
        if (userLiq.totalDeposited == amount) {
            supportedTokens[msg.sender].push(token);
        }

        emit LiquidityDeposited(msg.sender, token, amount);
    }

    /**
     * @dev Withdraws available liquidity
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function withdrawLiquidity(address token, uint256 amount) 
        external 
        nonReentrant 
    {
        UserLiquidity storage userLiq = userLiquidity[msg.sender][token];
        require(userLiq.availableBalance >= amount, "Insufficient available balance");

        // Check pool utilization limits
        LiquidityPool storage pool = liquidityPools[token];
        uint256 newAvailable = pool.availableLiquidity.sub(amount);
        uint256 utilizationRate = pool.totalLiquidity > 0 
            ? (pool.totalLiquidity.sub(newAvailable)).mul(10000).div(pool.totalLiquidity)
            : 0;
        
        require(utilizationRate <= pool.maxUtilization, "Withdrawal would exceed utilization limit");

        // Update user liquidity
        userLiq.availableBalance = userLiq.availableBalance.sub(amount);
        userLiq.totalDeposited = userLiq.totalDeposited.sub(amount);
        userLiq.lastUpdate = block.timestamp;

        // Update pool liquidity
        pool.totalLiquidity = pool.totalLiquidity.sub(amount);
        pool.availableLiquidity = newAvailable;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(msg.sender, token, amount);
    }

    /**
     * @dev Processes card transaction request
     * @param request Liquidity request details
     * @return success True if transaction processed successfully
     */
    function processCardTransaction(LiquidityRequest calldata request) 
        external 
        onlyRole(CARD_ROLE) 
        nonReentrant 
        returns (bool success) 
    {
        require(request.deadline > block.timestamp, "Request expired");
        require(request.amount > 0, "Invalid amount");

        UserLiquidity storage userLiq = userLiquidity[request.user][request.token];
        require(userLiq.isCardLinked, "Card not linked");

        // Check if user has sufficient card balance
        if (userLiq.cardBalance >= request.amount) {
            // Direct spend from card balance
            userLiq.cardBalance = userLiq.cardBalance.sub(request.amount);
            liquidityRequests[request.requestId] = request;
            
            emit CardTransactionProcessed(request.user, request.token, request.amount, request.requestId);
            return true;
        }

        // Check for instant settlement
        if (request.isInstant && request.amount <= instantSettlementThreshold) {
            return _processInstantSettlement(request);
        }

        // Process through vault if available balance insufficient
        return _processVaultSettlement(request);
    }

    /**
     * @dev Links user card to liquidity management
     * @param user User address
     */
    function linkCard(address user) external onlyRole(CARD_ROLE) {
        userLiquidity[user][address(0)].isCardLinked = true;
        
        // Link all user's token liquidity
        address[] storage tokens = supportedTokens[user];
        for (uint256 i = 0; i < tokens.length; i++) {
            userLiquidity[user][tokens[i]].isCardLinked = true;
        }
    }

    /**
     * @dev Tops up user's card balance
     * @param user User address
     * @param token Token address
     * @param amount Amount to top up
     */
    function topUpCard(address user, address token, uint256 amount) 
        external 
        onlyRole(VAULT_ROLE) 
        nonReentrant 
    {
        UserLiquidity storage userLiq = userLiquidity[user][token];
        require(userLiq.availableBalance >= amount, "Insufficient available balance");

        // Transfer from available to card balance
        userLiq.availableBalance = userLiq.availableBalance.sub(amount);
        userLiq.cardBalance = userLiq.cardBalance.add(amount);
        userLiq.lastUpdate = block.timestamp;

        // Update pool reserved liquidity
        LiquidityPool storage pool = liquidityPools[token];
        pool.availableLiquidity = pool.availableLiquidity.sub(amount);
        pool.reservedLiquidity = pool.reservedLiquidity.add(amount);
    }

    /**
     * @dev Rebalances liquidity pools to maintain optimal ratios
     * @param token Token address
     */
    function rebalanceLiquidity(address token) 
        external 
        onlyRole(MANAGER_ROLE) 
    {
        LiquidityPool storage pool = liquidityPools[token];
        require(pool.isActive, "Pool not active");

        uint256 totalLiquidity = pool.totalLiquidity;
        uint256 optimalReserve = totalLiquidity.mul(pool.minReserveRatio).div(10000);
        uint256 currentReserve = pool.emergencyReserve;

        if (currentReserve < optimalReserve) {
            // Need to increase reserves
            uint256 deficit = optimalReserve.sub(currentReserve);
            if (pool.availableLiquidity >= deficit) {
                pool.availableLiquidity = pool.availableLiquidity.sub(deficit);
                pool.emergencyReserve = pool.emergencyReserve.add(deficit);
            }
        } else if (currentReserve > optimalReserve.add(optimalReserve.mul(rebalanceThreshold).div(10000))) {
            // Can release some reserves
            uint256 excess = currentReserve.sub(optimalReserve);
            pool.emergencyReserve = pool.emergencyReserve.sub(excess);
            pool.availableLiquidity = pool.availableLiquidity.add(excess);
        }

        emit LiquidityRebalanced(token, pool.availableLiquidity, pool.reservedLiquidity);
    }

    /**
     * @dev Creates or updates a liquidity pool
     * @param token Token address
     * @param minReserveRatio Minimum reserve ratio in basis points
     * @param maxUtilization Maximum utilization in basis points
     */
    function createOrUpdatePool(
        address token,
        uint256 minReserveRatio,
        uint256 maxUtilization
    ) external onlyRole(MANAGER_ROLE) {
        require(token != address(0), "Invalid token address");
        require(minReserveRatio <= 5000, "Reserve ratio too high"); // Max 50%
        require(maxUtilization <= 9000, "Max utilization too high"); // Max 90%

        LiquidityPool storage pool = liquidityPools[token];
        pool.token = token;
        pool.minReserveRatio = minReserveRatio;
        pool.maxUtilization = maxUtilization;
        pool.isActive = true;

        emit PoolUpdated(token, pool);
    }

    /**
     * @dev Emergency withdrawal function
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        LiquidityPool storage pool = liquidityPools[token];
        require(pool.emergencyReserve >= amount, "Insufficient emergency reserves");

        pool.emergencyReserve = pool.emergencyReserve.sub(amount);
        IERC20(token).safeTransfer(msg.sender, amount);

        emit EmergencyWithdrawal(token, amount);
    }

    /**
     * @dev Gets user liquidity information
     * @param user User address
     * @param token Token address
     * @return liquidity User liquidity data
     */
    function getUserLiquidity(address user, address token) 
        external 
        view 
        returns (UserLiquidity memory liquidity) 
    {
        return userLiquidity[user][token];
    }

    /**
     * @dev Gets pool liquidity information
     * @param token Token address
     * @return pool Pool liquidity data
     */
    function getPoolLiquidity(address token) 
        external 
        view 
        returns (LiquidityPool memory pool) 
    {
        return liquidityPools[token];
    }

    /**
     * @dev Checks if liquidity is sufficient for amount
     * @param token Token address
     * @param amount Amount to check
     * @return sufficient True if liquidity is sufficient
     */
    function checkLiquiditySufficiency(address token, uint256 amount) 
        external 
        view 
        returns (bool sufficient) 
    {
        LiquidityPool storage pool = liquidityPools[token];
        return pool.availableLiquidity >= amount;
    }

    /**
     * @dev Internal function to process instant settlement
     * @param request Liquidity request
     * @return success True if processed successfully
     */
    function _processInstantSettlement(LiquidityRequest calldata request) 
        internal 
        returns (bool success) 
    {
        UserLiquidity storage userLiq = userLiquidity[request.user][request.token];
        LiquidityPool storage pool = liquidityPools[request.token];

        // Check if pool has sufficient liquidity
        if (pool.availableLiquidity < request.amount) {
            return false;
        }

        // Check if user has sufficient total balance (available + locked)
        uint256 totalUserBalance = userLiq.availableBalance.add(userLiq.lockedBalance);
        if (totalUserBalance < request.amount) {
            return false;
        }

        // Use available balance first, then locked balance
        uint256 fromAvailable = userLiq.availableBalance >= request.amount 
            ? request.amount 
            : userLiq.availableBalance;
        uint256 fromLocked = request.amount.sub(fromAvailable);

        userLiq.availableBalance = userLiq.availableBalance.sub(fromAvailable);
        userLiq.lockedBalance = userLiq.lockedBalance.sub(fromLocked);
        userLiq.lastUpdate = block.timestamp;

        // Update pool liquidity
        pool.availableLiquidity = pool.availableLiquidity.sub(request.amount);
        pool.reservedLiquidity = pool.reservedLiquidity.add(request.amount);

        liquidityRequests[request.requestId] = request;

        emit CardTransactionProcessed(request.user, request.token, request.amount, request.requestId);
        return true;
    }

    /**
     * @dev Internal function to process vault settlement
     * @param request Liquidity request
     * @return success True if processed successfully
     */
    function _processVaultSettlement(LiquidityRequest calldata request) 
        internal 
        returns (bool success) 
    {
        // This would interact with the vault to liquidate positions
        // For now, we'll simulate by checking if vault can provide liquidity
        if (vaultContract != address(0)) {
            // In a real implementation, this would call the vault contract
            // to liquidate sufficient yield-bearing positions
            
            UserLiquidity storage userLiq = userLiquidity[request.user][request.token];
            userLiq.lockedBalance = userLiq.lockedBalance.add(request.amount);
            userLiq.lastUpdate = block.timestamp;

            liquidityRequests[request.requestId] = request;

            emit CardTransactionProcessed(request.user, request.token, request.amount, request.requestId);
            return true;
        }

        return false;
    }

    /**
     * @dev Updates contract parameters
     * @param _instantThreshold New instant settlement threshold
     * @param _bufferRatio New liquidity buffer ratio
     * @param _rebalanceThreshold New rebalance threshold
     */
    function updateParameters(
        uint256 _instantThreshold,
        uint256 _bufferRatio,
        uint256 _rebalanceThreshold
    ) external onlyRole(MANAGER_ROLE) {
        instantSettlementThreshold = _instantThreshold;
        liquidityBufferRatio = _bufferRatio;
        rebalanceThreshold = _rebalanceThreshold;
    }

    /**
     * @dev Grants card role to address
     * @param card Card interface address
     */
    function grantCardRole(address card) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(CARD_ROLE, card);
    }

    /**
     * @dev Grants vault role to address
     * @param vault Vault address
     */
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }
}
