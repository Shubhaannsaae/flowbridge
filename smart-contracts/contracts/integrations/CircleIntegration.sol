// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ICircle.sol";
import "../libraries/CrossChainUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title CircleIntegration
 * @dev Integration contract for Circle's Cross-Chain Transfer Protocol (CCTP)
 * Enables native USDC transfers across supported chains
 */
contract CircleIntegration is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20;
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant CCTP_MANAGER_ROLE = keccak256("CCTP_MANAGER_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // Circle CCTP contracts (mainnet addresses)
    address public constant TOKEN_MESSENGER = 0xBd3fa81B58Ba92a82136038B25aDec7066af3155;
    address public constant MESSAGE_TRANSMITTER = 0x0a992d191DEeC32aFe36203Ad87D7d289a738F81;
    
    // USDC token addresses by chain
    mapping(uint256 => address) public usdcTokens;
    
    // CCTP burn tracking
    struct CCTPTransfer {
        bytes32 messageHash;
        address sender;
        address recipient;
        uint256 amount;
        uint32 sourceDomain;
        uint32 destinationDomain;
        uint64 nonce;
        uint256 timestamp;
        bool isCompleted;
        bool isClaimed;
    }

    // State variables
    mapping(bytes32 => CCTPTransfer) public cctpTransfers; // messageHash -> transfer
    mapping(address => uint256) public userTransferCount;
    mapping(uint32 => bool) public supportedDomains;
    
    // Transfer limits and fees
    uint256 public minTransferAmount;
    uint256 public maxTransferAmount;
    uint256 public transferFee; // Fixed fee in USDC
    address public feeRecipient;

    // Events
    event CCTPTransferInitiated(
        bytes32 indexed messageHash,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint32 sourceDomain,
        uint32 destinationDomain,
        uint64 nonce
    );
    event CCTPTransferCompleted(bytes32 indexed messageHash, bool success);
    event CCTPTransferClaimed(bytes32 indexed messageHash, address recipient);
    event DomainAdded(uint32 domain, uint256 chainId);
    event TransferLimitsUpdated(uint256 minAmount, uint256 maxAmount);

    /**
     * @dev Initializes the Circle CCTP integration
     * @param _admin Admin address
     * @param _feeRecipient Fee recipient address
     */
    function initialize(
        address _admin,
        address _feeRecipient
    ) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CCTP_MANAGER_ROLE, _admin);

        feeRecipient = _feeRecipient;
        minTransferAmount = 1e6;    // $1 USDC
        maxTransferAmount = 1e9;    // $1000 USDC
        transferFee = 1e6;          // $1 USDC

        // Initialize supported domains and USDC tokens
        _initializeSupportedDomains();
        _initializeUSDCTokens();
    }

    /**
     * @dev Burns USDC for cross-chain transfer using CCTP
     * @param amount Amount of USDC to transfer
     * @param destinationDomain Destination domain ID
     * @param recipient Recipient address on destination chain
     * @return messageHash Unique message hash for tracking
     */
    function burnForCrossChainTransfer(
        uint256 amount,
        uint32 destinationDomain,
        address recipient
    ) external nonReentrant returns (bytes32 messageHash) {
        require(amount >= minTransferAmount, "Amount below minimum");
        require(amount <= maxTransferAmount, "Amount above maximum");
        require(supportedDomains[destinationDomain], "Destination domain not supported");
        require(recipient != address(0), "Invalid recipient");

        uint32 sourceDomain = ICircle(MESSAGE_TRANSMITTER).localDomain();
        require(supportedDomains[sourceDomain], "Source domain not supported");
        require(sourceDomain != destinationDomain, "Same domain transfer not allowed");

        address usdcToken = usdcTokens[block.chainid];
        require(usdcToken != address(0), "USDC not supported on this chain");

        // Calculate total amount including fee
        uint256 totalAmount = amount.add(transferFee);
        
        // Transfer USDC from user
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Transfer fee to fee recipient
        if (transferFee > 0) {
            IERC20(usdcToken).safeTransfer(feeRecipient, transferFee);
        }

        // Approve TokenMessenger for burn
        IERC20(usdcToken).safeApprove(TOKEN_MESSENGER, amount);

        // Convert recipient address to bytes32
        bytes32 mintRecipient = CrossChainUtils.addressToBytes32(recipient);

        // Burn USDC through CCTP
        uint64 nonce = ICircle(TOKEN_MESSENGER).depositForBurn(
            amount,
            destinationDomain,
            mintRecipient,
            usdcToken
        );

        // Generate message hash for tracking
        messageHash = keccak256(abi.encodePacked(
            sourceDomain,
            destinationDomain,
            nonce,
            amount,
            msg.sender,
            recipient,
            block.timestamp
        ));

        // Store transfer record
        cctpTransfers[messageHash] = CCTPTransfer({
            messageHash: messageHash,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            sourceDomain: sourceDomain,
            destinationDomain: destinationDomain,
            nonce: nonce,
            timestamp: block.timestamp,
            isCompleted: false,
            isClaimed: false
        });

        userTransferCount[msg.sender] = userTransferCount[msg.sender].add(1);

        emit CCTPTransferInitiated(
            messageHash,
            msg.sender,
            recipient,
            amount,
            sourceDomain,
            destinationDomain,
            nonce
        );

        return messageHash;
    }

    /**
     * @dev Burns USDC with caller as mint recipient
     * @param amount Amount of USDC to transfer
     * @param destinationDomain Destination domain ID
     * @return messageHash Unique message hash for tracking
     */
    function burnForSelfTransfer(
        uint256 amount,
        uint32 destinationDomain
    ) external nonReentrant returns (bytes32 messageHash) {
        return burnForCrossChainTransfer(amount, destinationDomain, msg.sender);
    }

    /**
     * @dev Receives and mints USDC from cross-chain burn
     * @param message Encoded message from source chain
     * @param attestation Attestation signature
     * @return success True if mint was successful
     */
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external nonReentrant returns (bool success) {
        require(message.length > 0, "Empty message");
        require(attestation.length > 0, "Empty attestation");

        // Call Circle's MessageTransmitter to receive and mint
        try ICircle(MESSAGE_TRANSMITTER).receiveMessage(message, attestation) returns (bool result) {
            success = result;
            
            if (success) {
                // Parse message to extract transfer details
                bytes32 messageHash = keccak256(message);
                
                // Mark transfer as completed if it exists in our records
                if (cctpTransfers[messageHash].messageHash != bytes32(0)) {
                    cctpTransfers[messageHash].isCompleted = true;
                    cctpTransfers[messageHash].isClaimed = true;
                    
                    emit CCTPTransferCompleted(messageHash, true);
                    emit CCTPTransferClaimed(messageHash, cctpTransfers[messageHash].recipient);
                }
            }
            
            return success;
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("CCTP receive failed: ", reason)));
        }
    }

    /**
     * @dev Gets transfer information by message hash
     * @param messageHash Message hash
     * @return transfer Transfer details
     */
    function getTransfer(bytes32 messageHash) 
        external 
        view 
        returns (CCTPTransfer memory transfer) 
    {
        return cctpTransfers[messageHash];
    }

    /**
     * @dev Checks if a domain is supported
     * @param domain Domain ID to check
     * @return supported True if domain is supported
     */
    function isDomainSupported(uint32 domain) external view returns (bool supported) {
        return supportedDomains[domain];
    }

    /**
     * @dev Gets USDC token address for current chain
     * @return token USDC token address
     */
    function getUSDCToken() external view returns (address token) {
        return usdcTokens[block.chainid];
    }

    /**
     * @dev Gets USDC token address for specific chain
     * @param chainId Chain ID
     * @return token USDC token address
     */
    function getUSDCTokenForChain(uint256 chainId) external view returns (address token) {
        return usdcTokens[chainId];
    }

    /**
     * @dev Estimates transfer fee and time
     * @param amount Transfer amount
     * @param destinationDomain Destination domain
     * @return fee Total fee in USDC
     * @return estimatedTime Estimated transfer time in seconds
     */
    function estimateTransfer(
        uint256 amount,
        uint32 destinationDomain
    ) external view returns (uint256 fee, uint256 estimatedTime) {
        require(supportedDomains[destinationDomain], "Destination domain not supported");
        require(amount >= minTransferAmount, "Amount below minimum");
        require(amount <= maxTransferAmount, "Amount above maximum");

        fee = transferFee;
        
        // CCTP transfers typically take 10-20 minutes
        if (destinationDomain == CrossChainUtils.ETHEREUM_DOMAIN) {
            estimatedTime = 900; // 15 minutes to Ethereum
        } else {
            estimatedTime = 600; // 10 minutes to other chains
        }

        return (fee, estimatedTime);
    }

    /**
     * @dev Adds support for a new domain
     * @param domain Domain ID
     * @param chainId Corresponding chain ID
     */
    function addSupportedDomain(uint32 domain, uint256 chainId) 
        external 
        onlyRole(CCTP_MANAGER_ROLE) 
    {
        supportedDomains[domain] = true;
        emit DomainAdded(domain, chainId);
    }

    /**
     * @dev Sets USDC token address for a chain
     * @param chainId Chain ID
     * @param usdcToken USDC token address
     */
    function setUSDCToken(uint256 chainId, address usdcToken) 
        external 
        onlyRole(CCTP_MANAGER_ROLE) 
    {
        require(usdcToken != address(0), "Invalid USDC token address");
        usdcTokens[chainId] = usdcToken;
    }

    /**
     * @dev Updates transfer limits
     * @param _minAmount New minimum transfer amount
     * @param _maxAmount New maximum transfer amount
     */
    function updateTransferLimits(uint256 _minAmount, uint256 _maxAmount) 
        external 
        onlyRole(CCTP_MANAGER_ROLE) 
    {
        require(_minAmount <= _maxAmount, "Invalid limits");
        require(_minAmount > 0, "Minimum amount must be greater than 0");

        minTransferAmount = _minAmount;
        maxTransferAmount = _maxAmount;

        emit TransferLimitsUpdated(_minAmount, _maxAmount);
    }

    /**
     * @dev Updates transfer fee
     * @param _transferFee New transfer fee in USDC
     */
    function updateTransferFee(uint256 _transferFee) 
        external 
        onlyRole(CCTP_MANAGER_ROLE) 
    {
        require(_transferFee <= 10e6, "Fee too high"); // Max $10 USDC
        transferFee = _transferFee;
    }

    /**
     * @dev Updates fee recipient
     * @param _feeRecipient New fee recipient address
     */
    function updateFeeRecipient(address _feeRecipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Internal function to initialize supported domains
     */
    function _initializeSupportedDomains() internal {
        // Add Circle CCTP supported domains
        supportedDomains[CrossChainUtils.ETHEREUM_DOMAIN] = true;     // Ethereum
        supportedDomains[CrossChainUtils.AVALANCHE_DOMAIN] = true;    // Avalanche
        supportedDomains[CrossChainUtils.OPTIMISM_DOMAIN] = true;     // Optimism
        supportedDomains[CrossChainUtils.ARBITRUM_DOMAIN] = true;     // Arbitrum
        supportedDomains[CrossChainUtils.BASE_DOMAIN] = true;         // Base
    }

    /**
     * @dev Internal function to initialize USDC token addresses
     */
    function _initializeUSDCTokens() internal {
        // Set USDC token addresses for supported chains
        usdcTokens[CrossChainUtils.ETHEREUM_CHAIN_ID] = 0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c;   // USDC on Ethereum
        usdcTokens[CrossChainUtils.AVALANCHE_CHAIN_ID] = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;  // USDC on Avalanche
        usdcTokens[CrossChainUtils.OPTIMISM_CHAIN_ID] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;   // USDC on Optimism
        usdcTokens[CrossChainUtils.ARBITRUM_CHAIN_ID] = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;   // USDC on Arbitrum
        usdcTokens[CrossChainUtils.BASE_CHAIN_ID] = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;       // USDC on Base
    }

    /**
     * @dev Grants vault role to address
     * @param vault Vault address
     */
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(0), "Invalid token address");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
