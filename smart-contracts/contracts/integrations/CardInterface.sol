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
 * @title CardInterface
 * @dev MetaMask Card interface implementation for FlowBridge
 * Enables seamless spending from yield-generating positions
 */
contract CardInterface is 
    IMetaMaskCard,
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20;
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant CARD_MANAGER_ROLE = keccak256("CARD_MANAGER_ROLE");
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // Card configuration
    struct CardConfig {
        bool isActive;
        uint256 defaultDailyLimit;
        uint256 defaultMonthlyLimit;
        uint256 maxDailyLimit;
        uint256 maxMonthlyLimit;
        uint256 minimumBalance;
        address[] supportedTokens;
    }

    // User card data
    struct UserCardData {
        bool isEnabled;
        bool isLinked;
        uint256 activatedAt;
        uint256 lastTransactionTime;
        mapping(address => uint256) cardBalances;
        mapping(address => SpendingLimits) spendingLimits;
        mapping(address => SpendingTracker) spendingTrackers;
    }

    // Spending limits per token
    struct SpendingLimits {
        uint256 dailyLimit;
        uint256 monthlyLimit;
        uint256 lastUpdated;
    }

    // Spending tracking
    struct SpendingTracker {
        uint256 dailySpent;
        uint256 monthlySpent;
        uint256 lastDayReset;
        uint256 lastMonthReset;
    }

    // Merchant data
    struct MerchantData {
        bytes32 merchantId;
        string name;
        string category;
        bool isWhitelisted;
        uint256 registeredAt;
    }

    // State variables
    mapping(address => UserCardData) private userData;
    mapping(bytes32 => MerchantData) public merchants;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenDecimals;
    
    CardConfig public cardConfig;
    address public liquidityManager;
    address public vaultContract;
    
    // Transaction fees
    uint256 public transactionFeeRate; // basis points
    uint256 public foreignExchangeFeeRate; // basis points
    address public feeRecipient;

    // Events (additional to interface events)
    event CardConfigUpdated(CardConfig config);
    event MerchantRegistered(bytes32 indexed merchantId, string name, string category);
    event MerchantWhitelisted(bytes32 indexed merchantId, bool whitelisted);
    event TransactionFeeUpdated(uint256 transactionFee, uint256 fxFee);

    /**
     * @dev Initializes the Card Interface contract
     * @param _admin Admin address
     * @param _liquidityManager Liquidity manager address
     * @param _vaultContract Vault contract address
     */
    function initialize(
        address _admin,
        address _liquidityManager,
        address _vaultContract
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CARD_MANAGER_ROLE, _admin);

        liquidityManager = _liquidityManager;
        vaultContract = _vaultContract;
        
        // Initialize default card configuration
        cardConfig = CardConfig({
            isActive: true,
            defaultDailyLimit: 1000 * 1e6,     // $1000 USDC
            defaultMonthlyLimit: 10000 * 1e6,  // $10000 USDC
            maxDailyLimit: 10000 * 1e6,        // $10000 USDC max daily
            maxMonthlyLimit: 100000 * 1e6,     // $100000 USDC max monthly
            minimumBalance: 10 * 1e6,           // $10 USDC minimum
            supportedTokens: new address[](0)
        });

        transactionFeeRate = 50; // 0.5%
        foreignExchangeFeeRate = 250; // 2.5%
        feeRecipient = _admin;
    }

    /**
     * @dev Authorizes a card spending transaction
     * @param spendingData Transaction details
     * @return authorized True if spending is authorized
     */
    function authorizeSpending(SpendingData calldata spendingData) 
        external 
        override 
        onlyRole(CARD_MANAGER_ROLE) 
        returns (bool authorized) 
    {
        require(cardConfig.isActive, "Card system not active");
        require(spendingData.user != address(0), "Invalid user address");
        require(spendingData.amount > 0, "Invalid amount");
        require(supportedTokens[spendingData.token], "Token not supported");

        UserCardData storage user = userData[spendingData.user];
        require(user.isEnabled, "Card not enabled");
        require(user.isLinked, "Card not linked");

        // Check card balance
        uint256 cardBalance = user.cardBalances[spendingData.token];
        require(cardBalance >= spendingData.amount, "Insufficient card balance");

        // Update spending trackers
        _updateSpendingTrackers(spendingData.user, spendingData.token);

        // Check spending limits
        SpendingLimits storage limits = user.spendingLimits[spendingData.token];
        SpendingTracker storage tracker = user.spendingTrackers[spendingData.token];

        require(
            tracker.dailySpent.add(spendingData.amount) <= limits.dailyLimit,
            "Daily spending limit exceeded"
        );
        require(
            tracker.monthlySpent.add(spendingData.amount) <= limits.monthlyLimit,
            "Monthly spending limit exceeded"
        );

        // Verify merchant if provided
        if (spendingData.merchantId != bytes32(0)) {
            MerchantData storage merchant = merchants[spendingData.merchantId];
            require(merchant.isWhitelisted, "Merchant not whitelisted");
        }

        // Deduct from card balance
        user.cardBalances[spendingData.token] = user.cardBalances[spendingData.token].sub(spendingData.amount);

        // Update spending trackers
        tracker.dailySpent = tracker.dailySpent.add(spendingData.amount);
        tracker.monthlySpent = tracker.monthlySpent.add(spendingData.amount);
        user.lastTransactionTime = block.timestamp;

        // Calculate and deduct transaction fee
        uint256 fee = spendingData.amount.mul(transactionFeeRate).div(10000);
        if (fee > 0) {
            IERC20(spendingData.token).safeTransfer(feeRecipient, fee);
        }

        emit CardSpending(
            spendingData.user,
            spendingData.token,
            spendingData.amount,
            spendingData.merchantId,
            spendingData.category
        );

        return true;
    }

    /**
     * @dev Tops up card balance from user's wallet
     * @param request Top-up request details
     * @return success True if top-up successful
     */
    function topUpCard(TopUpRequest calldata request) 
        external 
        override 
        onlyRole(VAULT_ROLE) 
        nonReentrant 
        returns (bool success) 
    {
        require(request.user != address(0), "Invalid user address");
        require(request.amount > 0, "Invalid amount");
        require(supportedTokens[request.token], "Token not supported");

        UserCardData storage user = userData[request.user];
        require(user.isEnabled, "Card not enabled");
        require(user.isLinked, "Card not linked");

        // Transfer tokens from vault/liquidity manager
        IERC20(request.token).safeTransferFrom(msg.sender, address(this), request.amount);

        // Update card balance
        user.cardBalances[request.token] = user.cardBalances[request.token].add(request.amount);

        emit CardTopUp(request.user, request.token, request.amount);
        return true;
    }

    /**
     * @dev Gets user's card balance for a token
     * @param user User address
     * @param token Token address
     * @return balance Current card balance
     */
    function getCardBalance(address user, address token) 
        external 
        view 
        override 
        returns (uint256 balance) 
    {
        return userData[user].cardBalances[token];
    }

    /**
     * @dev Sets spending limits for user
     * @param token Token address
     * @param dailyLimit Daily spending limit
     * @param monthlyLimit Monthly spending limit
     */
    function setSpendingLimits(
        address token,
        uint256 dailyLimit,
        uint256 monthlyLimit
    ) external override {
        require(supportedTokens[token], "Token not supported");
        require(dailyLimit <= cardConfig.maxDailyLimit, "Daily limit too high");
        require(monthlyLimit <= cardConfig.maxMonthlyLimit, "Monthly limit too high");
        require(dailyLimit <= monthlyLimit, "Daily limit cannot exceed monthly limit");

        UserCardData storage user = userData[msg.sender];
        require(user.isEnabled, "Card not enabled");

        user.spendingLimits[token] = SpendingLimits({
            dailyLimit: dailyLimit,
            monthlyLimit: monthlyLimit,
            lastUpdated: block.timestamp
        });

        emit SpendingLimitsUpdated(msg.sender, token, dailyLimit, monthlyLimit);
    }

    /**
     * @dev Gets user's spending limits
     * @param user User address
     * @param token Token address
     * @return dailyLimit Daily spending limit
     * @return monthlyLimit Monthly spending limit
     */
    function getSpendingLimits(address user, address token)
        external
        view
        override
        returns (uint256 dailyLimit, uint256 monthlyLimit)
    {
        SpendingLimits storage limits = userData[user].spendingLimits[token];
        return (limits.dailyLimit, limits.monthlyLimit);
    }

    /**
     * @dev Gets user's current spending in current period
     * @param user User address
     * @param token Token address
     * @return dailySpent Amount spent today
     * @return monthlySpent Amount spent this month
     */
    function getCurrentSpending(address user, address token)
        external
        view
        override
        returns (uint256 dailySpent, uint256 monthlySpent)
    {
        SpendingTracker storage tracker = userData[user].spendingTrackers[token];
        
        // Check if spending data needs reset (view function, so no state changes)
        uint256 currentDay = block.timestamp / 1 days;
        uint256 currentMonth = block.timestamp / 30 days;
        
        dailySpent = (currentDay > tracker.lastDayReset) ? 0 : tracker.dailySpent;
        monthlySpent = (currentMonth > tracker.lastMonthReset) ? 0 : tracker.monthlySpent;
        
        return (dailySpent, monthlySpent);
    }

    /**
     * @dev Enables/disables card for user
     * @param enabled True to enable card
     */
    function setCardEnabled(bool enabled) external override {
        UserCardData storage user = userData[msg.sender];
        
        if (enabled && !user.isEnabled) {
            // Initialize default spending limits for supported tokens
            for (uint256 i = 0; i < cardConfig.supportedTokens.length; i++) {
                address token = cardConfig.supportedTokens[i];
                user.spendingLimits[token] = SpendingLimits({
                    dailyLimit: cardConfig.defaultDailyLimit,
                    monthlyLimit: cardConfig.defaultMonthlyLimit,
                    lastUpdated: block.timestamp
                });
            }
            
            user.activatedAt = block.timestamp;
        }
        
        user.isEnabled = enabled;
        
        emit CardStatusChanged(msg.sender, enabled);
    }

    /**
     * @dev Checks if user's card is enabled
     * @param user User address
     * @return enabled True if card is enabled
     */
    function isCardEnabled(address user) external view override returns (bool enabled) {
        return userData[user].isEnabled;
    }

    /**
     * @dev Links user's card to the system
     * @param user User address
     */
    function linkCard(address user) external onlyRole(LIQUIDITY_MANAGER_ROLE) {
        UserCardData storage userCard = userData[user];
        userCard.isLinked = true;
        
        // Initialize spending trackers
        for (uint256 i = 0; i < cardConfig.supportedTokens.length; i++) {
            address token = cardConfig.supportedTokens[i];
            userCard.spendingTrackers[token] = SpendingTracker({
                dailySpent: 0,
                monthlySpent: 0,
                lastDayReset: block.timestamp / 1 days,
                lastMonthReset: block.timestamp / 30 days
            });
        }
    }

    /**
     * @dev Registers a new merchant
     * @param merchantId Unique merchant identifier
     * @param name Merchant name
     * @param category Merchant category
     */
    function registerMerchant(
        bytes32 merchantId,
        string calldata name,
        string calldata category
    ) external onlyRole(CARD_MANAGER_ROLE) {
        require(merchantId != bytes32(0), "Invalid merchant ID");
        require(bytes(name).length > 0, "Merchant name required");

        merchants[merchantId] = MerchantData({
            merchantId: merchantId,
            name: name,
            category: category,
            isWhitelisted: false,
            registeredAt: block.timestamp
        });

        emit MerchantRegistered(merchantId, name, category);
    }

    /**
     * @dev Whitelists/blacklists a merchant
     * @param merchantId Merchant identifier
     * @param whitelisted True to whitelist, false to blacklist
     */
    function setMerchantWhitelist(bytes32 merchantId, bool whitelisted) 
        external 
        onlyRole(CARD_MANAGER_ROLE) 
    {
        require(merchants[merchantId].merchantId != bytes32(0), "Merchant not registered");
        
        merchants[merchantId].isWhitelisted = whitelisted;
        emit MerchantWhitelisted(merchantId, whitelisted);
    }

    /**
     * @dev Adds support for a new token
     * @param token Token address
     * @param decimals Token decimals
     */
    function addSupportedToken(address token, uint256 decimals) 
        external 
        onlyRole(CARD_MANAGER_ROLE) 
    {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");

        supportedTokens[token] = true;
        tokenDecimals[token] = decimals;
        cardConfig.supportedTokens.push(token);
    }

    /**
     * @dev Updates card configuration
     * @param config New card configuration
     */
    function updateCardConfig(CardConfig calldata config) 
        external 
        onlyRole(CARD_MANAGER_ROLE) 
    {
        require(config.defaultDailyLimit <= config.maxDailyLimit, "Invalid daily limits");
        require(config.defaultMonthlyLimit <= config.maxMonthlyLimit, "Invalid monthly limits");

        cardConfig = config;
        emit CardConfigUpdated(config);
    }

    /**
     * @dev Updates transaction fees
     * @param _transactionFeeRate New transaction fee rate in basis points
     * @param _foreignExchangeFeeRate New FX fee rate in basis points
     */
    function updateTransactionFees(
        uint256 _transactionFeeRate,
        uint256 _foreignExchangeFeeRate
    ) external onlyRole(CARD_MANAGER_ROLE) {
        require(_transactionFeeRate <= 1000, "Transaction fee too high"); // Max 10%
        require(_foreignExchangeFeeRate <= 1000, "FX fee too high"); // Max 10%

        transactionFeeRate = _transactionFeeRate;
        foreignExchangeFeeRate = _foreignExchangeFeeRate;

        emit TransactionFeeUpdated(_transactionFeeRate, _foreignExchangeFeeRate);
    }

    /**
     * @dev Internal function to update spending trackers
     * @param user User address
     * @param token Token address
     */
    function _updateSpendingTrackers(address user, address token) internal {
        SpendingTracker storage tracker = userData[user].spendingTrackers[token];
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 currentMonth = block.timestamp / 30 days;
        
        // Reset daily spending if new day
        if (currentDay > tracker.lastDayReset) {
            tracker.dailySpent = 0;
            tracker.lastDayReset = currentDay;
        }
        
        // Reset monthly spending if new month
        if (currentMonth > tracker.lastMonthReset) {
            tracker.monthlySpent = 0;
            tracker.lastMonthReset = currentMonth;
        }
    }

    /**
     * @dev Gets user card information
     * @param user User address
     * @return isEnabled True if card is enabled
     * @return isLinked True if card is linked
     * @return activatedAt Activation timestamp
     */
    function getUserCardInfo(address user) 
        external 
        view 
        returns (bool isEnabled, bool isLinked, uint256 activatedAt) 
    {
        UserCardData storage userCard = userData[user];
        return (userCard.isEnabled, userCard.isLinked, userCard.activatedAt);
    }

    /**
     * @dev Emergency function to pause card operations
     * @param paused True to pause operations
     */
    function pauseCardOperations(bool paused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        cardConfig.isActive = !paused;
    }

    /**
     * @dev Grants roles to specific addresses
     * @param liquidityManagerAddr Liquidity manager address
     * @param vaultAddr Vault address
     */
    function grantRoles(address liquidityManagerAddr, address vaultAddr) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _grantRole(LIQUIDITY_MANAGER_ROLE, liquidityManagerAddr);
        _grantRole(VAULT_ROLE, vaultAddr);
    }
}
