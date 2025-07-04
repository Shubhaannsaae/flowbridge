// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";

import "./TimeLock.sol";

/**
 * @title FlowBridgeGovernor
 * @dev Governance contract for FlowBridge protocol using OpenZeppelin Governor framework
 * Manages protocol upgrades, parameter changes, and treasury operations
 */
contract FlowBridgeGovernor is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorTimelockControlUpgradeable,
    AccessControlUpgradeable
{
    // Role definitions
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Governance parameters
    struct GovernanceConfig {
        uint256 votingDelay;        // Delay before voting starts (in blocks)
        uint256 votingPeriod;       // Voting period duration (in blocks)
        uint256 proposalThreshold;  // Minimum tokens required to create proposal
        uint256 quorumFraction;     // Quorum as percentage (e.g., 4 = 4%)
        uint256 timelockDelay;      // Timelock delay for execution (in seconds)
    }

    // Emergency governance
    bool public emergencyMode;
    uint256 public emergencyActivatedAt;
    uint256 public constant EMERGENCY_DURATION = 7 days;
    uint256 public constant EMERGENCY_VOTING_PERIOD = 1 days; // 6400 blocks ~= 1 day

    // Protocol contracts under governance
    mapping(address => bool) public managedContracts;
    address[] public contractList;

    // Treasury management
    address public treasury;
    mapping(address => uint256) public treasuryAllocations; // token -> allocation percentage

    // Events
    event EmergencyModeActivated(address indexed activator, uint256 timestamp);
    event EmergencyModeDeactivated(uint256 timestamp);
    event ContractAdded(address indexed contractAddress, string contractType);
    event ContractRemoved(address indexed contractAddress);
    event TreasuryUpdated(address indexed newTreasury);
    event ParametersUpdated(GovernanceConfig newConfig);

    /**
     * @dev Initializes the governance contract
     * @param _token FLOW token address for voting
     * @param _timelock TimeLock contract address
     * @param _config Initial governance configuration
     * @param _treasury Treasury address
     */
    function initialize(
        IVotes _token,
        TimeLockController _timelock,
        GovernanceConfig memory _config,
        address _treasury
    ) public initializer {
        __Governor_init("FlowBridge Governor");
        __GovernorSettings_init(
            _config.votingDelay,
            _config.votingPeriod,
            _config.proposalThreshold
        );
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(_config.quorumFraction);
        __GovernorTimelockControl_init(_timelock);
        __AccessControl_init();

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, address(this));
        _grantRole(EXECUTOR_ROLE, address(0)); // Anyone can execute
        _grantRole(EMERGENCY_ROLE, msg.sender);

        treasury = _treasury;
        emergencyMode = false;
    }

    /**
     * @dev Creates a proposal with enhanced validation
     * @param targets Target contract addresses
     * @param values ETH values for each call
     * @param calldatas Function call data
     * @param description Proposal description
     * @return proposalId Generated proposal ID
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(GovernorUpgradeable, IGovernorUpgradeable) returns (uint256) {
        require(!emergencyMode || hasRole(EMERGENCY_ROLE, msg.sender), "Emergency mode active");
        require(targets.length > 0, "Empty proposal");
        require(targets.length <= 10, "Too many targets"); // Prevent spam

        // Validate targets are managed contracts or treasury operations
        for (uint256 i = 0; i < targets.length; i++) {
            require(
                managedContracts[targets[i]] || 
                targets[i] == treasury || 
                targets[i] == address(timelock()),
                "Invalid target contract"
            );
        }

        return super.propose(targets, values, calldatas, description);
    }

    /**
     * @dev Activates emergency governance mode
     * @param reason Reason for emergency activation
     */
    function activateEmergencyMode(string calldata reason) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        require(!emergencyMode, "Emergency mode already active");
        
        emergencyMode = true;
        emergencyActivatedAt = block.timestamp;

        // Update governance parameters for emergency
        _setVotingPeriod(EMERGENCY_VOTING_PERIOD);
        _setVotingDelay(1); // Immediate voting
        
        emit EmergencyModeActivated(msg.sender, block.timestamp);
    }

    /**
     * @dev Deactivates emergency governance mode
     */
    function deactivateEmergencyMode() external {
        require(emergencyMode, "Emergency mode not active");
        require(
            block.timestamp >= emergencyActivatedAt + EMERGENCY_DURATION ||
            hasRole(EMERGENCY_ROLE, msg.sender),
            "Emergency period not expired"
        );

        emergencyMode = false;
        
        // Restore normal governance parameters
        _setVotingPeriod(7 days); // Restore to 7 days
        _setVotingDelay(1 days);  // Restore to 1 day
        
        emit EmergencyModeDeactivated(block.timestamp);
    }

    /**
     * @dev Adds a contract under governance management
     * @param contractAddress Contract address to manage
     * @param contractType Type of contract (for documentation)
     */
    function addManagedContract(address contractAddress, string calldata contractType) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(contractAddress != address(0), "Invalid contract address");
        require(!managedContracts[contractAddress], "Contract already managed");

        managedContracts[contractAddress] = true;
        contractList.push(contractAddress);

        emit ContractAdded(contractAddress, contractType);
    }

    /**
     * @dev Removes a contract from governance management
     * @param contractAddress Contract address to remove
     */
    function removeManagedContract(address contractAddress) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(managedContracts[contractAddress], "Contract not managed");

        managedContracts[contractAddress] = false;
        
        // Remove from array
        for (uint256 i = 0; i < contractList.length; i++) {
            if (contractList[i] == contractAddress) {
                contractList[i] = contractList[contractList.length - 1];
                contractList.pop();
                break;
            }
        }

        emit ContractRemoved(contractAddress);
    }

    /**
     * @dev Updates treasury address through governance
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) 
        external 
        onlyGovernance 
    {
        require(newTreasury != address(0), "Invalid treasury address");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /**
     * @dev Updates governance parameters through governance
     * @param config New governance configuration
     */
    function updateGovernanceParameters(GovernanceConfig calldata config) 
        external 
        onlyGovernance 
    {
        require(config.votingDelay <= 7 days, "Voting delay too long");
        require(config.votingPeriod >= 1 days && config.votingPeriod <= 30 days, "Invalid voting period");
        require(config.quorumFraction >= 1 && config.quorumFraction <= 20, "Invalid quorum fraction");

        _setVotingDelay(config.votingDelay);
        _setVotingPeriod(config.votingPeriod);
        _setProposalThreshold(config.proposalThreshold);
        _updateQuorumNumerator(config.quorumFraction);

        emit ParametersUpdated(config);
    }

    /**
     * @dev Executes a proposal
     * @param targets Target addresses
     * @param values ETH values
     * @param calldatas Call data
     * @param descriptionHash Description hash
     * @return proposalId Executed proposal ID
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override(GovernorUpgradeable, IGovernorUpgradeable) returns (uint256) {
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev Cancels a proposal
     * @param targets Target addresses
     * @param values ETH values
     * @param calldatas Call data
     * @param descriptionHash Description hash
     * @return proposalId Cancelled proposal ID
     */
    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public returns (uint256) {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender) || 
            msg.sender == _msgSender(),
            "Only emergency role or proposer can cancel"
        );
        
        return _cancel(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev Gets all managed contracts
     * @return contracts Array of managed contract addresses
     */
    function getManagedContracts() external view returns (address[] memory contracts) {
        return contractList;
    }

    /**
     * @dev Gets current governance configuration
     * @return config Current governance parameters
     */
    function getGovernanceConfig() external view returns (GovernanceConfig memory config) {
        return GovernanceConfig({
            votingDelay: votingDelay(),
            votingPeriod: votingPeriod(),
            proposalThreshold: proposalThreshold(),
            quorumFraction: quorumNumerator(),
            timelockDelay: timelock().getMinDelay()
        });
    }

    /**
     * @dev Checks if proposal can be executed immediately (emergency mode)
     * @param proposalId Proposal ID
     * @return canExecute True if can be executed immediately
     */
    function canExecuteImmediately(uint256 proposalId) public view returns (bool canExecute) {
        if (!emergencyMode) return false;
        
        ProposalState state = state(proposalId);
        return state == ProposalState.Succeeded;
    }

    /**
     * @dev Emergency execution bypass (only in emergency mode)
     * @param targets Target addresses
     * @param values ETH values
     * @param calldatas Call data
     * @param descriptionHash Description hash
     */
    function emergencyExecute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external onlyRole(EMERGENCY_ROLE) {
        require(emergencyMode, "Not in emergency mode");
        
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(state(proposalId) == ProposalState.Succeeded, "Proposal not ready");

        _execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    // Required overrides for multiple inheritance

    function votingDelay()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(GovernorUpgradeable, GovernorTimelockControlUpgradeable) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function state(uint256 proposalId)
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    /**
     * @dev Modifier to check if caller is governance
     */
    modifier onlyGovernance() {
        require(_msgSender() == address(this), "Only governance can call");
        _;
    }
}
