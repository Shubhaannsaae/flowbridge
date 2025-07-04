// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IYieldProtocol.sol";
import "../libraries/SafeMath.sol";

/**
 * @title RiskManager
 * @dev Comprehensive risk management system for FlowBridge protocol
 * Monitors and enforces risk limits across all protocol interactions
 */
contract RiskManager is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMath for uint256;

    // Role definitions
    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    // Risk assessment levels
    enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }

    // Protocol risk parameters
    struct ProtocolRisk {
        address protocol;
        uint256 riskScore; // 1-100, higher = riskier
        uint256 maxAllocation; // Maximum allocation in basis points
        uint256 tvlThreshold; // Minimum TVL required
        RiskLevel riskLevel;
        uint256 lastAssessment;
        bool isActive;
        bool isBlacklisted;
    }

    // User risk profile
    struct UserRiskProfile {
        uint256 riskTolerance; // 1-100, user's risk tolerance
        uint256 maxPositionSize; // Maximum position size per protocol
        uint256 totalExposure; // Total exposure across all protocols
        uint256 concentrationLimit; // Maximum concentration in single protocol
        RiskLevel maxRiskLevel; // Maximum risk level allowed
        bool isActive;
        uint256 lastUpdate;
    }

    // Risk limits configuration
    struct RiskLimits {
        uint256 maxProtocolRisk; // Maximum risk score for any protocol
        uint256 maxPortfolioRisk; // Maximum weighted portfolio risk
        uint256 maxConcentration; // Maximum concentration in single protocol (basis points)
        uint256 maxLeverage; // Maximum leverage allowed
        uint256 minLiquidity; // Minimum liquidity threshold
        uint256 maxVolatility; // Maximum volatility threshold
    }

    // Risk monitoring data
    struct RiskMetrics {
        uint256 totalValueAtRisk; // Total VaR across portfolio
        uint256 portfolioRisk; // Weighted portfolio risk score
        uint256 concentrationRisk; // Concentration risk measure
        uint256 liquidityRisk; // Liquidity risk measure
        uint256 protocolCount; // Number of protocols in use
        uint256 lastUpdate;
    }

    // State variables
    mapping(address => ProtocolRisk) public protocolRisks; // protocol -> risk data
    mapping(address => UserRiskProfile) public userRiskProfiles; // user -> risk profile
    mapping(address => mapping(address => uint256)) public userProtocolExposure; // user -> protocol -> exposure
    mapping(address => RiskMetrics) public userRiskMetrics; // user -> risk metrics
    
    // Global risk parameters
    RiskLimits public globalRiskLimits;
    uint256 public emergencyThreshold; // Emergency shutdown threshold
    bool public emergencyMode; // Emergency mode flag
    
    // Protocol whitelist
    address[] public whitelistedProtocols;
    mapping(address => bool) public isWhitelisted;

    // Events
    event RiskAssessed(address indexed user, address indexed protocol, uint256 riskScore, RiskLevel riskLevel);
    event RiskLimitExceeded(address indexed user, address indexed protocol, uint256 exposure, uint256 limit);
    event ProtocolRiskUpdated(address indexed protocol, uint256 newRiskScore, RiskLevel newRiskLevel);
    event UserRiskProfileUpdated(address indexed user, UserRiskProfile profile);
    event EmergencyModeActivated(uint256 timestamp);
    event EmergencyModeDeactivated(uint256 timestamp);
    event ProtocolBlacklisted(address indexed protocol, string reason);

    /**
     * @dev Initializes the risk manager
     * @param _admin Admin address
     */
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RISK_ADMIN_ROLE, _admin);

        // Set default risk limits
        globalRiskLimits = RiskLimits({
            maxProtocolRisk: 80, // Max 80/100 risk score
            maxPortfolioRisk: 60, // Max 60/100 portfolio risk
            maxConcentration: 3000, // Max 30% in single protocol
            maxLeverage: 300, // Max 3x leverage
            minLiquidity: 1000000 * 1e6, // Min $1M liquidity
            maxVolatility: 5000 // Max 50% volatility
        });

        emergencyThreshold = 90; // Emergency at 90/100 risk
    }

    /**
     * @dev Assesses risk for a protocol allocation
     * @param user User address
     * @param protocol Protocol address
     * @param amount Allocation amount
     * @param totalPortfolio Total portfolio value
     * @return allowed True if allocation is allowed
     * @return riskScore Calculated risk score
     */
    function assessAllocationRisk(
        address user,
        address protocol,
        uint256 amount,
        uint256 totalPortfolio
    ) external view returns (bool allowed, uint256 riskScore) {
        // Check if protocol is whitelisted and not blacklisted
        if (!isWhitelisted[protocol] || protocolRisks[protocol].isBlacklisted) {
            return (false, 100);
        }

        // Check emergency mode
        if (emergencyMode) {
            return (false, 100);
        }

        // Get protocol risk
        ProtocolRisk storage protocolRisk = protocolRisks[protocol];
        if (!protocolRisk.isActive) {
            return (false, 100);
        }

        // Get user risk profile
        UserRiskProfile storage userProfile = userRiskProfiles[user];
        if (!userProfile.isActive) {
            return (false, 100);
        }

        // Calculate concentration
        uint256 concentration = totalPortfolio > 0 ? amount.mul(10000).div(totalPortfolio) : 0;

        // Check concentration limits
        if (concentration > userProfile.concentrationLimit || 
            concentration > globalRiskLimits.maxConcentration) {
            return (false, protocolRisk.riskScore);
        }

        // Check protocol risk vs user tolerance
        if (protocolRisk.riskScore > userProfile.riskTolerance) {
            return (false, protocolRisk.riskScore);
        }

        // Check position size limits
        if (amount > userProfile.maxPositionSize) {
            return (false, protocolRisk.riskScore);
        }

        // Calculate portfolio risk impact
        uint256 newPortfolioRisk = _calculatePortfolioRisk(user, protocol, amount);
        if (newPortfolioRisk > globalRiskLimits.maxPortfolioRisk) {
            return (false, newPortfolioRisk);
        }

        return (true, protocolRisk.riskScore);
    }

    /**
     * @dev Updates user exposure after allocation
     * @param user User address
     * @param protocol Protocol address
     * @param newExposure New exposure amount
     */
    function updateUserExposure(
        address user,
        address protocol,
        uint256 newExposure
    ) external onlyRole(VAULT_ROLE) {
        uint256 oldExposure = userProtocolExposure[user][protocol];
        userProtocolExposure[user][protocol] = newExposure;

        // Update total exposure
        UserRiskProfile storage profile = userRiskProfiles[user];
        if (newExposure > oldExposure) {
            profile.totalExposure = profile.totalExposure.add(newExposure.sub(oldExposure));
        } else {
            profile.totalExposure = profile.totalExposure.sub(oldExposure.sub(newExposure));
        }
        profile.lastUpdate = block.timestamp;

        // Update risk metrics
        _updateUserRiskMetrics(user);

        emit RiskAssessed(user, protocol, protocolRisks[protocol].riskScore, protocolRisks[protocol].riskLevel);
    }

    /**
     * @dev Updates protocol risk parameters
     * @param protocol Protocol address
     * @param riskScore New risk score (1-100)
     * @param maxAllocation Maximum allocation in basis points
     * @param tvlThreshold Minimum TVL threshold
     */
    function updateProtocolRisk(
        address protocol,
        uint256 riskScore,
        uint256 maxAllocation,
        uint256 tvlThreshold
    ) external onlyRole(RISK_ADMIN_ROLE) {
        require(riskScore <= 100, "Risk score must be <= 100");
        require(maxAllocation <= 10000, "Max allocation must be <= 10000 basis points");

        ProtocolRisk storage risk = protocolRisks[protocol];
        risk.protocol = protocol;
        risk.riskScore = riskScore;
        risk.maxAllocation = maxAllocation;
        risk.tvlThreshold = tvlThreshold;
        risk.riskLevel = _getRiskLevel(riskScore);
        risk.lastAssessment = block.timestamp;
        risk.isActive = true;

        emit ProtocolRiskUpdated(protocol, riskScore, risk.riskLevel);
    }

    /**
     * @dev Creates or updates user risk profile
     * @param user User address
     * @param riskTolerance User's risk tolerance (1-100)
     * @param maxPositionSize Maximum position size
     * @param concentrationLimit Concentration limit in basis points
     */
    function updateUserRiskProfile(
        address user,
        uint256 riskTolerance,
        uint256 maxPositionSize,
        uint256 concentrationLimit
    ) external onlyRole(RISK_ADMIN_ROLE) {
        require(riskTolerance <= 100, "Risk tolerance must be <= 100");
        require(concentrationLimit <= 10000, "Concentration limit must be <= 10000 basis points");

        UserRiskProfile storage profile = userRiskProfiles[user];
        profile.riskTolerance = riskTolerance;
        profile.maxPositionSize = maxPositionSize;
        profile.concentrationLimit = concentrationLimit;
        profile.maxRiskLevel = _getRiskLevel(riskTolerance);
        profile.isActive = true;
        profile.lastUpdate = block.timestamp;

        emit UserRiskProfileUpdated(user, profile);
    }

    /**
     * @dev Blacklists a protocol due to risk concerns
     * @param protocol Protocol address
     * @param reason Reason for blacklisting
     */
    function blacklistProtocol(
        address protocol,
        string calldata reason
    ) external onlyRole(RISK_ADMIN_ROLE) {
        protocolRisks[protocol].isBlacklisted = true;
        protocolRisks[protocol].isActive = false;
        
        // Remove from whitelist
        isWhitelisted[protocol] = false;
        _removeFromWhitelist(protocol);

        emit ProtocolBlacklisted(protocol, reason);
    }

    /**
     * @dev Adds protocol to whitelist
     * @param protocol Protocol address
     */
    function whitelistProtocol(address protocol) external onlyRole(RISK_ADMIN_ROLE) {
        require(protocol != address(0), "Invalid protocol address");
        require(!protocolRisks[protocol].isBlacklisted, "Protocol is blacklisted");

        if (!isWhitelisted[protocol]) {
            isWhitelisted[protocol] = true;
            whitelistedProtocols.push(protocol);
        }
    }

    /**
     * @dev Activates emergency mode
     */
    function activateEmergencyMode() external onlyRole(RISK_ADMIN_ROLE) {
        emergencyMode = true;
        emit EmergencyModeActivated(block.timestamp);
    }

    /**
     * @dev Deactivates emergency mode
     */
    function deactivateEmergencyMode() external onlyRole(RISK_ADMIN_ROLE) {
        emergencyMode = false;
        emit EmergencyModeDeactivated(block.timestamp);
    }

    /**
     * @dev Updates global risk limits
     * @param limits New risk limits
     */
    function updateGlobalRiskLimits(RiskLimits calldata limits) 
        external 
        onlyRole(RISK_ADMIN_ROLE) 
    {
        require(limits.maxProtocolRisk <= 100, "Max protocol risk must be <= 100");
        require(limits.maxPortfolioRisk <= 100, "Max portfolio risk must be <= 100");
        require(limits.maxConcentration <= 10000, "Max concentration must be <= 10000 basis points");

        globalRiskLimits = limits;
    }

    /**
     * @dev Monitors portfolio risk and triggers alerts
     * @param user User address
     * @return riskLevel Current risk level
     * @return shouldAlert True if risk alert should be triggered
     */
    function monitorPortfolioRisk(address user) 
        external 
        onlyRole(MONITOR_ROLE)
        returns (RiskLevel riskLevel, bool shouldAlert) 
    {
        RiskMetrics storage metrics = userRiskMetrics[user];
        
        // Update risk metrics
        _updateUserRiskMetrics(user);
        
        // Determine risk level
        if (metrics.portfolioRisk >= emergencyThreshold) {
            riskLevel = RiskLevel.CRITICAL;
            shouldAlert = true;
        } else if (metrics.portfolioRisk >= 70) {
            riskLevel = RiskLevel.HIGH;
            shouldAlert = true;
        } else if (metrics.portfolioRisk >= 40) {
            riskLevel = RiskLevel.MEDIUM;
            shouldAlert = false;
        } else {
            riskLevel = RiskLevel.LOW;
            shouldAlert = false;
        }

        return (riskLevel, shouldAlert);
    }

    /**
     * @dev Gets user's current risk metrics
     * @param user User address
     * @return metrics Current risk metrics
     */
    function getUserRiskMetrics(address user) 
        external 
        view 
        returns (RiskMetrics memory metrics) 
    {
        return userRiskMetrics[user];
    }

    /**
     * @dev Gets protocol risk information
     * @param protocol Protocol address
     * @return risk Protocol risk data
     */
    function getProtocolRisk(address protocol) 
        external 
        view 
        returns (ProtocolRisk memory risk) 
    {
        return protocolRisks[protocol];
    }

    /**
     * @dev Gets all whitelisted protocols
     * @return protocols Array of whitelisted protocol addresses
     */
    function getWhitelistedProtocols() external view returns (address[] memory protocols) {
        return whitelistedProtocols;
    }

    /**
     * @dev Checks if allocation is within risk limits
     * @param user User address
     * @param protocol Protocol address
     * @param amount Allocation amount
     * @return allowed True if allocation is allowed
     */
    function checkAllocationLimits(
        address user,
        address protocol,
        uint256 amount
    ) external view returns (bool allowed) {
        (bool isAllowed,) = assessAllocationRisk(user, protocol, amount, userRiskProfiles[user].totalExposure);
        return isAllowed;
    }

    /**
     * @dev Internal function to calculate portfolio risk
     * @param user User address
     * @param newProtocol New protocol to add
     * @param newAmount New allocation amount
     * @return portfolioRisk Calculated portfolio risk score
     */
    function _calculatePortfolioRisk(
        address user,
        address newProtocol,
        uint256 newAmount
    ) internal view returns (uint256 portfolioRisk) {
        UserRiskProfile storage profile = userRiskProfiles[user];
        uint256 totalValue = profile.totalExposure.add(newAmount);
        uint256 weightedRisk = 0;

        // Add risk from existing protocols
        for (uint256 i = 0; i < whitelistedProtocols.length; i++) {
            address protocol = whitelistedProtocols[i];
            uint256 exposure = userProtocolExposure[user][protocol];
            
            if (exposure > 0) {
                weightedRisk = weightedRisk.add(exposure.mul(protocolRisks[protocol].riskScore));
            }
        }

        // Add risk from new protocol
        if (newAmount > 0) {
            weightedRisk = weightedRisk.add(newAmount.mul(protocolRisks[newProtocol].riskScore));
        }

        if (totalValue > 0) {
            portfolioRisk = weightedRisk.div(totalValue);
        }

        return portfolioRisk;
    }

    /**
     * @dev Internal function to update user risk metrics
     * @param user User address
     */
    function _updateUserRiskMetrics(address user) internal {
        RiskMetrics storage metrics = userRiskMetrics[user];
        UserRiskProfile storage profile = userRiskProfiles[user];
        
        // Calculate portfolio risk
        metrics.portfolioRisk = _calculatePortfolioRisk(user, address(0), 0);
        
        // Calculate concentration risk
        metrics.concentrationRisk = _calculateConcentrationRisk(user);
        
        // Count active protocols
        uint256 protocolCount = 0;
        for (uint256 i = 0; i < whitelistedProtocols.length; i++) {
            if (userProtocolExposure[user][whitelistedProtocols[i]] > 0) {
                protocolCount++;
            }
        }
        metrics.protocolCount = protocolCount;
        
        // Update timestamp
        metrics.lastUpdate = block.timestamp;
    }

    /**
     * @dev Internal function to calculate concentration risk
     * @param user User address
     * @return concentrationRisk Concentration risk measure
     */
    function _calculateConcentrationRisk(address user) internal view returns (uint256 concentrationRisk) {
        UserRiskProfile storage profile = userRiskProfiles[user];
        uint256 maxExposure = 0;

        // Find maximum exposure to any single protocol
        for (uint256 i = 0; i < whitelistedProtocols.length; i++) {
            uint256 exposure = userProtocolExposure[user][whitelistedProtocols[i]];
            if (exposure > maxExposure) {
                maxExposure = exposure;
            }
        }

        // Calculate concentration as percentage of total exposure
        if (profile.totalExposure > 0) {
            concentrationRisk = maxExposure.mul(10000).div(profile.totalExposure);
        }

        return concentrationRisk;
    }

    /**
     * @dev Internal function to determine risk level from score
     * @param riskScore Risk score (1-100)
     * @return level Risk level enum
     */
    function _getRiskLevel(uint256 riskScore) internal pure returns (RiskLevel level) {
        if (riskScore >= 80) {
            return RiskLevel.CRITICAL;
        } else if (riskScore >= 60) {
            return RiskLevel.HIGH;
        } else if (riskScore >= 30) {
            return RiskLevel.MEDIUM;
        } else {
            return RiskLevel.LOW;
        }
    }

    /**
     * @dev Internal function to remove protocol from whitelist array
     * @param protocol Protocol address to remove
     */
    function _removeFromWhitelist(address protocol) internal {
        for (uint256 i = 0; i < whitelistedProtocols.length; i++) {
            if (whitelistedProtocols[i] == protocol) {
                whitelistedProtocols[i] = whitelistedProtocols[whitelistedProtocols.length - 1];
                whitelistedProtocols.pop();
                break;
            }
        }
    }

    /**
     * @dev Grants vault role to address
     * @param vault Vault address
     */
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }

    /**
     * @dev Grants monitor role to address
     * @param monitor Monitor address
     */
    function grantMonitorRole(address monitor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MONITOR_ROLE, monitor);
    }
}
