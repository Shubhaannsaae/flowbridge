// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title TimeLockController
 * @dev Enhanced TimeLock controller for FlowBridge governance with emergency features
 * Provides delayed execution of governance proposals with emergency bypass capabilities
 */
contract TimeLockController is 
    Initializable,
    TimelockControllerUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Additional roles for enhanced functionality
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // Emergency state management
    bool public emergencyMode;
    uint256 public emergencyActivatedAt;
    uint256 public constant EMERGENCY_DURATION = 7 days;
    uint256 public emergencyDelay; // Reduced delay during emergency

    // Operation tracking
    struct Operation {
        address target;
        uint256 value;
        bytes data;
        uint256 scheduledAt;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
        string description;
    }

    mapping(bytes32 => Operation) public operations;
    bytes32[] public operationIds;

    // Security features
    mapping(address => bool) public blacklistedTargets;
    mapping(bytes4 => bool) public blacklistedSelectors;
    uint256 public maxOperationValue; // Maximum ETH value per operation

    // Events
    event EmergencyModeActivated(address indexed activator, uint256 timestamp);
    event EmergencyModeDeactivated(uint256 timestamp);
    event OperationScheduledExtended(
        bytes32 indexed id,
        address indexed target,
        uint256 value,
        bytes data,
        string description,
        uint256 delay
    );
    event OperationExecutedExtended(bytes32 indexed id, address indexed target, uint256 value);
    event OperationCancelledExtended(bytes32 indexed id, string reason);
    event TargetBlacklisted(address indexed target, bool blacklisted);
    event SelectorBlacklisted(bytes4 indexed selector, bool blacklisted);
    event MaxOperationValueUpdated(uint256 newMaxValue);

    /**
     * @dev Initializes the TimeLock controller
     * @param minDelay Minimum delay for operations
     * @param proposers Addresses that can schedule operations
     * @param executors Addresses that can execute operations
     * @param admin Admin address (should be governance contract)
     */
    function initialize(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) public initializer {
        __TimelockController_init(minDelay, proposers, executors, admin);
        __ReentrancyGuard_init();

        // Set emergency parameters
        emergencyDelay = 1 hours; // 1 hour delay in emergency mode
        maxOperationValue = 1000 ether; // 1000 ETH max per operation

        // Grant roles
        if (admin != address(0)) {
            _grantRole(EMERGENCY_ROLE, admin);
            _grantRole(GUARDIAN_ROLE, admin);
        }
    }

    /**
     * @dev Schedules an operation with enhanced tracking
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     * @param predecessor Previous operation dependency
     * @param salt Unique salt for operation ID
     * @param delay Execution delay
     * @param description Human readable description
     * @return operationId Generated operation ID
     */
    function scheduleWithDescription(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay,
        string calldata description
    ) external onlyRole(PROPOSER_ROLE) returns (bytes32 operationId) {
        require(!blacklistedTargets[target], "Target is blacklisted");
        require(value <= maxOperationValue, "Operation value too high");
        
        // Check function selector if data provided
        if (data.length >= 4) {
            bytes4 selector = bytes4(data[:4]);
            require(!blacklistedSelectors[selector], "Function selector blacklisted");
        }

        // Use emergency delay if in emergency mode
        uint256 actualDelay = emergencyMode ? emergencyDelay : delay;
        require(actualDelay >= getMinDelay(), "Delay too short");

        operationId = hashOperation(target, value, data, predecessor, salt);
        
        // Schedule the operation
        _schedule(operationId, actualDelay);

        // Store operation details
        operations[operationId] = Operation({
            target: target,
            value: value,
            data: data,
            scheduledAt: block.timestamp,
            executeAfter: block.timestamp + actualDelay,
            executed: false,
            cancelled: false,
            description: description
        });

        operationIds.push(operationId);

        emit OperationScheduledExtended(operationId, target, value, data, description, actualDelay);
        return operationId;
    }

    /**
     * @dev Schedules a batch of operations
     * @param targets Target contract addresses
     * @param values ETH values to send
     * @param payloads Call data array
     * @param predecessor Previous operation dependency
     * @param salt Unique salt for operation ID
     * @param delay Execution delay
     * @param description Human readable description
     * @return operationId Generated operation ID
     */
    function scheduleBatchWithDescription(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay,
        string calldata description
    ) external onlyRole(PROPOSER_ROLE) returns (bytes32 operationId) {
        require(targets.length == values.length && targets.length == payloads.length, "Array length mismatch");
        require(targets.length <= 10, "Too many operations"); // Prevent gas issues

        // Validate all targets and values
        uint256 totalValue = 0;
        for (uint256 i = 0; i < targets.length; i++) {
            require(!blacklistedTargets[targets[i]], "Target is blacklisted");
            totalValue += values[i];
            
            if (payloads[i].length >= 4) {
                bytes4 selector = bytes4(payloads[i][:4]);
                require(!blacklistedSelectors[selector], "Function selector blacklisted");
            }
        }
        require(totalValue <= maxOperationValue, "Total operation value too high");

        uint256 actualDelay = emergencyMode ? emergencyDelay : delay;
        require(actualDelay >= getMinDelay(), "Delay too short");

        operationId = hashOperationBatch(targets, values, payloads, predecessor, salt);
        
        _schedule(operationId, actualDelay);

        // Store batch operation (simplified for gas efficiency)
        operations[operationId] = Operation({
            target: address(0), // Batch indicator
            value: totalValue,
            data: abi.encode(targets, values, payloads),
            scheduledAt: block.timestamp,
            executeAfter: block.timestamp + actualDelay,
            executed: false,
            cancelled: false,
            description: description
        });

        operationIds.push(operationId);

        emit OperationScheduledExtended(operationId, address(0), totalValue, abi.encode(targets, values, payloads), description, actualDelay);
        return operationId;
    }

    /**
     * @dev Executes a scheduled operation
     * @param target Target contract address
     * @param value ETH value to send
     * @param payload Call data
     * @param predecessor Previous operation dependency
     * @param salt Unique salt for operation ID
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    ) public payable override nonReentrant {
        bytes32 operationId = hashOperation(target, value, payload, predecessor, salt);
        require(isOperationReady(operationId), "Operation not ready");
        require(!operations[operationId].executed, "Operation already executed");
        require(!operations[operationId].cancelled, "Operation cancelled");

        // Execute the operation
        super.execute(target, value, payload, predecessor, salt);

        // Update operation status
        operations[operationId].executed = true;

        emit OperationExecutedExtended(operationId, target, value);
    }

    /**
     * @dev Executes a batch of operations
     * @param targets Target contract addresses
     * @param values ETH values to send
     * @param payloads Call data array
     * @param predecessor Previous operation dependency
     * @param salt Unique salt for operation ID
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) public payable override nonReentrant {
        bytes32 operationId = hashOperationBatch(targets, values, payloads, predecessor, salt);
        require(isOperationReady(operationId), "Operation not ready");
        require(!operations[operationId].executed, "Operation already executed");
        require(!operations[operationId].cancelled, "Operation cancelled");

        // Execute the batch
        super.executeBatch(targets, values, payloads, predecessor, salt);

        // Update operation status
        operations[operationId].executed = true;

        uint256 totalValue = 0;
        for (uint256 i = 0; i < values.length; i++) {
            totalValue += values[i];
        }

        emit OperationExecutedExtended(operationId, address(0), totalValue);
    }

    /**
     * @dev Cancels a scheduled operation
     * @param id Operation ID to cancel
     * @param reason Reason for cancellation
     */
    function cancel(bytes32 id, string calldata reason) 
        external 
        onlyRole(GUARDIAN_ROLE) 
    {
        require(isOperationPending(id), "Operation not pending");
        require(!operations[id].cancelled, "Operation already cancelled");

        _cancel(id);
        operations[id].cancelled = true;

        emit OperationCancelledExtended(id, reason);
    }

    /**
     * @dev Activates emergency mode
     * @param reason Reason for emergency activation
     */
    function activateEmergencyMode(string calldata reason) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        require(!emergencyMode, "Emergency mode already active");
        
        emergencyMode = true;
        emergencyActivatedAt = block.timestamp;

        emit EmergencyModeActivated(msg.sender, block.timestamp);
    }

    /**
     * @dev Deactivates emergency mode
     */
    function deactivateEmergencyMode() external {
        require(emergencyMode, "Emergency mode not active");
        require(
            block.timestamp >= emergencyActivatedAt + EMERGENCY_DURATION ||
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Emergency period not expired"
        );

        emergencyMode = false;
        
        emit EmergencyModeDeactivated(block.timestamp);
    }

    /**
     * @dev Blacklists a target contract
     * @param target Target contract address
     * @param blacklisted True to blacklist, false to remove
     */
    function setTargetBlacklist(address target, bool blacklisted) 
        external 
        onlyRole(GUARDIAN_ROLE) 
    {
        blacklistedTargets[target] = blacklisted;
        emit TargetBlacklisted(target, blacklisted);
    }

    /**
     * @dev Blacklists a function selector
     * @param selector Function selector to blacklist
     * @param blacklisted True to blacklist, false to remove
     */
    function setSelectorBlacklist(bytes4 selector, bool blacklisted) 
        external 
        onlyRole(GUARDIAN_ROLE) 
    {
        blacklistedSelectors[selector] = blacklisted;
        emit SelectorBlacklisted(selector, blacklisted);
    }

    /**
     * @dev Updates maximum operation value
     * @param newMaxValue New maximum value
     */
    function updateMaxOperationValue(uint256 newMaxValue) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newMaxValue > 0, "Max value must be positive");
        maxOperationValue = newMaxValue;
        emit MaxOperationValueUpdated(newMaxValue);
    }

    /**
     * @dev Updates emergency delay
     * @param newEmergencyDelay New emergency delay in seconds
     */
    function updateEmergencyDelay(uint256 newEmergencyDelay) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newEmergencyDelay >= 1 hours, "Emergency delay too short");
        require(newEmergencyDelay <= 1 days, "Emergency delay too long");
        emergencyDelay = newEmergencyDelay;
    }

    /**
     * @dev Gets operation details
     * @param operationId Operation ID
     * @return operation Operation details
     */
    function getOperation(bytes32 operationId) 
        external 
        view 
        returns (Operation memory operation) 
    {
        return operations[operationId];
    }

    /**
     * @dev Gets all operation IDs
     * @return ids Array of operation IDs
     */
    function getAllOperationIds() external view returns (bytes32[] memory ids) {
        return operationIds;
    }

    /**
     * @dev Gets pending operations count
     * @return count Number of pending operations
     */
    function getPendingOperationsCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < operationIds.length; i++) {
            if (isOperationPending(operationIds[i])) {
                count++;
            }
        }
    }

    /**
     * @dev Gets ready operations count
     * @return count Number of ready operations
     */
    function getReadyOperationsCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < operationIds.length; i++) {
            if (isOperationReady(operationIds[i])) {
                count++;
            }
        }
    }

    /**
     * @dev Checks if emergency bypass is available
     * @param operationId Operation ID
     * @return available True if emergency bypass is available
     */
    function isEmergencyBypassAvailable(bytes32 operationId) 
        external 
        view 
        returns (bool available) 
    {
        return emergencyMode && 
               isOperationPending(operationId) && 
               block.timestamp >= operations[operationId].scheduledAt + emergencyDelay;
    }

    /**
     * @dev Emergency execution bypass (reduced delay)
     * @param target Target contract address
     * @param value ETH value to send
     * @param payload Call data
     * @param predecessor Previous operation dependency
     * @param salt Unique salt for operation ID
     */
    function emergencyExecute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    ) external payable onlyRole(EMERGENCY_ROLE) nonReentrant {
        require(emergencyMode, "Not in emergency mode");
        
        bytes32 operationId = hashOperation(target, value, payload, predecessor, salt);
        require(isOperationPending(operationId), "Operation not pending");
        require(
            block.timestamp >= operations[operationId].scheduledAt + emergencyDelay,
            "Emergency delay not met"
        );

        // Force operation to ready state for execution
        _schedule(operationId, 0);
        
        // Execute immediately
        this.execute(target, value, payload, predecessor, salt);
    }

    /**
     * @dev Receives ETH for operations
     */
    receive() external payable {
        // Allow contract to receive ETH for operations
    }
}
