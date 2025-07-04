// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IYieldProtocol.sol";
import "../interfaces/IMetaMaskCard.sol";
import "../libraries/YieldCalculations.sol";
import "../libraries/SafeMath.sol";

/**
 * @title FlowBridgeVault
 * @dev Main vault contract for FlowBridge protocol
 * Manages user deposits, yield optimization, and MetaMask Card integration
 */
contract FlowBridgeVault is 
    Initializable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20Upgradeable for IERC20;
    using SafeMath for uint256;
    using YieldCalculations for YieldCalculations.YieldData;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant YIELD_MANAGER_ROLE = keccak256("YIELD_MANAGER_ROLE");
    bytes32 public constant CARD_MANAGER_ROLE = keccak256("CARD_MANAGER_ROLE");

    // Vault state
    struct UserPosition {
        uint256 principal;
        uint256 shares;
        YieldCalculations.YieldData yieldData;
        uint256 lastDepositTime;
        bool isCardLinked;
    }

    struct ProtocolInfo {
        address protocolAddress;
        uint256 allocation; // Current allocation amount
        uint256 maxAllocation; // Maximum allowed allocation
        uint256 lastAPY;
        bool isActive;
        uint256 riskScore;
    }

    // State variables
    mapping(address => mapping(address => UserPosition)) public userPositions; // user -> token -> position
    mapping(address => ProtocolInfo[]) public supportedProtocols; // token -> protocols
    mapping(address => uint256) public totalDeposited; // token -> total amount
    mapping(address => uint256) public totalShares; // token -> total shares
    mapping(address => bool) public supportedTokens;
    
    // Yield optimization parameters
    uint256 public rebalanceThreshold; // Basis points (100 = 1%)
    uint256 public maxProtocols; // Maximum protocols per token
    uint256 public managementFee; // Basis points
    uint256 public performanceFee; // Basis points
    
    // MetaMask Card integration
    address public cardInterface;
    mapping(address => mapping(address => uint256)) public cardBalances; // user -> token -> balance
    mapping(address => bool) public cardWhitelist;

    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event YieldHarvested(address indexed token, uint256 totalYield, uint256 fees);
    event Rebalanced(address indexed token, address[] protocols, uint256[] allocations);
    event CardLinked(address indexed user, bool linked);
    event CardTopUp(address indexed user, address indexed token, uint256 amount);
    event ProtocolAdded(address indexed token, address indexed protocol);
    event ProtocolRemoved(address indexed token, address indexed protocol);

    /**
     * @dev Initializes the vault contract
     * @param _admin Admin address
     * @param _cardInterface MetaMask Card interface address
     */
    function initialize(
        address _admin,
        address _cardInterface
    ) public initializer {
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(YIELD_MANAGER_ROLE, _admin);
        _grantRole(CARD_MANAGER_ROLE, _admin);

        cardInterface = _cardInterface;
        rebalanceThreshold = 500; // 5%
        maxProtocols = 5;
        managementFee = 100; // 1%
        performanceFee = 1000; // 10%
    }

    /**
     * @dev Deposits tokens into the vault
     * @param token Token address to deposit
     * @param amount Amount to deposit
     * @return shares Number of shares minted
     */
    function deposit(address token, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares to mint
        shares = calculateShares(token, amount);
        
        // Update user position
        UserPosition storage position = userPositions[msg.sender][token];
        position.principal = position.principal.add(amount);
        position.shares = position.shares.add(shares);
        position.lastDepositTime = block.timestamp;

        // Initialize yield data if first deposit
        if (position.yieldData.startTime == 0) {
            position.yieldData = YieldCalculations.YieldData({
                principal: amount,
                apy: getCurrentAPY(token),
                startTime: block.timestamp,
                lastCompoundTime: block.timestamp,
                accruedYield: 0
            });
        } else {
            // Update existing yield data
            position.yieldData = position.yieldData.updateYieldData(block.timestamp);
            position.yieldData.principal = position.yieldData.principal.add(amount);
        }

        // Update totals
        totalDeposited[token] = totalDeposited[token].add(amount);
        totalShares[token] = totalShares[token].add(shares);

        // Trigger rebalancing if needed
        if (shouldRebalance(token)) {
            _rebalance(token);
        }

        emit Deposit(msg.sender, token, amount, shares);
        return shares;
    }

    /**
     * @dev Withdraws tokens from the vault
     * @param token Token address to withdraw
     * @param shares Number of shares to burn
     * @return amount Amount of tokens withdrawn
     */
    function withdraw(address token, uint256 shares) 
        external 
        nonReentrant 
        returns (uint256 amount) 
    {
        require(shares > 0, "Shares must be greater than 0");
        
        UserPosition storage position = userPositions[msg.sender][token];
        require(position.shares >= shares, "Insufficient shares");

        // Update yield data
        position.yieldData = position.yieldData.updateYieldData(block.timestamp);

        // Calculate withdrawal amount including yield
        amount = calculateWithdrawalAmount(token, shares);
        
        // Update position
        uint256 shareRatio = shares.mul(1e18).div(position.shares);
        uint256 principalReduction = position.principal.mul(shareRatio).div(1e18);
        uint256 yieldReduction = position.yieldData.accruedYield.mul(shareRatio).div(1e18);

        position.principal = position.principal.sub(principalReduction);
        position.shares = position.shares.sub(shares);
        position.yieldData.accruedYield = position.yieldData.accruedYield.sub(yieldReduction);

        // Update totals
        totalShares[token] = totalShares[token].sub(shares);

        // Withdraw from protocols if needed
        _withdrawFromProtocols(token, amount);

        // Calculate and deduct fees
        uint256 performanceFeeAmount = yieldReduction.mul(performanceFee).div(10000);
        amount = amount.sub(performanceFeeAmount);

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, token, amount, shares);
        return amount;
    }

    /**
     * @dev Links user's account to MetaMask Card
     */
    function linkCard() external {
        userPositions[msg.sender][address(0)].isCardLinked = true;
        cardWhitelist[msg.sender] = true;
        emit CardLinked(msg.sender, true);
    }

    /**
     * @dev Tops up MetaMask Card from vault balance
     * @param token Token to use for top-up
     * @param amount Amount to top up
     */
    function topUpCard(address token, uint256 amount) external nonReentrant {
        require(userPositions[msg.sender][address(0)].isCardLinked, "Card not linked");
        require(cardWhitelist[msg.sender], "Card access not authorized");
        
        UserPosition storage position = userPositions[msg.sender][token];
        require(position.principal >= amount, "Insufficient vault balance");

        // Transfer to card balance
        cardBalances[msg.sender][token] = cardBalances[msg.sender][token].add(amount);
        position.principal = position.principal.sub(amount);

        // Notify card interface
        if (cardInterface != address(0)) {
            IMetaMaskCard.TopUpRequest memory request = IMetaMaskCard.TopUpRequest({
                user: msg.sender,
                token: token,
                amount: amount,
                minReceived: amount.mul(9900).div(10000), // 1% slippage
                swapData: ""
            });
            
            IMetaMaskCard(cardInterface).topUpCard(request);
        }

        emit CardTopUp(msg.sender, token, amount);
    }

    /**
     * @dev Adds a new yield protocol for a token
     * @param token Token address
     * @param protocol Protocol address
     * @param maxAllocation Maximum allocation for this protocol
     * @param riskScore Risk score (1-100)
     */
    function addProtocol(
        address token,
        address protocol,
        uint256 maxAllocation,
        uint256 riskScore
    ) external onlyRole(YIELD_MANAGER_ROLE) {
        require(supportedTokens[token], "Token not supported");
        require(protocol != address(0), "Invalid protocol address");
        require(riskScore <= 100, "Risk score must be <= 100");

        ProtocolInfo[] storage protocols = supportedProtocols[token];
        require(protocols.length < maxProtocols, "Maximum protocols reached");

        protocols.push(ProtocolInfo({
            protocolAddress: protocol,
            allocation: 0,
            maxAllocation: maxAllocation,
            lastAPY: IYieldProtocol(protocol).getAPY(token),
            isActive: true,
            riskScore: riskScore
        }));

        emit ProtocolAdded(token, protocol);
    }

    /**
     * @dev Removes a yield protocol for a token
     * @param token Token address
     * @param protocolIndex Index of protocol to remove
     */
    function removeProtocol(address token, uint256 protocolIndex) 
        external 
        onlyRole(YIELD_MANAGER_ROLE) 
    {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        require(protocolIndex < protocols.length, "Invalid protocol index");

        // Withdraw all funds from protocol before removing
        ProtocolInfo storage protocol = protocols[protocolIndex];
        if (protocol.allocation > 0) {
            IYieldProtocol(protocol.protocolAddress).withdraw(token, protocol.allocation);
            protocol.allocation = 0;
        }

        // Remove protocol by replacing with last element
        protocols[protocolIndex] = protocols[protocols.length - 1];
        protocols.pop();

        emit ProtocolRemoved(token, protocol.protocolAddress);
    }

    /**
     * @dev Manually triggers rebalancing for a token
     * @param token Token address to rebalance
     */
    function rebalance(address token) external onlyRole(YIELD_MANAGER_ROLE) {
        _rebalance(token);
    }

    /**
     * @dev Harvests yield from all protocols for a token
     * @param token Token address
     * @return totalYield Total yield harvested
     */
    function harvestYield(address token) 
        external 
        onlyRole(YIELD_MANAGER_ROLE) 
        returns (uint256 totalYield) 
    {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].isActive && protocols[i].allocation > 0) {
                uint256 currentBalance = IYieldProtocol(protocols[i].protocolAddress)
                    .getBalance(address(this), token);
                
                if (currentBalance > protocols[i].allocation) {
                    uint256 yield = currentBalance.sub(protocols[i].allocation);
                    totalYield = totalYield.add(yield);
                }
            }
        }

        // Deduct management fee
        uint256 managementFeeAmount = totalYield.mul(managementFee).div(10000);
        totalYield = totalYield.sub(managementFeeAmount);

        emit YieldHarvested(token, totalYield, managementFeeAmount);
        return totalYield;
    }

    /**
     * @dev Calculates shares to mint for deposit
     * @param token Token address
     * @param amount Deposit amount
     * @return shares Number of shares to mint
     */
    function calculateShares(address token, uint256 amount) 
        public 
        view 
        returns (uint256 shares) 
    {
        if (totalShares[token] == 0) {
            return amount; // 1:1 ratio for first deposit
        }
        
        uint256 totalValue = getTotalValue(token);
        return amount.mul(totalShares[token]).div(totalValue);
    }

    /**
     * @dev Calculates withdrawal amount for given shares
     * @param token Token address
     * @param shares Number of shares to burn
     * @return amount Withdrawal amount
     */
    function calculateWithdrawalAmount(address token, uint256 shares) 
        public 
        view 
        returns (uint256 amount) 
    {
        if (totalShares[token] == 0) {
            return 0;
        }
        
        uint256 totalValue = getTotalValue(token);
        return shares.mul(totalValue).div(totalShares[token]);
    }

    /**
     * @dev Gets total value of all deposits for a token
     * @param token Token address
     * @return totalValue Total value including yield
     */
    function getTotalValue(address token) public view returns (uint256 totalValue) {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        
        // Add allocations in protocols
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].isActive) {
                totalValue = totalValue.add(
                    IYieldProtocol(protocols[i].protocolAddress)
                        .getBalance(address(this), token)
                );
            }
        }
        
        // Add idle balance
        totalValue = totalValue.add(IERC20(token).balanceOf(address(this)));
        
        return totalValue;
    }

    /**
     * @dev Gets current weighted APY for a token
     * @param token Token address
     * @return apy Current weighted APY in basis points
     */
    function getCurrentAPY(address token) public view returns (uint256 apy) {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        uint256 totalAllocation = 0;
        uint256 weightedAPY = 0;
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].isActive && protocols[i].allocation > 0) {
                uint256 protocolAPY = IYieldProtocol(protocols[i].protocolAddress).getAPY(token);
                weightedAPY = weightedAPY.add(protocols[i].allocation.mul(protocolAPY));
                totalAllocation = totalAllocation.add(protocols[i].allocation);
            }
        }
        
        if (totalAllocation > 0) {
            apy = weightedAPY.div(totalAllocation);
        }
        
        return apy;
    }

    /**
     * @dev Checks if rebalancing is needed for a token
     * @param token Token address
     * @return needed True if rebalancing is needed
     */
    function shouldRebalance(address token) public view returns (bool needed) {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        uint256 totalValue = getTotalValue(token);
        
        if (totalValue == 0) return false;
        
        // Check if any protocol allocation deviates significantly from optimal
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].isActive) {
                uint256 currentAllocation = protocols[i].allocation;
                uint256 currentPercentage = currentAllocation.mul(10000).div(totalValue);
                
                // This is simplified - in practice, optimal allocation would be calculated
                uint256 optimalPercentage = protocols[i].maxAllocation.mul(10000).div(totalValue);
                
                if (currentPercentage > optimalPercentage.add(rebalanceThreshold) ||
                    currentPercentage < optimalPercentage.sub(rebalanceThreshold)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * @dev Internal function to rebalance allocations
     * @param token Token address
     */
    function _rebalance(address token) internal {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        uint256 totalValue = getTotalValue(token);
        
        if (totalValue == 0) return;

        // Withdraw all funds first
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].allocation > 0) {
                IYieldProtocol(protocols[i].protocolAddress).withdraw(
                    token, 
                    protocols[i].allocation
                );
                protocols[i].allocation = 0;
            }
        }

        // Calculate optimal allocations
        YieldCalculations.ProtocolYield[] memory protocolYields = 
            new YieldCalculations.ProtocolYield[](protocols.length);
        
        for (uint256 i = 0; i < protocols.length; i++) {
            protocolYields[i] = YieldCalculations.ProtocolYield({
                protocol: protocols[i].protocolAddress,
                apy: IYieldProtocol(protocols[i].protocolAddress).getAPY(token),
                liquidity: protocols[i].maxAllocation,
                riskScore: protocols[i].riskScore,
                gasEstimate: 200000 // Estimated gas cost
            });
        }

        // Get optimal allocations (simplified - max risk score of 70)
        uint256[] memory allocations = YieldCalculations.calculateOptimalAllocation(
            protocolYields,
            totalValue,
            70 // Max risk score
        );

        // Deploy allocations
        address[] memory protocolAddresses = new address[](protocols.length);
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0 && protocols[i].isActive) {
                IERC20(token).safeApprove(protocols[i].protocolAddress, allocations[i]);
                IYieldProtocol(protocols[i].protocolAddress).deposit(token, allocations[i]);
                protocols[i].allocation = allocations[i];
            }
            protocolAddresses[i] = protocols[i].protocolAddress;
        }

        emit Rebalanced(token, protocolAddresses, allocations);
    }

    /**
     * @dev Internal function to withdraw from protocols
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function _withdrawFromProtocols(address token, uint256 amount) internal {
        ProtocolInfo[] storage protocols = supportedProtocols[token];
        uint256 remainingAmount = amount;
        
        // Withdraw proportionally from protocols
        for (uint256 i = 0; i < protocols.length && remainingAmount > 0; i++) {
            if (protocols[i].allocation > 0) {
                uint256 withdrawAmount = remainingAmount > protocols[i].allocation 
                    ? protocols[i].allocation 
                    : remainingAmount;
                
                IYieldProtocol(protocols[i].protocolAddress).withdraw(token, withdrawAmount);
                protocols[i].allocation = protocols[i].allocation.sub(withdrawAmount);
                remainingAmount = remainingAmount.sub(withdrawAmount);
            }
        }
    }

    /**
     * @dev Adds support for a new token
     * @param token Token address to support
     */
    function addSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = true;
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Emergency unpause function
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Updates vault parameters
     * @param _rebalanceThreshold New rebalance threshold
     * @param _managementFee New management fee
     * @param _performanceFee New performance fee
     */
    function updateVaultParameters(
        uint256 _rebalanceThreshold,
        uint256 _managementFee,
        uint256 _performanceFee
    ) external onlyRole(ADMIN_ROLE) {
        require(_managementFee <= 500, "Management fee too high"); // Max 5%
        require(_performanceFee <= 2000, "Performance fee too high"); // Max 20%
        
        rebalanceThreshold = _rebalanceThreshold;
        managementFee = _managementFee;
        performanceFee = _performanceFee;
    }

    /**
     * @dev Gets user position details
     * @param user User address
     * @param token Token address
     * @return position User position data
     */
    function getUserPosition(address user, address token) 
        external 
        view 
        returns (UserPosition memory position) 
    {
        position = userPositions[user][token];
        position.yieldData = position.yieldData.updateYieldData(block.timestamp);
        return position;
    }

    /**
     * @dev Gets supported protocols for a token
     * @param token Token address
     * @return protocols Array of protocol information
     */
    function getSupportedProtocols(address token) 
        external 
        view 
        returns (ProtocolInfo[] memory protocols) 
    {
        return supportedProtocols[token];
    }
}
