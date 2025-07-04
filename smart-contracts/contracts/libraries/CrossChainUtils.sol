// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SafeMath.sol";

/**
 * @title CrossChainUtils
 * @dev Utility library for cross-chain operations and validations
 */
library CrossChainUtils {
    using SafeMath for uint256;

    // Standard chain IDs
    uint256 public constant ETHEREUM_CHAIN_ID = 1;
    uint256 public constant POLYGON_CHAIN_ID = 137;
    uint256 public constant ARBITRUM_CHAIN_ID = 42161;
    uint256 public constant OPTIMISM_CHAIN_ID = 10;
    uint256 public constant BASE_CHAIN_ID = 8453;
    uint256 public constant AVALANCHE_CHAIN_ID = 43114;

    // Circle CCTP domain mappings
    uint32 public constant ETHEREUM_DOMAIN = 0;
    uint32 public constant AVALANCHE_DOMAIN = 1;
    uint32 public constant OPTIMISM_DOMAIN = 2;
    uint32 public constant ARBITRUM_DOMAIN = 3;
    uint32 public constant BASE_DOMAIN = 6;

    struct CrossChainRequest {
        uint256 sourceChain;
        uint256 destinationChain;
        address sourceToken;
        address destinationToken;
        uint256 amount;
        address recipient;
        uint256 deadline;
        bytes bridgeData;
    }

    struct BridgeRoute {
        address bridgeContract;
        uint256 estimatedGas;
        uint256 estimatedTime; // in seconds
        uint256 bridgeFee;
        bool isActive;
    }

    /**
     * @dev Validates cross-chain transfer parameters
     * @param request Cross-chain transfer request
     * @return valid True if parameters are valid
     */
    function validateCrossChainRequest(CrossChainRequest memory request) 
        internal 
        view 
        returns (bool valid) 
    {
        // Check basic parameters
        if (request.amount == 0) return false;
        if (request.recipient == address(0)) return false;
        if (request.sourceToken == address(0)) return false;
        if (request.deadline < block.timestamp) return false;
        
        // Check chain IDs
        if (!isSupportedChain(request.sourceChain)) return false;
        if (!isSupportedChain(request.destinationChain)) return false;
        if (request.sourceChain == request.destinationChain) return false;
        
        return true;
    }

    /**
     * @dev Checks if a chain ID is supported
     * @param chainId Chain ID to check
     * @return supported True if chain is supported
     */
    function isSupportedChain(uint256 chainId) internal pure returns (bool supported) {
        return chainId == ETHEREUM_CHAIN_ID ||
               chainId == POLYGON_CHAIN_ID ||
               chainId == ARBITRUM_CHAIN_ID ||
               chainId == OPTIMISM_CHAIN_ID ||
               chainId == BASE_CHAIN_ID ||
               chainId == AVALANCHE_CHAIN_ID;
    }

    /**
     * @dev Gets Circle CCTP domain for a chain ID
     * @param chainId Chain ID
     * @return domain CCTP domain identifier
     */
    function getCircleDomain(uint256 chainId) internal pure returns (uint32 domain) {
        if (chainId == ETHEREUM_CHAIN_ID) return ETHEREUM_DOMAIN;
        if (chainId == AVALANCHE_CHAIN_ID) return AVALANCHE_DOMAIN;
        if (chainId == OPTIMISM_CHAIN_ID) return OPTIMISM_DOMAIN;
        if (chainId == ARBITRUM_CHAIN_ID) return ARBITRUM_DOMAIN;
        if (chainId == BASE_CHAIN_ID) return BASE_DOMAIN;
        
        revert("Unsupported chain for Circle CCTP");
    }

    /**
     * @dev Calculates bridge fee based on amount and route
     * @param amount Transfer amount
     * @param baseFee Base fee in wei
     * @param feeRate Fee rate in basis points
     * @return fee Total bridge fee
     */
    function calculateBridgeFee(
        uint256 amount,
        uint256 baseFee,
        uint256 feeRate
    ) internal pure returns (uint256 fee) {
        uint256 percentageFee = amount.mul(feeRate).div(10000);
        return baseFee.add(percentageFee);
    }

    /**
     * @dev Encodes cross-chain message for bridge protocols
     * @param recipient Recipient address on destination chain
     * @param amount Transfer amount
     * @param token Token address
     * @param additionalData Additional data for the bridge
     * @return encodedMessage Encoded message bytes
     */
    function encodeCrossChainMessage(
        address recipient,
        uint256 amount,
        address token,
        bytes memory additionalData
    ) internal pure returns (bytes memory encodedMessage) {
        return abi.encode(recipient, amount, token, additionalData);
    }

    /**
     * @dev Decodes cross-chain message from bridge protocols
     * @param message Encoded message bytes
     * @return recipient Recipient address
     * @return amount Transfer amount
     * @return token Token address
     * @return additionalData Additional data
     */
    function decodeCrossChainMessage(bytes memory message)
        internal
        pure
        returns (
            address recipient,
            uint256 amount,
            address token,
            bytes memory additionalData
        )
    {
        (recipient, amount, token, additionalData) = abi.decode(
            message,
            (address, uint256, address, bytes)
        );
    }

    /**
     * @dev Converts address to bytes32 for cross-chain compatibility
     * @param addr Address to convert
     * @return bytes32 representation of address
     */
    function addressToBytes32(address addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    /**
     * @dev Converts bytes32 to address for cross-chain compatibility
     * @param b Bytes32 to convert
     * @return addr Address representation
     */
    function bytes32ToAddress(bytes32 b) internal pure returns (address addr) {
        return address(uint160(uint256(b)));
    }

    /**
     * @dev Estimates cross-chain transfer time based on route
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param bridgeType Bridge type identifier
     * @return estimatedTime Estimated transfer time in seconds
     */
    function estimateTransferTime(
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 bridgeType
    ) internal pure returns (uint256 estimatedTime) {
        // Base time estimates (in seconds)
        uint256 baseTime = 300; // 5 minutes base
        
        // Add time based on chains (L2s are faster)
        if (isL2Chain(sourceChain) || isL2Chain(destinationChain)) {
            baseTime = baseTime.add(600); // Add 10 minutes for L2 finality
        }
        
        // Add time based on bridge type
        if (bridgeType == 1) { // Fast bridge
            baseTime = baseTime.add(300);
        } else if (bridgeType == 2) { // Secure bridge
            baseTime = baseTime.add(1800); // Add 30 minutes
        }
        
        return baseTime;
    }

    /**
     * @dev Checks if chain is a Layer 2 solution
     * @param chainId Chain ID to check
     * @return isL2 True if chain is L2
     */
    function isL2Chain(uint256 chainId) internal pure returns (bool isL2) {
        return chainId == POLYGON_CHAIN_ID ||
               chainId == ARBITRUM_CHAIN_ID ||
               chainId == OPTIMISM_CHAIN_ID ||
               chainId == BASE_CHAIN_ID;
    }

    /**
     * @dev Validates bridge route parameters
     * @param route Bridge route data
     * @return valid True if route is valid
     */
    function validateBridgeRoute(BridgeRoute memory route) internal pure returns (bool valid) {
        return route.bridgeContract != address(0) &&
               route.estimatedGas > 0 &&
               route.estimatedTime > 0 &&
               route.isActive;
    }

    /**
     * @dev Calculates minimum amount after bridge fees and slippage
     * @param amount Original amount
     * @param bridgeFee Bridge fee
     * @param slippageTolerance Slippage tolerance in basis points
     * @return minAmount Minimum amount to receive
     */
    function calculateMinimumAmount(
        uint256 amount,
        uint256 bridgeFee,
        uint256 slippageTolerance
    ) internal pure returns (uint256 minAmount) {
        require(amount > bridgeFee, "Amount must be greater than bridge fee");
        
        uint256 amountAfterFee = amount.sub(bridgeFee);
        uint256 slippageAmount = amountAfterFee.mul(slippageTolerance).div(10000);
        
        return amountAfterFee.sub(slippageAmount);
    }
}
