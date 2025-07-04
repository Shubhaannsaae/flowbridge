// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ILiFi.sol";
import "../libraries/CrossChainUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title LiFiIntegration
 * @dev Integration contract for LI.FI cross-chain bridge protocol
 * Enables seamless cross-chain transfers within FlowBridge ecosystem
 */
contract LiFiIntegration is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20;
    using SafeMath for uint256;
    using CrossChainUtils for CrossChainUtils.CrossChainRequest;

    // Role definitions
    bytes32 public constant BRIDGE_MANAGER_ROLE = keccak256("BRIDGE_MANAGER_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // LI.FI Diamond proxy address (mainnet)
    address public constant LIFI_DIAMOND = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;
    
    // Bridge configuration
    struct BridgeConfig {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 baseFee;
        uint256 feeRate; // basis points
        bool isActive;
        uint256 estimatedTime; // seconds
    }

    // Cross-chain transfer tracking
    struct CrossChainTransfer {
        bytes32 transactionId;
        address sender;
        address receiver;
        address sourceToken;
        address destinationToken;
        uint256 amount;
        uint256 sourceChainId;
        uint256 destinationChainId;
        uint256 timestamp;
        bool isCompleted;
        string bridge;
    }

    // State variables
    mapping(uint256 => mapping(uint256 => BridgeConfig)) public bridgeConfigs; // sourceChain -> destChain -> config
    mapping(bytes32 => CrossChainTransfer) public transfers; // transactionId -> transfer
    mapping(address => uint256) public userTransferCount;
    
    // Supported chains and tokens
    mapping(uint256 => bool) public supportedChains;
    mapping(address => mapping(uint256 => bool)) public supportedTokens; // token -> chainId -> supported
    
    // LI.FI integration parameters
    string public constant INTEGRATOR = "FlowBridge";
    address public feeRecipient;
    uint256 public slippageTolerance; // basis points

    // Events
    event CrossChainTransferInitiated(
        bytes32 indexed transactionId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        uint256 sourceChainId,
        uint256 destinationChainId
    );
    event CrossChainTransferCompleted(bytes32 indexed transactionId, bool success);
    event BridgeConfigUpdated(uint256 sourceChainId, uint256 destinationChainId, BridgeConfig config);
    event SupportedChainAdded(uint256 chainId);
    event SupportedTokenAdded(address token, uint256 chainId);

    /**
     * @dev Initializes the LI.FI integration contract
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
        _grantRole(BRIDGE_MANAGER_ROLE, _admin);

        feeRecipient = _feeRecipient;
        slippageTolerance = 50; // 0.5% default slippage

        // Initialize supported chains
        _initializeSupportedChains();
    }

    /**
     * @dev Initiates a cross-chain transfer using LI.FI
     * @param request Cross-chain transfer request
     * @return transactionId Unique transaction identifier
     */
    function initiateCrossChainTransfer(
        CrossChainUtils.CrossChainRequest calldata request
    ) external onlyRole(VAULT_ROLE) nonReentrant returns (bytes32 transactionId) {
        require(request.validateCrossChainRequest(), "Invalid cross-chain request");
        require(supportedChains[request.sourceChain], "Source chain not supported");
        require(supportedChains[request.destinationChain], "Destination chain not supported");
        require(supportedTokens[request.sourceToken][request.sourceChain], "Source token not supported");

        // Check bridge configuration
        BridgeConfig storage config = bridgeConfigs[request.sourceChain][request.destinationChain];
        require(config.isActive, "Bridge route not active");
        require(request.amount >= config.minAmount, "Amount below minimum");
        require(request.amount <= config.maxAmount, "Amount above maximum");

        // Generate transaction ID
        transactionId = keccak256(abi.encodePacked(
            request.sourceChain,
            request.destinationChain,
            request.sourceToken,
            request.amount,
            request.recipient,
            block.timestamp,
            userTransferCount[msg.sender]++
        ));

        // Transfer tokens from sender
        IERC20(request.sourceToken).safeTransferFrom(msg.sender, address(this), request.amount);

        // Calculate fees
        uint256 bridgeFee = CrossChainUtils.calculateBridgeFee(
            request.amount,
            config.baseFee,
            config.feeRate
        );

        uint256 transferAmount = request.amount.sub(bridgeFee);

        // Prepare LI.FI bridge data
        ILiFi.BridgeData memory bridgeData = ILiFi.BridgeData({
            transactionId: transactionId,
            bridge: "stargate", // Use Stargate as default bridge
            integrator: INTEGRATOR,
            referrer: address(0),
            sendingAssetId: request.sourceToken,
            receiver: request.recipient,
            minAmount: CrossChainUtils.calculateMinimumAmount(
                transferAmount,
                bridgeFee,
                slippageTolerance
            ),
            destinationChainId: request.destinationChainId,
            hasSourceSwaps: false,
            hasDestinationCall: false
        });

        // Approve LI.FI Diamond for token transfer
        IERC20(request.sourceToken).safeApprove(LIFI_DIAMOND, transferAmount);

        // Execute bridge transaction
        try ILiFi(LIFI_DIAMOND).startBridgeTokensViaBridge{value: msg.value}(bridgeData) {
            // Store transfer record
            transfers[transactionId] = CrossChainTransfer({
                transactionId: transactionId,
                sender: msg.sender,
                receiver: request.recipient,
                sourceToken: request.sourceToken,
                destinationToken: request.destinationToken,
                amount: request.amount,
                sourceChainId: request.sourceChain,
                destinationChainId: request.destinationChain,
                timestamp: block.timestamp,
                isCompleted: false,
                bridge: "stargate"
            });

            emit CrossChainTransferInitiated(
                transactionId,
                msg.sender,
                request.recipient,
                request.amount,
                request.sourceChain,
                request.destinationChain
            );

        } catch Error(string memory reason) {
            // Refund tokens on failure
            IERC20(request.sourceToken).safeTransfer(msg.sender, request.amount);
            revert(string(abi.encodePacked("Bridge failed: ", reason)));
        }

        return transactionId;
    }

    /**
     * @dev Initiates cross-chain transfer with token swap
     * @param request Cross-chain transfer request
     * @param swapData Swap data for source chain DEX
     * @return transactionId Unique transaction identifier
     */
    function swapAndBridge(
        CrossChainUtils.CrossChainRequest calldata request,
        ILiFi.SwapData[] calldata swapData
    ) external onlyRole(VAULT_ROLE) nonReentrant returns (bytes32 transactionId) {
        require(request.validateCrossChainRequest(), "Invalid cross-chain request");
        require(swapData.length > 0, "Swap data required");

        // Generate transaction ID
        transactionId = keccak256(abi.encodePacked(
            request.sourceChain,
            request.destinationChain,
            request.sourceToken,
            request.amount,
            request.recipient,
            block.timestamp,
            userTransferCount[msg.sender]++
        ));

        // Transfer input tokens
        IERC20(swapData[0].sendingAssetId).safeTransferFrom(msg.sender, address(this), swapData[0].fromAmount);

        // Prepare bridge data
        ILiFi.BridgeData memory bridgeData = ILiFi.BridgeData({
            transactionId: transactionId,
            bridge: "stargate",
            integrator: INTEGRATOR,
            referrer: address(0),
            sendingAssetId: request.sourceToken,
            receiver: request.recipient,
            minAmount: request.amount.mul(10000 - slippageTolerance).div(10000),
            destinationChainId: request.destinationChain,
            hasSourceSwaps: true,
            hasDestinationCall: false
        });

        // Approve tokens for LI.FI
        IERC20(swapData[0].sendingAssetId).safeApprove(LIFI_DIAMOND, swapData[0].fromAmount);

        // Execute swap and bridge
        try ILiFi(LIFI_DIAMOND).swapAndStartBridgeTokensViaBridge{value: msg.value}(bridgeData, swapData) {
            // Store transfer record
            transfers[transactionId] = CrossChainTransfer({
                transactionId: transactionId,
                sender: msg.sender,
                receiver: request.recipient,
                sourceToken: swapData[0].sendingAssetId,
                destinationToken: request.destinationToken,
                amount: swapData[0].fromAmount,
                sourceChainId: request.sourceChain,
                destinationChainId: request.destinationChain,
                timestamp: block.timestamp,
                isCompleted: false,
                bridge: "stargate"
            });

            emit CrossChainTransferInitiated(
                transactionId,
                msg.sender,
                request.recipient,
                swapData[0].fromAmount,
                request.sourceChain,
                request.destinationChain
            );

        } catch Error(string memory reason) {
            // Refund tokens on failure
            IERC20(swapData[0].sendingAssetId).safeTransfer(msg.sender, swapData[0].fromAmount);
            revert(string(abi.encodePacked("Swap and bridge failed: ", reason)));
        }

        return transactionId;
    }

    /**
     * @dev Gets quote for cross-chain transfer
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param token Token address
     * @param amount Transfer amount
     * @return fee Estimated bridge fee
     * @return estimatedTime Estimated transfer time
     */
    function getQuote(
        uint256 sourceChain,
        uint256 destinationChain,
        address token,
        uint256 amount
    ) external view returns (uint256 fee, uint256 estimatedTime) {
        require(supportedChains[sourceChain], "Source chain not supported");
        require(supportedChains[destinationChain], "Destination chain not supported");

        BridgeConfig storage config = bridgeConfigs[sourceChain][destinationChain];
        require(config.isActive, "Bridge route not active");

        fee = CrossChainUtils.calculateBridgeFee(amount, config.baseFee, config.feeRate);
        estimatedTime = config.estimatedTime;

        return (fee, estimatedTime);
    }

    /**
     * @dev Checks if a cross-chain route is supported
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param token Token address
     * @return supported True if route is supported
     */
    function isRouteSupported(
        uint256 sourceChain,
        uint256 destinationChain,
        address token
    ) external view returns (bool supported) {
        return supportedChains[sourceChain] &&
               supportedChains[destinationChain] &&
               supportedTokens[token][sourceChain] &&
               bridgeConfigs[sourceChain][destinationChain].isActive;
    }

    /**
     * @dev Updates bridge configuration for a route
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param config Bridge configuration
     */
    function updateBridgeConfig(
        uint256 sourceChain,
        uint256 destinationChain,
        BridgeConfig calldata config
    ) external onlyRole(BRIDGE_MANAGER_ROLE) {
        require(supportedChains[sourceChain], "Source chain not supported");
        require(supportedChains[destinationChain], "Destination chain not supported");
        require(config.minAmount <= config.maxAmount, "Invalid amount limits");

        bridgeConfigs[sourceChain][destinationChain] = config;
        emit BridgeConfigUpdated(sourceChain, destinationChain, config);
    }

    /**
     * @dev Adds support for a new chain
     * @param chainId Chain ID to add
     */
    function addSupportedChain(uint256 chainId) external onlyRole(BRIDGE_MANAGER_ROLE) {
        require(CrossChainUtils.isSupportedChain(chainId), "Chain not supported by utils");
        
        supportedChains[chainId] = true;
        emit SupportedChainAdded(chainId);
    }

    /**
     * @dev Adds support for a token on a specific chain
     * @param token Token address
     * @param chainId Chain ID
     */
    function addSupportedToken(
        address token,
        uint256 chainId
    ) external onlyRole(BRIDGE_MANAGER_ROLE) {
        require(supportedChains[chainId], "Chain not supported");
        require(token != address(0), "Invalid token address");

        supportedTokens[token][chainId] = true;
        emit SupportedTokenAdded(token, chainId);
    }

    /**
     * @dev Marks a transfer as completed (called by bridge)
     * @param transactionId Transaction ID
     * @param success Whether transfer was successful
     */
    function completeTransfer(
        bytes32 transactionId,
        bool success
    ) external onlyRole(BRIDGE_MANAGER_ROLE) {
        require(transfers[transactionId].transactionId != bytes32(0), "Transfer not found");
        
        transfers[transactionId].isCompleted = true;
        emit CrossChainTransferCompleted(transactionId, success);
    }

    /**
     * @dev Gets transfer information
     * @param transactionId Transaction ID
     * @return transfer Transfer data
     */
    function getTransfer(bytes32 transactionId) 
        external 
        view 
        returns (CrossChainTransfer memory transfer) 
    {
        return transfers[transactionId];
    }

    /**
     * @dev Gets bridge configuration for a route
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @return config Bridge configuration
     */
    function getBridgeConfig(
        uint256 sourceChain,
        uint256 destinationChain
    ) external view returns (BridgeConfig memory config) {
        return bridgeConfigs[sourceChain][destinationChain];
    }

    /**
     * @dev Updates slippage tolerance
     * @param newSlippage New slippage tolerance in basis points
     */
    function updateSlippageTolerance(uint256 newSlippage) 
        external 
        onlyRole(BRIDGE_MANAGER_ROLE) 
    {
        require(newSlippage <= 1000, "Slippage too high"); // Max 10%
        slippageTolerance = newSlippage;
    }

    /**
     * @dev Updates fee recipient
     * @param newFeeRecipient New fee recipient address
     */
    function updateFeeRecipient(address newFeeRecipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newFeeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = newFeeRecipient;
    }

    /**
     * @dev Internal function to initialize supported chains
     */
    function _initializeSupportedChains() internal {
        // Add major supported chains
        supportedChains[CrossChainUtils.ETHEREUM_CHAIN_ID] = true;
        supportedChains[CrossChainUtils.POLYGON_CHAIN_ID] = true;
        supportedChains[CrossChainUtils.ARBITRUM_CHAIN_ID] = true;
        supportedChains[CrossChainUtils.OPTIMISM_CHAIN_ID] = true;
        supportedChains[CrossChainUtils.BASE_CHAIN_ID] = true;
        supportedChains[CrossChainUtils.AVALANCHE_CHAIN_ID] = true;

        // Initialize default bridge configs
        _initializeDefaultConfigs();
    }

    /**
     * @dev Internal function to initialize default bridge configurations
     */
    function _initializeDefaultConfigs() internal {
        // Ethereum to Polygon
        bridgeConfigs[CrossChainUtils.ETHEREUM_CHAIN_ID][CrossChainUtils.POLYGON_CHAIN_ID] = BridgeConfig({
            minAmount: 1e6,      // $1 USDC
            maxAmount: 1e12,     // $1M USDC
            baseFee: 5e6,        // $5 USDC
            feeRate: 10,         // 0.1%
            isActive: true,
            estimatedTime: 900   // 15 minutes
        });

        // Ethereum to Arbitrum
        bridgeConfigs[CrossChainUtils.ETHEREUM_CHAIN_ID][CrossChainUtils.ARBITRUM_CHAIN_ID] = BridgeConfig({
            minAmount: 1e6,      // $1 USDC
            maxAmount: 1e12,     // $1M USDC
            baseFee: 3e6,        // $3 USDC
            feeRate: 5,          // 0.05%
            isActive: true,
            estimatedTime: 600   // 10 minutes
        });

        // Add more default configurations as needed
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Grants vault role to address
     * @param vault Vault address
     */
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }

    /**
     * @dev Receive function to handle ETH transfers
     */
    receive() external payable {
        // Allow contract to receive ETH for gas fees
    }
}
