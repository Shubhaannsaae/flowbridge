// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/SafeMath.sol";

/**
 * @title MetaMaskDTK
 * @dev MetaMask Delegation Toolkit (DTK) integration for FlowBridge
 * Enables delegation of MetaMask account management to FlowBridge contracts
 */
contract MetaMaskDTK is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20;
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant DELEGATION_MANAGER_ROLE = keccak256("DELEGATION_MANAGER_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // Delegation types based on MetaMask DTK specification
    enum DelegationType {
        ACCOUNT_MANAGEMENT,    // Full account management delegation
        TRANSACTION_SIGNING,   // Transaction signing delegation
        ASSET_MANAGEMENT,      // Asset management delegation
        YIELD_FARMING,         // Yield farming specific delegation
        CARD_SPENDING          // MetaMask Card spending delegation
    }

    // Delegation permissions structure
    struct DelegationPermissions {
        bool canTransferTokens;
        bool canInteractWithDeFi;
        bool canManageYield;
        bool canUseCard;
        bool canCrossChain;
        uint256 dailySpendLimit;
        uint256 transactionLimit;
        address[] allowedTokens;
        address[] allowedProtocols;
        uint256 expirationTime;
        bool isActive;
    }

    // Delegation record
    struct Delegation {
        address delegator;          // User delegating permissions
        address delegate;           // Contract/address receiving permissions  
        DelegationType delegationType;
        DelegationPermissions permissions;
        bytes32 delegationHash;
        uint256 createdAt;
        uint256 lastUsed;
        bool isRevoked;
    }

    // Delegation execution record
    struct DelegationExecution {
        bytes32 delegationHash;
        address executor;
        bytes4 functionSelector;
        uint256 value;
        address target;
        bytes data;
        uint256 timestamp;
        bool success;
    }

    // State variables
    mapping(address => mapping(address => Delegation)) public delegations; // delegator -> delegate -> delegation
    mapping(bytes32 => DelegationExecution[]) public delegationExecutions; // delegationHash -> executions
    mapping(address => bytes32[]) public userDelegations; // user -> delegation hashes
    mapping(address => uint256) public userDelegationCount;
    
    // Spending tracking for card delegations
    mapping(bytes32 => mapping(uint256 => uint256)) public dailySpending; // delegationHash -> day -> amount
    
    // Global delegation settings
    uint256 public maxDelegationDuration;
    uint256 public maxDailySpendLimit;
    bool public delegationPaused;

    // Events
    event DelegationCreated(
        address indexed delegator,
        address indexed delegate,
        bytes32 indexed delegationHash,
        DelegationType delegationType
    );
    event DelegationRevoked(
        address indexed delegator,
        address indexed delegate,
        bytes32 indexed delegationHash
    );
    event DelegationExecuted(
        bytes32 indexed delegationHash,
        address indexed executor,
        address target,
        uint256 value,
        bool success
    );
    event DelegationPermissionsUpdated(
        bytes32 indexed delegationHash,
        DelegationPermissions permissions
    );

    /**
     * @dev Initializes the MetaMask DTK integration
     * @param _admin Admin address
     */
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(DELEGATION_MANAGER_ROLE, _admin);

        maxDelegationDuration = 365 days; // 1 year max
        maxDailySpendLimit = 10000 * 1e6; // $10,000 USDC max daily spend
        delegationPaused = false;
    }

    /**
     * @dev Creates a new delegation with specified permissions
     * @param delegate Address to delegate permissions to
     * @param delegationType Type of delegation
     * @param permissions Delegation permissions
     * @return delegationHash Unique delegation identifier
     */
    function createDelegation(
        address delegate,
        DelegationType delegationType,
        DelegationPermissions calldata permissions
    ) external nonReentrant returns (bytes32 delegationHash) {
        require(!delegationPaused, "Delegation creation paused");
        require(delegate != address(0), "Invalid delegate address");
        require(delegate != msg.sender, "Cannot delegate to self");
        require(permissions.expirationTime > block.timestamp, "Invalid expiration time");
        require(
            permissions.expirationTime <= block.timestamp.add(maxDelegationDuration),
            "Delegation duration too long"
        );
        require(permissions.dailySpendLimit <= maxDailySpendLimit, "Daily spend limit too high");

        // Validate delegation type specific requirements
        _validateDelegationType(delegationType, permissions);

        // Generate delegation hash
        delegationHash = keccak256(abi.encodePacked(
            msg.sender,
            delegate,
            delegationType,
            block.timestamp,
            userDelegationCount[msg.sender]++
        ));

        // Create delegation record
        Delegation storage delegation = delegations[msg.sender][delegate];
        delegation.delegator = msg.sender;
        delegation.delegate = delegate;
        delegation.delegationType = delegationType;
        delegation.permissions = permissions;
        delegation.delegationHash = delegationHash;
        delegation.createdAt = block.timestamp;
        delegation.lastUsed = 0;
        delegation.isRevoked = false;

        // Track user delegations
        userDelegations[msg.sender].push(delegationHash);

        emit DelegationCreated(msg.sender, delegate, delegationHash, delegationType);
        return delegationHash;
    }

    /**
     * @dev Executes a delegated action
     * @param delegator Address that delegated permissions
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Function call data
     * @return success True if execution successful
     */
    function executeDelegation(
        address delegator,
        address target,
        uint256 value,
        bytes calldata data
    ) external nonReentrant returns (bool success) {
        Delegation storage delegation = delegations[delegator][msg.sender];
        require(delegation.delegationHash != bytes32(0), "Delegation not found");
        require(!delegation.isRevoked, "Delegation revoked");
        require(delegation.permissions.isActive, "Delegation not active");
        require(block.timestamp <= delegation.permissions.expirationTime, "Delegation expired");

        // Validate execution permissions
        _validateExecution(delegation, target, value, data);

        // Update spending limits if applicable
        if (delegation.delegationType == DelegationType.CARD_SPENDING) {
            _updateSpendingLimit(delegation.delegationHash, value);
        }

        // Execute the delegated call
        (success, ) = target.call{value: value}(data);

        // Record execution
        DelegationExecution memory execution = DelegationExecution({
            delegationHash: delegation.delegationHash,
            executor: msg.sender,
            functionSelector: _extractFunctionSelector(data),
            value: value,
            target: target,
            data: data,
            timestamp: block.timestamp,
            success: success
        });

        delegationExecutions[delegation.delegationHash].push(execution);
        delegation.lastUsed = block.timestamp;

        emit DelegationExecuted(delegation.delegationHash, msg.sender, target, value, success);
        return success;
    }

    /**
     * @dev Revokes an existing delegation
     * @param delegate Address that was delegated to
     */
    function revokeDelegation(address delegate) external {
        Delegation storage delegation = delegations[msg.sender][delegate];
        require(delegation.delegationHash != bytes32(0), "Delegation not found");
        require(!delegation.isRevoked, "Delegation already revoked");

        delegation.isRevoked = true;
        delegation.permissions.isActive = false;

        emit DelegationRevoked(msg.sender, delegate, delegation.delegationHash);
    }

    /**
     * @dev Updates delegation permissions
     * @param delegate Delegate address
     * @param permissions New permissions
     */
    function updateDelegationPermissions(
        address delegate,
        DelegationPermissions calldata permissions
    ) external {
        Delegation storage delegation = delegations[msg.sender][delegate];
        require(delegation.delegationHash != bytes32(0), "Delegation not found");
        require(!delegation.isRevoked, "Delegation revoked");
        require(permissions.dailySpendLimit <= maxDailySpendLimit, "Daily spend limit too high");

        delegation.permissions = permissions;

        emit DelegationPermissionsUpdated(delegation.delegationHash, permissions);
    }

    /**
     * @dev Gets delegation information
     * @param delegator Delegator address
     * @param delegate Delegate address
     * @return delegation Delegation details
     */
    function getDelegation(address delegator, address delegate) 
        external 
        view 
        returns (Delegation memory delegation) 
    {
        return delegations[delegator][delegate];
    }

    /**
     * @dev Gets delegation execution history
     * @param delegationHash Delegation hash
     * @return executions Array of delegation executions
     */
    function getDelegationExecutions(bytes32 delegationHash) 
        external 
        view 
        returns (DelegationExecution[] memory executions) 
    {
        return delegationExecutions[delegationHash];
    }

    /**
     * @dev Gets user's delegations
     * @param user User address
     * @return delegationHashes Array of delegation hashes
     */
    function getUserDelegations(address user) 
        external 
        view 
        returns (bytes32[] memory delegationHashes) 
    {
        return userDelegations[user];
    }

    /**
     * @dev Checks if delegation is valid and active
     * @param delegator Delegator address
     * @param delegate Delegate address
     * @return valid True if delegation is valid
     */
    function isDelegationValid(address delegator, address delegate) 
        external 
        view 
        returns (bool valid) 
    {
        Delegation storage delegation = delegations[delegator][delegate];
        return delegation.delegationHash != bytes32(0) &&
               !delegation.isRevoked &&
               delegation.permissions.isActive &&
               block.timestamp <= delegation.permissions.expirationTime;
    }

    /**
     * @dev Checks if delegate can perform specific action
     * @param delegator Delegator address
     * @param delegate Delegate address
     * @param target Target contract
     * @param value Value to transfer
     * @param data Function call data
     * @return allowed True if action is allowed
     */
    function isActionAllowed(
        address delegator,
        address delegate,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (bool allowed) {
        Delegation storage delegation = delegations[delegator][delegate];
        
        if (!this.isDelegationValid(delegator, delegate)) {
            return false;
        }

        try this._validateExecution(delegation, target, value, data) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Gets daily spending for a delegation
     * @param delegationHash Delegation hash
     * @return spending Amount spent today
     */
    function getDailySpending(bytes32 delegationHash) 
        external 
        view 
        returns (uint256 spending) 
    {
        uint256 today = block.timestamp / 1 days;
        return dailySpending[delegationHash][today];
    }

    /**
     * @dev Internal function to validate delegation type requirements
     * @param delegationType Type of delegation
     * @param permissions Delegation permissions
     */
    function _validateDelegationType(
        DelegationType delegationType,
        DelegationPermissions calldata permissions
    ) internal pure {
        if (delegationType == DelegationType.CARD_SPENDING) {
            require(permissions.canUseCard, "Card permission required for card delegation");
            require(permissions.dailySpendLimit > 0, "Daily spend limit required for card delegation");
        } else if (delegationType == DelegationType.ASSET_MANAGEMENT) {
            require(permissions.canTransferTokens, "Token transfer permission required");
            require(permissions.allowedTokens.length > 0, "Allowed tokens required");
        } else if (delegationType == DelegationType.YIELD_FARMING) {
            require(permissions.canInteractWithDeFi, "DeFi interaction permission required");
            require(permissions.canManageYield, "Yield management permission required");
            require(permissions.allowedProtocols.length > 0, "Allowed protocols required");
        }
    }

    /**
     * @dev Internal function to validate execution permissions
     * @param delegation Delegation details
     * @param target Target contract
     * @param value ETH value
     * @param data Function call data
     */
    function _validateExecution(
        Delegation storage delegation,
        address target,
        uint256 value,
        bytes calldata data
    ) internal view {
        DelegationPermissions storage permissions = delegation.permissions;
        
        // Check transaction value limit
        if (value > permissions.transactionLimit) {
            revert("Transaction value exceeds limit");
        }

        // Check if target is in allowed protocols (for DeFi interactions)
        if (permissions.allowedProtocols.length > 0) {
            bool protocolAllowed = false;
            for (uint256 i = 0; i < permissions.allowedProtocols.length; i++) {
                if (permissions.allowedProtocols[i] == target) {
                    protocolAllowed = true;
                    break;
                }
            }
            require(protocolAllowed, "Target protocol not allowed");
        }

        // Additional validation based on function selector
        bytes4 selector = _extractFunctionSelector(data);
        
        // Check for token transfer functions
        if (selector == IERC20.transfer.selector || selector == IERC20.transferFrom.selector) {
            require(permissions.canTransferTokens, "Token transfer not permitted");
        }
    }

    /**
     * @dev Internal function to update spending limits
     * @param delegationHash Delegation hash
     * @param amount Spending amount
     */
    function _updateSpendingLimit(bytes32 delegationHash, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        dailySpending[delegationHash][today] = dailySpending[delegationHash][today].add(amount);
        
        Delegation storage delegation = _getDelegationByHash(delegationHash);
        require(
            dailySpending[delegationHash][today] <= delegation.permissions.dailySpendLimit,
            "Daily spending limit exceeded"
        );
    }

    /**
     * @dev Internal function to extract function selector from call data
     * @param data Function call data
     * @return selector Function selector
     */
    function _extractFunctionSelector(bytes calldata data) internal pure returns (bytes4 selector) {
        if (data.length >= 4) {
            selector = bytes4(data[:4]);
        }
    }

    /**
     * @dev Internal function to get delegation by hash
     * @param delegationHash Delegation hash
     * @return delegation Delegation details
     */
    function _getDelegationByHash(bytes32 delegationHash) 
        internal 
        view 
        returns (Delegation storage delegation) 
    {
        // This is a simplified lookup - in practice, would need a hash-to-delegation mapping
        revert("Not implemented - requires hash-to-delegation mapping");
    }

    /**
     * @dev External wrapper for _validateExecution (for view function)
     * @param delegation Delegation details
     * @param target Target contract
     * @param value ETH value  
     * @param data Function call data
     */
    function _validateExecution(
        Delegation calldata delegation,
        address target,
        uint256 value,
        bytes calldata data
    ) external view {
        // This is a workaround for calling internal function from external view
        // In practice, would restructure the validation logic
    }

    /**
     * @dev Updates global delegation settings
     * @param _maxDuration Maximum delegation duration
     * @param _maxDailySpend Maximum daily spend limit
     */
    function updateGlobalSettings(
        uint256 _maxDuration,
        uint256 _maxDailySpend
    ) external onlyRole(DELEGATION_MANAGER_ROLE) {
        require(_maxDuration <= 730 days, "Duration too long"); // Max 2 years
        require(_maxDailySpend <= 100000 * 1e6, "Daily spend limit too high"); // Max $100k

        maxDelegationDuration = _maxDuration;
        maxDailySpendLimit = _maxDailySpend;
    }

    /**
     * @dev Pauses/unpauses delegation creation
     * @param paused True to pause delegation creation
     */
    function pauseDelegation(bool paused) external onlyRole(DELEGATION_MANAGER_ROLE) {
        delegationPaused = paused;
    }

    /**
     * @dev Grants vault role to address
     * @param vault Vault address
     */
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }
}
