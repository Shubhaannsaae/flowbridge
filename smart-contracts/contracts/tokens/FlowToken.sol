// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../libraries/SafeMath.sol";

/**
 * @title FlowToken
 * @dev Governance token for FlowBridge protocol with voting capabilities
 * ERC20 token with voting, burning, and pausing features for DAO governance
 */
contract FlowToken is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20VotesUpgradeable,
    ERC20PermitUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // Token economics
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 1e18; // 100 million initial supply
    
    // Emission schedule
    struct EmissionSchedule {
        uint256 startTime;
        uint256 endTime;
        uint256 tokensPerSecond;
        bool isActive;
    }

    EmissionSchedule[] public emissionSchedules;
    uint256 public totalEmitted;
    uint256 public lastEmissionTime;

    // Staking rewards
    mapping(address => uint256) public stakedBalances;
    mapping(address => uint256) public stakingRewards;
    mapping(address => uint256) public lastStakeTime;
    
    uint256 public totalStaked;
    uint256 public stakingRewardRate; // Tokens per second per staked token
    uint256 public minimumStakeDuration; // Minimum time to stake

    // Treasury allocation
    address public treasury;
    uint256 public treasuryAllocation; // Percentage in basis points

    // Events
    event EmissionScheduleAdded(uint256 indexed scheduleId, uint256 startTime, uint256 endTime, uint256 tokensPerSecond);
    event TokensEmitted(uint256 amount, uint256 timestamp);
    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event TreasuryUpdated(address indexed newTreasury);
    event StakingParametersUpdated(uint256 rewardRate, uint256 minimumDuration);

    /**
     * @dev Initializes the FLOW token
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _treasury Treasury address for allocations
     * @param _initialRecipient Initial token recipient
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        address _treasury,
        address _initialRecipient
    ) public initializer {
        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();
        __ERC20Votes_init();
        __ERC20Permit_init(_name);
        __AccessControl_init();
        __Pausable_init();

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, _treasury);

        treasury = _treasury;
        treasuryAllocation = 1000; // 10% to treasury
        stakingRewardRate = 1e15; // 0.001 tokens per second per staked token
        minimumStakeDuration = 7 days;
        lastEmissionTime = block.timestamp;

        // Mint initial supply
        _mint(_initialRecipient, INITIAL_SUPPLY);
    }

    /**
     * @dev Mints new tokens according to emission schedule
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply().add(amount) <= MAX_SUPPLY, "Exceeds maximum supply");
        
        _mint(to, amount);
        
        // Allocate percentage to treasury
        if (treasuryAllocation > 0 && treasury != address(0)) {
            uint256 treasuryAmount = amount.mul(treasuryAllocation).div(10000);
            if (totalSupply().add(treasuryAmount) <= MAX_SUPPLY) {
                _mint(treasury, treasuryAmount);
            }
        }
    }

    /**
     * @dev Processes automatic token emission based on schedule
     */
    function processEmission() external {
        require(block.timestamp > lastEmissionTime, "No emission due");
        
        uint256 totalToEmit = 0;
        uint256 currentTime = block.timestamp;
        
        for (uint256 i = 0; i < emissionSchedules.length; i++) {
            EmissionSchedule storage schedule = emissionSchedules[i];
            
            if (!schedule.isActive) continue;
            if (currentTime < schedule.startTime) continue;
            
            uint256 emissionStart = schedule.startTime > lastEmissionTime ? schedule.startTime : lastEmissionTime;
            uint256 emissionEnd = currentTime > schedule.endTime ? schedule.endTime : currentTime;
            
            if (emissionEnd > emissionStart) {
                uint256 duration = emissionEnd.sub(emissionStart);
                uint256 scheduleEmission = duration.mul(schedule.tokensPerSecond);
                totalToEmit = totalToEmit.add(scheduleEmission);
            }
            
            // Deactivate if schedule ended
            if (currentTime >= schedule.endTime) {
                schedule.isActive = false;
            }
        }
        
        if (totalToEmit > 0) {
            require(totalSupply().add(totalToEmit) <= MAX_SUPPLY, "Emission exceeds max supply");
            
            // Emit to treasury or designated recipient
            address emissionRecipient = treasury != address(0) ? treasury : address(this);
            _mint(emissionRecipient, totalToEmit);
            
            totalEmitted = totalEmitted.add(totalToEmit);
            emit TokensEmitted(totalToEmit, currentTime);
        }
        
        lastEmissionTime = currentTime;
    }

    /**
     * @dev Stakes tokens for governance participation and rewards
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external whenNotPaused {
        require(amount > 0, "Cannot stake zero tokens");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Claim pending rewards before staking
        _claimStakingRewards(msg.sender);

        // Transfer tokens to contract
        _transfer(msg.sender, address(this), amount);
        
        stakedBalances[msg.sender] = stakedBalances[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);
        lastStakeTime[msg.sender] = block.timestamp;

        emit TokensStaked(msg.sender, amount);
    }

    /**
     * @dev Unstakes tokens and claims rewards
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external {
        require(amount > 0, "Cannot unstake zero tokens");
        require(stakedBalances[msg.sender] >= amount, "Insufficient staked balance");
        require(
            block.timestamp >= lastStakeTime[msg.sender].add(minimumStakeDuration),
            "Minimum stake duration not met"
        );

        // Claim pending rewards
        _claimStakingRewards(msg.sender);

        // Update balances
        stakedBalances[msg.sender] = stakedBalances[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);

        // Transfer tokens back to user
        _transfer(address(this), msg.sender, amount);

        emit TokensUnstaked(msg.sender, amount);
    }

    /**
     * @dev Claims accumulated staking rewards
     */
    function claimRewards() external {
        _claimStakingRewards(msg.sender);
    }

    /**
     * @dev Adds a new emission schedule
     * @param startTime Start time for emission
     * @param endTime End time for emission
     * @param tokensPerSecond Tokens to emit per second
     */
    function addEmissionSchedule(
        uint256 startTime,
        uint256 endTime,
        uint256 tokensPerSecond
    ) external onlyRole(MINTER_ROLE) {
        require(startTime < endTime, "Invalid time range");
        require(startTime > block.timestamp, "Start time must be in future");
        require(tokensPerSecond > 0, "Emission rate must be positive");

        emissionSchedules.push(EmissionSchedule({
            startTime: startTime,
            endTime: endTime,
            tokensPerSecond: tokensPerSecond,
            isActive: true
        }));

        emit EmissionScheduleAdded(emissionSchedules.length - 1, startTime, endTime, tokensPerSecond);
    }

    /**
     * @dev Updates staking parameters
     * @param _rewardRate New reward rate
     * @param _minimumDuration New minimum stake duration
     */
    function updateStakingParameters(
        uint256 _rewardRate,
        uint256 _minimumDuration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minimumDuration <= 365 days, "Duration too long");
        
        stakingRewardRate = _rewardRate;
        minimumStakeDuration = _minimumDuration;

        emit StakingParametersUpdated(_rewardRate, _minimumDuration);
    }

    /**
     * @dev Updates treasury address
     * @param _treasury New treasury address
     */
    function updateTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury address");
        
        _revokeRole(TREASURY_ROLE, treasury);
        _grantRole(TREASURY_ROLE, _treasury);
        
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @dev Gets staking information for a user
     * @param user User address
     * @return staked Amount of tokens staked
     * @return rewards Pending rewards
     * @return stakeTime Last stake time
     */
    function getStakingInfo(address user) 
        external 
        view 
        returns (uint256 staked, uint256 rewards, uint256 stakeTime) 
    {
        staked = stakedBalances[user];
        rewards = _calculatePendingRewards(user);
        stakeTime = lastStakeTime[user];
    }

    /**
     * @dev Gets total staking statistics
     * @return totalStakedTokens Total tokens staked
     * @return totalRewardRate Current reward rate
     * @return minDuration Minimum stake duration
     */
    function getStakingStats() 
        external 
        view 
        returns (uint256 totalStakedTokens, uint256 totalRewardRate, uint256 minDuration) 
    {
        totalStakedTokens = totalStaked;
        totalRewardRate = stakingRewardRate;
        minDuration = minimumStakeDuration;
    }

    /**
     * @dev Gets emission schedule information
     * @param scheduleId Schedule index
     * @return schedule Emission schedule details
     */
    function getEmissionSchedule(uint256 scheduleId) 
        external 
        view 
        returns (EmissionSchedule memory schedule) 
    {
        require(scheduleId < emissionSchedules.length, "Invalid schedule ID");
        return emissionSchedules[scheduleId];
    }

    /**
     * @dev Gets number of emission schedules
     * @return count Number of schedules
     */
    function getEmissionScheduleCount() external view returns (uint256 count) {
        return emissionSchedules.length;
    }

    /**
     * @dev Internal function to claim staking rewards
     * @param user User address
     */
    function _claimStakingRewards(address user) internal {
        uint256 pendingRewards = _calculatePendingRewards(user);
        
        if (pendingRewards > 0) {
            stakingRewards[user] = 0; // Reset rewards
            
            // Mint rewards if within max supply
            if (totalSupply().add(pendingRewards) <= MAX_SUPPLY) {
                _mint(user, pendingRewards);
                emit RewardsClaimed(user, pendingRewards);
            }
        }
    }

    /**
     * @dev Calculates pending rewards for a user
     * @param user User address
     * @return rewards Pending reward amount
     */
    function _calculatePendingRewards(address user) internal view returns (uint256 rewards) {
        if (stakedBalances[user] == 0) return 0;
        
        uint256 stakeDuration = block.timestamp.sub(lastStakeTime[user]);
        uint256 baseRewards = stakedBalances[user].mul(stakingRewardRate).mul(stakeDuration).div(1e18);
        
        return stakingRewards[user].add(baseRewards);
    }

    /**
     * @dev Pauses all token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Hook to pause transfers when contract is paused
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    // Required overrides for multiple inheritance

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._mint(to, amount);
    }

    function _burn(
        address account,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._burn(account, amount);
    }
}
