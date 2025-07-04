// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMetaMaskCard
 * @dev Interface for MetaMask Card integration and spending functionality
 */
interface IMetaMaskCard {
    struct SpendingData {
        address user;
        address token;
        uint256 amount;
        uint256 timestamp;
        bytes32 merchantId;
        string category;
    }

    struct TopUpRequest {
        address user;
        address token;
        uint256 amount;
        uint256 minReceived;
        bytes swapData;
    }

    /**
     * @dev Authorizes a card spending transaction
     * @param spendingData Transaction details
     * @return authorized True if spending is authorized
     */
    function authorizeSpending(SpendingData calldata spendingData) 
        external 
        returns (bool authorized);

    /**
     * @dev Tops up card balance from user's wallet
     * @param request Top-up request details
     * @return success True if top-up successful
     */
    function topUpCard(TopUpRequest calldata request) external returns (bool success);

    /**
     * @dev Gets user's card balance
     * @param user User address
     * @param token Token address
     * @return balance Current card balance
     */
    function getCardBalance(address user, address token) 
        external 
        view 
        returns (uint256 balance);

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
    ) external;

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
        returns (uint256 dailyLimit, uint256 monthlyLimit);

    /**
     * @dev Gets user's spending in current period
     * @param user User address
     * @param token Token address
     * @return dailySpent Amount spent today
     * @return monthlySpent Amount spent this month
     */
    function getCurrentSpending(address user, address token)
        external
        view
        returns (uint256 dailySpent, uint256 monthlySpent);

    /**
     * @dev Enables/disables card for user
     * @param enabled True to enable card
     */
    function setCardEnabled(bool enabled) external;

    /**
     * @dev Checks if user's card is enabled
     * @param user User address
     * @return enabled True if card is enabled
     */
    function isCardEnabled(address user) external view returns (bool enabled);

    // Events
    event CardSpending(
        address indexed user,
        address indexed token,
        uint256 amount,
        bytes32 indexed merchantId,
        string category
    );

    event CardTopUp(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    event SpendingLimitsUpdated(
        address indexed user,
        address indexed token,
        uint256 dailyLimit,
        uint256 monthlyLimit
    );

    event CardStatusChanged(
        address indexed user,
        bool enabled
    );
}
