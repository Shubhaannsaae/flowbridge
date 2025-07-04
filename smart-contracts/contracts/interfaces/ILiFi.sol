// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ILiFi
 * @dev Interface for LI.FI cross-chain bridge protocol
 * Based on official LI.FI documentation
 */
interface ILiFi {
    struct BridgeData {
        bytes32 transactionId;
        string bridge;
        string integrator;
        address referrer;
        address sendingAssetId;
        address receiver;
        uint256 minAmount;
        uint256 destinationChainId;
        bool hasSourceSwaps;
        bool hasDestinationCall;
    }

    struct SwapData {
        address callTo;
        address approveTo;
        address sendingAssetId;
        address receivingAssetId;
        uint256 fromAmount;
        bytes callData;
        bool requiresDeposit;
    }

    /**
     * @dev Initiates a cross-chain bridge transaction
     * @param _bridgeData Bridge transaction data
     */
    function startBridgeTokensViaBridge(BridgeData memory _bridgeData) external payable;

    /**
     * @dev Performs swap and bridge in single transaction
     * @param _bridgeData Bridge transaction data
     * @param _swapData Swap transaction data
     */
    function swapAndStartBridgeTokensViaBridge(
        BridgeData memory _bridgeData,
        SwapData[] calldata _swapData
    ) external payable;

    /**
     * @dev Gets quote for cross-chain transfer
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @param token Token address
     * @param amount Amount to bridge
     * @return fee Bridge fee
     * @return time Estimated time in seconds
     */
    function getQuote(
        uint256 fromChain,
        uint256 toChain,
        address token,
        uint256 amount
    ) external view returns (uint256 fee, uint256 time);

    /**
     * @dev Checks if route is supported
     * @param fromChain Source chain ID
     * @param toChain Destination chain ID
     * @param token Token address
     * @return supported True if route is supported
     */
    function isRouteSupported(
        uint256 fromChain,
        uint256 toChain,
        address token
    ) external view returns (bool supported);
}
