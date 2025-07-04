// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC4626/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/SafeMath.sol";
import "../libraries/YieldCalculations.sol";

/**
 * @title yFLOW
 * @dev Yield-bearing token representing shares in FlowBridge vault
 * ERC4626 compliant vault token that automatically compounds yield
 */
contract yFLOW is 
    Initializable,
    ERC4626Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using YieldCalculations for YieldCalculations.YieldData;

    // Role definitions
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 public constant YIELD_MANAGER_ROLE = keccak256("YIELD_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Yield tracking
    struct UserYieldData {
        uint256 lastUpdateTime;
        uint256 accumulatedYield;
        uint256 yieldDebt;
        uint256 compoundCount;
    }

    // Vault performance metrics
    struct PerformanceMetrics {
        uint256 totalYieldGenerated;
        uint256 totalFeesCollected;
        uint256 averageAPY;
        uint256 lastCompoundTime;
        uint256 compoundFrequency;
    }

    // Fee structure
    struct FeeConfig {
        uint256 managementFee;    // Annual management fee in basis points
        uint256 performanceFee;   // Performance fee in basis points
        uint256 withdrawalFee;    // Early withdrawal fee in basis points
        uint256 depositFee;       // Deposit fee in basis points
        address feeRecipient;     // Fee recipient address
    }

    // State variables
    mapping(address => UserYieldData) public userYieldData;
    PerformanceMetrics public performanceMetrics;
    FeeConfig public feeConfig;
    
    // Yield management
    uint256 public totalYieldAccumulated;
    uint256 public yieldPerShare; // Yield accumulated per share
    uint256 public lastYieldUpdate;
    uint256 public minimumDeposit;
    uint256 public compoundThreshold; // Minimum yield to trigger auto-compound

    // Withdrawal configuration
    uint256 public withdrawalLockPeriod; // Time lock for withdrawals
    mapping(address => uint256) public lastDepositTime;
    mapping(address => uint256) public pendingWithdrawals;

    // Connected vault contract
    address public vaultContract;
    
    // Events
    event YieldDistributed(uint256 totalYield, uint256 yieldPerShare);
    event UserYieldCompounded(address indexed user, uint256 yieldAmount);
    event FeeConfigUpdated(FeeConfig newConfig);
    event VaultContractUpdated(address indexed newVault);
    event WithdrawalRequested(address indexed user, uint256 shares, uint256 unlockTime);
    event PerformanceUpdated(PerformanceMetrics metrics);

    /**
     * @dev Initializes the yFLOW token
     * @param _asset Underlying asset (FLOW token)
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _vaultContract Vault contract address
     * @param _feeRecipient Fee recipient address
     */
    function initialize(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _vaultContract,
        address _feeRecipient
    ) public initializer {
        __ERC4626_init(_asset);
        __ERC20_init(_name, _symbol);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_MANAGER_ROLE, msg.sender);
        _grantRole(YIELD_MANAGER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        vaultContract = _vaultContract;
        
        // Initialize fee configuration
        feeConfig = FeeConfig({
            managementFee: 100,      // 1% annual management fee
            performanceFee: 1000,    // 10% performance fee
            withdrawalFee: 50,       // 0.5% early withdrawal fee
            depositFee: 0,           // No deposit fee initially
            feeRecipient: _feeRecipient
        });

        minimumDeposit = 1e18; // 1 token minimum
        withdrawalLockPeriod = 7 days;
        compoundThreshold = 1000e18; // 1000 tokens threshold for auto-compound
        lastYieldUpdate = block.timestamp;
    }

    /**
     * @dev Deposits assets and mints shares
     * @param assets Amount of assets to deposit
     * @param receiver Address to receive shares
     * @return shares Amount of shares minted
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        require(assets >= minimumDeposit, "Below minimum deposit");
        require(receiver != address(0), "Invalid receiver");

        // Update yield before deposit
        _updateYieldAccumulation();

        // Calculate shares before fees
        shares = previewDeposit(assets);
        
        // Apply deposit fee
        uint256 depositFeeAmount = 0;
        if (feeConfig.depositFee > 0) {
            depositFeeAmount = assets.mul(feeConfig.depositFee).div(10000);
            assets = assets.sub(depositFeeAmount);
            shares = previewDeposit(assets);
        }

        // Transfer assets
        SafeERC20.safeTransferFrom(IERC20(asset()), msg.sender, address(this), assets.add(depositFeeAmount));
        
        // Transfer fee to recipient
        if (depositFeeAmount > 0) {
            SafeERC20.safeTransfer(IERC20(asset()), feeConfig.feeRecipient, depositFeeAmount);
        }

        // Mint shares
        _mint(receiver, shares);

        // Initialize user yield data
        UserYieldData storage userData = userYieldData[receiver];
        userData.lastUpdateTime = block.timestamp;
        userData.yieldDebt = shares.mul(yieldPerShare).div(1e18);
        lastDepositTime[receiver] = block.timestamp;

        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }

    /**
     * @dev Withdraws assets by burning shares
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive assets
     * @param owner Owner of the shares
     * @return shares Amount of shares burned
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        require(receiver != address(0), "Invalid receiver");
        
        // Update yield before withdrawal
        _updateYieldAccumulation();
        
        shares = previewWithdraw(assets);
        
        // Check withdrawal lock period
        bool isEarlyWithdrawal = block.timestamp < lastDepositTime[owner].add(withdrawalLockPeriod);
        
        uint256 withdrawalFeeAmount = 0;
        if (isEarlyWithdrawal && feeConfig.withdrawalFee > 0) {
            withdrawalFeeAmount = assets.mul(feeConfig.withdrawalFee).div(10000);
            assets = assets.sub(withdrawalFeeAmount);
        }

        // Process withdrawal
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        // Update user yield data before burning shares
        _updateUserYield(owner);
        
        _burn(owner, shares);
        
        // Transfer assets
        SafeERC20.safeTransfer(IERC20(asset()), receiver, assets);
        
        // Transfer withdrawal fee
        if (withdrawalFeeAmount > 0) {
            SafeERC20.safeTransfer(IERC20(asset()), feeConfig.feeRecipient, withdrawalFeeAmount);
        }

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        return shares;
    }

    /**
     * @dev Compounds yield for a user
     * @param user User address
     * @return compoundedAmount Amount of yield compounded
     */
    function compoundYield(address user) external returns (uint256 compoundedAmount) {
        _updateYieldAccumulation();
        return _compoundUserYield(user);
    }

    /**
     * @dev Auto-compounds yield for all users (batch processing)
     * @param users Array of user addresses
     * @param maxUsers Maximum users to process
     */
    function batchCompoundYield(address[] calldata users, uint256 maxUsers) 
        external 
        onlyRole(YIELD_MANAGER_ROLE) 
    {
        _updateYieldAccumulation();
        
        uint256 usersToProcess = users.length > maxUsers ? maxUsers : users.length;
        
        for (uint256 i = 0; i < usersToProcess; i++) {
            if (users[i] != address(0)) {
                _compoundUserYield(users[i]);
            }
        }
    }

    /**
     * @dev Distributes yield to all shareholders
     * @param yieldAmount Amount of yield to distribute
     */
    function distributeYield(uint256 yieldAmount) 
        external 
        onlyRole(YIELD_MANAGER_ROLE) 
    {
        require(yieldAmount > 0, "Invalid yield amount");
        require(totalSupply() > 0, "No shares outstanding");

        // Transfer yield from vault
        SafeERC20.safeTransferFrom(IERC20(asset()), msg.sender, address(this), yieldAmount);

        // Calculate management and performance fees
        uint256 managementFeeAmount = _calculateManagementFee(yieldAmount);
        uint256 performanceFeeAmount = yieldAmount.mul(feeConfig.performanceFee).div(10000);
        uint256 totalFees = managementFeeAmount.add(performanceFeeAmount);
        
        uint256 netYield = yieldAmount.sub(totalFees);

        // Transfer fees
        if (totalFees > 0) {
            SafeERC20.safeTransfer(IERC20(asset()), feeConfig.feeRecipient, totalFees);
        }

        // Update yield per share
        yieldPerShare = yieldPerShare.add(netYield.mul(1e18).div(totalSupply()));
        totalYieldAccumulated = totalYieldAccumulated.add(netYield);
        lastYieldUpdate = block.timestamp;

        // Update performance metrics
        performanceMetrics.totalYieldGenerated = performanceMetrics.totalYieldGenerated.add(netYield);
        performanceMetrics.totalFeesCollected = performanceMetrics.totalFeesCollected.add(totalFees);
        performanceMetrics.lastCompoundTime = block.timestamp;

        emit YieldDistributed(netYield, yieldPerShare);
    }

    /**
     * @dev Gets user's pending yield
     * @param user User address
     * @return pendingYield Amount of pending yield
     */
    function pendingYield(address user) external view returns (uint256 pendingYield) {
        UserYieldData storage userData = userYieldData[user];
        uint256 userShares = balanceOf(user);
        
        if (userShares == 0) return 0;
        
        uint256 accumulatedYield = userShares.mul(yieldPerShare).div(1e18);
        pendingYield = accumulatedYield.sub(userData.yieldDebt).add(userData.accumulatedYield);
    }

    /**
     * @dev Gets user's yield information
     * @param user User address
     * @return data User yield data
     */
    function getUserYieldData(address user) external view returns (UserYieldData memory data) {
        return userYieldData[user];
    }

    /**
     * @dev Gets current performance metrics
     * @return metrics Performance metrics
     */
    function getPerformanceMetrics() external view returns (PerformanceMetrics memory metrics) {
        return performanceMetrics;
    }

    /**
     * @dev Updates fee configuration
     * @param newConfig New fee configuration
     */
    function updateFeeConfig(FeeConfig calldata newConfig) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newConfig.managementFee <= 500, "Management fee too high"); // Max 5%
        require(newConfig.performanceFee <= 2000, "Performance fee too high"); // Max 20%
        require(newConfig.withdrawalFee <= 1000, "Withdrawal fee too high"); // Max 10%
        require(newConfig.depositFee <= 500, "Deposit fee too high"); // Max 5%
        require(newConfig.feeRecipient != address(0), "Invalid fee recipient");

        feeConfig = newConfig;
        emit FeeConfigUpdated(newConfig);
    }

    /**
     * @dev Updates vault contract address
     * @param newVault New vault contract address
     */
    function updateVaultContract(address newVault) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newVault != address(0), "Invalid vault address");
        vaultContract = newVault;
        emit VaultContractUpdated(newVault);
    }

    /**
     * @dev Updates minimum deposit amount
     * @param newMinimum New minimum deposit
     */
    function updateMinimumDeposit(uint256 newMinimum) 
        external 
        onlyRole(VAULT_MANAGER_ROLE) 
    {
        minimumDeposit = newMinimum;
    }

    /**
     * @dev Calculates total assets under management
     * @return totalManagedAssets Total assets in vault
     */
    function totalAssets() public view override returns (uint256 totalManagedAssets) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /**
     * @dev Internal function to update yield accumulation
     */
    function _updateYieldAccumulation() internal {
        if (block.timestamp <= lastYieldUpdate) return;
        
        // This would typically interact with the vault to get latest yield
        // For now, we update the timestamp
        lastYieldUpdate = block.timestamp;
    }

    /**
     * @dev Internal function to compound user yield
     * @param user User address
     * @return compoundedAmount Amount compounded
     */
    function _compoundUserYield(address user) internal returns (uint256 compoundedAmount) {
        UserYieldData storage userData = userYieldData[user];
        uint256 userShares = balanceOf(user);
        
        if (userShares == 0) return 0;
        
        _updateUserYield(user);
        compoundedAmount = userData.accumulatedYield;
        
        if (compoundedAmount >= compoundThreshold) {
            // Convert yield to shares and mint
            uint256 newShares = convertToShares(compoundedAmount);
            _mint(user, newShares);
            
            // Reset accumulated yield
            userData.accumulatedYield = 0;
            userData.compoundCount = userData.compoundCount.add(1);
            userData.lastUpdateTime = block.timestamp;
            
            emit UserYieldCompounded(user, compoundedAmount);
        }
        
        return compoundedAmount;
    }

    /**
     * @dev Internal function to update user yield data
     * @param user User address
     */
    function _updateUserYield(address user) internal {
        UserYieldData storage userData = userYieldData[user];
        uint256 userShares = balanceOf(user);
        
        if (userShares > 0) {
            uint256 accumulatedYield = userShares.mul(yieldPerShare).div(1e18);
            uint256 pendingYield = accumulatedYield.sub(userData.yieldDebt);
            
            userData.accumulatedYield = userData.accumulatedYield.add(pendingYield);
            userData.yieldDebt = accumulatedYield;
            userData.lastUpdateTime = block.timestamp;
        }
    }

    /**
     * @dev Calculates management fee based on time elapsed
     * @param yieldAmount Current yield amount
     * @return feeAmount Management fee amount
     */
    function _calculateManagementFee(uint256 yieldAmount) internal view returns (uint256 feeAmount) {
        uint256 timeElapsed = block.timestamp.sub(lastYieldUpdate);
        uint256 annualFeeRate = feeConfig.managementFee;
        
        // Calculate pro-rated management fee
        feeAmount = yieldAmount.mul(annualFeeRate).mul(timeElapsed).div(365 days).div(10000);
    }

    /**
     * @dev Hook called before token transfer
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        
        // Update yield for both parties
        if (from != address(0)) {
            _updateUserYield(from);
        }
        if (to != address(0)) {
            _updateUserYield(to);
        }
    }

    /**
     * @dev Hook called after token transfer
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._afterTokenTransfer(from, to, amount);
        
        // Update yield debt for both parties
        if (from != address(0)) {
            UserYieldData storage fromData = userYieldData[from];
            fromData.yieldDebt = balanceOf(from).mul(yieldPerShare).div(1e18);
        }
        if (to != address(0)) {
            UserYieldData storage toData = userYieldData[to];
            toData.yieldDebt = balanceOf(to).mul(yieldPerShare).div(1e18);
            toData.lastUpdateTime = block.timestamp;
        }
    }

    /**
     * @dev Pauses the contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
