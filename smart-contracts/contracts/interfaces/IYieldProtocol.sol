// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IYieldProtocol
 * @dev Interface for yield-generating protocols (Aave, Compound, etc.)
 */
interface IYieldProtocol {
    /**
     * @dev Deposits tokens to earn yield
     * @param token Token address to deposit
     * @param amount Amount to deposit
     * @return receipt Receipt token amount received
     */
    function deposit(address token, uint256 amount) external returns (uint256 receipt);

    /**
     * @dev Withdraws tokens and earned yield
     * @param token Token address to withdraw
     * @param receiptAmount Receipt token amount to redeem
     * @return amount Underlying token amount received
     */
    function withdraw(address token, uint256 receiptAmount) external returns (uint256 amount);

    /**
     * @dev Gets current APY for a token
     * @param token Token address
     * @return apy Current APY in basis points (10000 = 100%)
     */
    function getAPY(address token) external view returns (uint256 apy);

    /**
     * @dev Gets user's deposited balance
     * @param user User address
     * @param token Token address
     * @return balance User's balance in underlying tokens
     */
    function getBalance(address user, address token) external view returns (uint256 balance);

    /**
     * @dev Gets protocol's total liquidity for a token
     * @param token Token address
     * @return liquidity Total available liquidity
     */
    function getLiquidity(address token) external view returns (uint256 liquidity);

    /**
     * @dev Checks if protocol supports a token
     * @param token Token address
     * @return supported True if token is supported
     */
    function supportsToken(address token) external view returns (bool supported);
}
