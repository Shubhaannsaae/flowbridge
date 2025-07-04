// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICircle
 * @dev Interface for Circle's Cross-Chain Transfer Protocol (CCTP)
 */
interface ICircle {
    /**
     * @dev Burns USDC tokens for cross-chain transfer
     * @param amount Amount of USDC to burn
     * @param destinationDomain Destination domain identifier
     * @param mintRecipient Recipient address on destination chain
     * @param burnToken USDC token address to burn
     * @return nonce Unique nonce for this burn
     */
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);

    /**
     * @dev Burns USDC tokens with caller specified as mint recipient
     * @param amount Amount of USDC to burn
     * @param destinationDomain Destination domain identifier
     * @param burnToken USDC token address to burn
     * @return nonce Unique nonce for this burn
     */
    function depositForBurnWithCaller(
        uint256 amount,
        uint32 destinationDomain,
        address burnToken
    ) external returns (uint64 nonce);

    /**
     * @dev Receives minted USDC from source chain burn
     * @param message Formatted message from source chain
     * @param attestation Attestation of message validity
     * @return success True if successful
     */
    function receiveMessage(bytes memory message, bytes memory attestation)
        external
        returns (bool success);

    /**
     * @dev Gets local domain identifier
     * @return domain Local domain identifier
     */
    function localDomain() external view returns (uint32 domain);

    /**
     * @dev Checks if attestation service is enabled
     * @param attester Attester address
     * @return enabled True if enabled
     */
    function isEnabledAttester(address attester) external view returns (bool enabled);
}
