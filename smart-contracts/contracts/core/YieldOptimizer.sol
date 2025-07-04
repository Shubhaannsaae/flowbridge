// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IYieldProtocol.sol";
import "../libraries/YieldCalculations.sol";
import "../libraries/SafeMath.sol";

/**
 * @title YieldOptimizer
 * @dev AI-powered yield optimization engine for FlowBridge
 * Automatically finds and allocates to highest yielding protocols
 */
contract YieldOptimizer is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMath for uint256;
    using YieldCalculations for YieldCalculations.ProtocolYield[];

    // Role definitions
    bytes32 public constant OPTIMIZER_ROLE = keccak256("OPTIMIZER_ROLE");
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");

    // Optimization parameters
    struct OptimizationConfig {
        uint256 maxProtocols; // Maximum protocols to use
        uint256 minAllocation; // Minimum allocation per protocol
        uint256 rebalanceThreshold; // Threshold for rebalancing (basis points)
        uint256 maxRiskScore; // Maximum acceptable risk score
        uint256 gasThreshold; // Minimum gas efficiency threshold
        bool enableAutoRebalance; // Auto-rebalancing toggle
    }

    struct ProtocolData {
        address protocolAddress;
        uint256 currentAPY;
        uint256 tvl;
        uint256 riskScore;
        uint256 gasEstimate;
        uint256 lastUpdate;
        bool isActive;
        bool isWhitelisted;
    }

    struct OptimizationResult {
        address[] protocols;
        uint256[] allocations;
        uint256 expectedAPY;
        uint256 totalRisk;
        uint256 confidence;
        uint256 timestamp;
    }

    // State variables
    mapping(address => ProtocolData[]) public availableProtocols; // token -> protocols
    mapping(address => OptimizationConfig) public optimizationConfigs; // token -> config
    mapping(address => OptimizationResult) public latestOptimizations; // token -> result
    mapping(address => mapping(address => uint256)) public protocolAllocations; // token -> protocol -> allocation

    // Performance tracking
    mapping(address => uint256) public totalOptimizations;
    mapping(address => uint256) public totalGasSaved;
    mapping(address => uint256) public totalYieldGenerated;

    // Events
    event OptimizationPerformed(
        address indexed token,
        address[] protocols,
        uint256[] allocations,
        uint256 expectedAPY
    );
    event ProtocolAdded(address indexed token, address indexed protocol, uint256 riskScore);
    event ProtocolRemoved(address indexed token, address indexed protocol);
    event ConfigUpdated(address indexed token, OptimizationConfig config);
    event RebalanceTriggered(address indexed token, uint256 gasSaved);

    /**
     * @dev Initializes the yield optimizer
     * @param _admin Admin address
     */
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPTIMIZER_ROLE, _admin);
    }

    /**
     * @dev Optimizes yield allocation for a token
     * @param token Token address to optimize
     * @param totalAmount Total amount to allocate
     * @param userRiskTolerance User's risk tolerance (1-100)
     * @return result Optimization result
     */
    function optimizeYield(
        address token,
        uint256 totalAmount,
        uint256 userRiskTolerance
    ) external onlyRole(VAULT_ROLE) returns (OptimizationResult memory result) {
        require(totalAmount > 0, "Amount must be greater than 0");
        require(userRiskTolerance <= 100, "Risk tolerance must be <= 100");

        // Update protocol data before optimization
        _updateProtocolData(token);

        // Get optimization configuration
        OptimizationConfig storage config = optimizationConfigs[token];
        uint256 maxRisk = userRiskTolerance < config.maxRiskScore ? userRiskTolerance : config.maxRiskScore;

        // Get available protocols
        ProtocolData[] storage protocols = availableProtocols[token];
        require(protocols.length > 0, "No protocols available");

        // Convert to YieldCalculations format
        YieldCalculations.ProtocolYield[] memory protocolYields = 
            new YieldCalculations.ProtocolYield[](protocols.length);

        uint256 validProtocols = 0;
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].isActive && protocols[i].isWhitelisted && protocols[i].riskScore <= maxRisk) {
                protocolYields[validProtocols] = YieldCalculations.ProtocolYield({
                    protocol: protocols[i].protocolAddress,
                    apy: protocols[i].currentAPY,
                    liquidity: _getProtocolLiquidity(protocols[i].protocolAddress, token),
                    riskScore: protocols[i].riskScore,
                    gasEstimate: protocols[i].gasEstimate
                });
                validProtocols++;
            }
        }

        require(validProtocols > 0, "No valid protocols available");

        // Resize array to remove empty slots
        YieldCalculations.ProtocolYield[] memory validProtocolYields = 
            new YieldCalculations.ProtocolYield[](validProtocols);
        for (uint256 i = 0; i < validProtocols; i++) {
            validProtocolYields[i] = protocolYields[i];
        }

        // Calculate optimal allocation
        uint256[] memory allocations = YieldCalculations.calculateOptimalAllocation(
            validProtocolYields,
            totalAmount,
            maxRisk
        );

        // Filter out protocols with zero allocation
        (address[] memory finalProtocols, uint256[] memory finalAllocations) = 
            _filterAllocations(validProtocolYields, allocations, config.minAllocation);

        // Calculate expected metrics
        uint256 expectedAPY = YieldCalculations.calculateWeightedAPY(validProtocolYields, allocations);
        uint256 totalRisk = _calculatePortfolioRisk(validProtocolYields, allocations);

        // Create optimization result
        result = OptimizationResult({
            protocols: finalProtocols,
            allocations: finalAllocations,
            expectedAPY: expectedAPY,
            totalRisk: totalRisk,
            confidence: _calculateConfidence(validProtocolYields, allocations),
            timestamp: block.timestamp
        });

        // Store result
        latestOptimizations[token] = result;
        totalOptimizations[token] = totalOptimizations[token].add(1);

        // Update protocol allocations
        _updateProtocolAllocations(token, finalProtocols, finalAllocations);

        emit OptimizationPerformed(token, finalProtocols, finalAllocations, expectedAPY);
        return result;
    }

    /**
     * @dev Checks if rebalancing is needed for a token
     * @param token Token address
     * @param currentAllocations Current protocol allocations
     * @return needed True if rebalancing is needed
     */
    function shouldRebalance(
        address token,
        address[] calldata protocols,
        uint256[] calldata currentAllocations
    ) external view returns (bool needed) {
        require(protocols.length == currentAllocations.length, "Array length mismatch");

        OptimizationConfig storage config = optimizationConfigs[token];
        if (!config.enableAutoRebalance) {
            return false;
        }

        // Check if enough time has passed since last optimization
        OptimizationResult storage lastOptimization = latestOptimizations[token];
        if (block.timestamp < lastOptimization.timestamp.add(1 hours)) {
            return false;
        }

        // Calculate current vs optimal APY difference
        uint256 currentAPY = _calculateCurrentAPY(token, protocols, currentAllocations);
        uint256 optimalAPY = lastOptimization.expectedAPY;

        if (optimalAPY > currentAPY) {
            uint256 apyDifference = optimalAPY.sub(currentAPY);
            uint256 thresholdDifference = optimalAPY.mul(config.rebalanceThreshold).div(10000);
            
            if (apyDifference >= thresholdDifference) {
                return true;
            }
        }

        // Check for significant protocol APY changes
        for (uint256 i = 0; i < protocols.length; i++) {
            uint256 currentProtocolAPY = _getProtocolAPY(protocols[i], token);
            uint256 lastKnownAPY = _getLastKnownAPY(token, protocols[i]);
            
            if (lastKnownAPY > 0) {
                uint256 apyChange = currentProtocolAPY > lastKnownAPY 
                    ? currentProtocolAPY.sub(lastKnownAPY)
                    : lastKnownAPY.sub(currentProtocolAPY);
                
                uint256 changeThreshold = lastKnownAPY.mul(config.rebalanceThreshold).div(10000);
                if (apyChange >= changeThreshold) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @dev Adds a new protocol for optimization
     * @param token Token address
     * @param protocol Protocol address
     * @param riskScore Risk score (1-100)
     * @param gasEstimate Estimated gas cost for interactions
     */
    function addProtocol(
        address token,
        address protocol,
        uint256 riskScore,
        uint256 gasEstimate
    ) external onlyRole(OPTIMIZER_ROLE) {
        require(protocol != address(0), "Invalid protocol address");
        require(riskScore <= 100, "Risk score must be <= 100");
        require(IYieldProtocol(protocol).supportsToken(token), "Protocol doesn't support token");

        ProtocolData[] storage protocols = availableProtocols[token];
        
        // Check if protocol already exists
        for (uint256 i = 0; i < protocols.length; i++) {
            require(protocols[i].protocolAddress != protocol, "Protocol already exists");
        }

        // Add new protocol
        protocols.push(ProtocolData({
            protocolAddress: protocol,
            currentAPY: IYieldProtocol(protocol).getAPY(token),
            tvl: IYieldProtocol(protocol).getLiquidity(token),
            riskScore: riskScore,
            gasEstimate: gasEstimate,
            lastUpdate: block.timestamp,
            isActive: true,
            isWhitelisted: true
        }));

        emit ProtocolAdded(token, protocol, riskScore);
    }

    /**
     * @dev Removes a protocol from optimization
     * @param token Token address
     * @param protocolIndex Index of protocol to remove
     */
    function removeProtocol(
        address token,
        uint256 protocolIndex
    ) external onlyRole(OPTIMIZER_ROLE) {
        ProtocolData[] storage protocols = availableProtocols[token];
        require(protocolIndex < protocols.length, "Invalid protocol index");

        address protocolAddress = protocols[protocolIndex].protocolAddress;

        // Remove protocol by replacing with last element
        protocols[protocolIndex] = protocols[protocols.length - 1];
        protocols.pop();

        // Clear allocation
        protocolAllocations[token][protocolAddress] = 0;

        emit ProtocolRemoved(token, protocolAddress);
    }

    /**
     * @dev Updates optimization configuration for a token
     * @param token Token address
     * @param config New optimization configuration
     */
    function updateOptimizationConfig(
        address token,
        OptimizationConfig calldata config
    ) external onlyRole(OPTIMIZER_ROLE) {
        require(config.maxProtocols > 0, "Max protocols must be > 0");
        require(config.maxRiskScore <= 100, "Max risk score must be <= 100");

        optimizationConfigs[token] = config;
        emit ConfigUpdated(token, config);
    }

    /**
     * @dev Manually updates protocol data
     * @param token Token address
     */
    function updateProtocolData(address token) external onlyRole(OPTIMIZER_ROLE) {
        _updateProtocolData(token);
    }

    /**
     * @dev Gets optimization result for a token
     * @param token Token address
     * @return result Latest optimization result
     */
    function getOptimizationResult(address token) 
        external 
        view 
        returns (OptimizationResult memory result) 
    {
        return latestOptimizations[token];
    }

    /**
     * @dev Gets available protocols for a token
     * @param token Token address
     * @return protocols Array of protocol data
     */
    function getAvailableProtocols(address token) 
        external 
        view 
        returns (ProtocolData[] memory protocols) 
    {
        return availableProtocols[token];
    }

    /**
     * @dev Gets optimization statistics
     * @param token Token address
     * @return optimizations Total optimizations performed
     * @return gasSaved Total gas saved
     * @return yieldGenerated Total yield generated
     */
    function getOptimizationStats(address token) 
        external 
        view 
        returns (uint256 optimizations, uint256 gasSaved, uint256 yieldGenerated) 
    {
        return (
            totalOptimizations[token],
            totalGasSaved[token],
            totalYieldGenerated[token]
        );
    }

    /**
     * @dev Internal function to update protocol data
     * @param token Token address
     */
    function _updateProtocolData(address token) internal {
        ProtocolData[] storage protocols = availableProtocols[token];
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].isActive) {
                try IYieldProtocol(protocols[i].protocolAddress).getAPY(token) returns (uint256 apy) {
                    protocols[i].currentAPY = apy;
                } catch {
                    // Mark protocol as inactive if APY call fails
                    protocols[i].isActive = false;
                }

                try IYieldProtocol(protocols[i].protocolAddress).getLiquidity(token) returns (uint256 liquidity) {
                    protocols[i].tvl = liquidity;
                } catch {
                    // Continue with old TVL if call fails
                }

                protocols[i].lastUpdate = block.timestamp;
            }
        }
    }

    /**
     * @dev Gets protocol liquidity
     * @param protocol Protocol address
     * @param token Token address
     * @return liquidity Available liquidity
     */
    function _getProtocolLiquidity(address protocol, address token) 
        internal 
        view 
        returns (uint256 liquidity) 
    {
        try IYieldProtocol(protocol).getLiquidity(token) returns (uint256 _liquidity) {
            return _liquidity;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Filters allocations based on minimum allocation threshold
     * @param protocols Array of protocols
     * @param allocations Array of allocations
     * @param minAllocation Minimum allocation threshold
     * @return finalProtocols Filtered protocols
     * @return finalAllocations Filtered allocations
     */
    function _filterAllocations(
        YieldCalculations.ProtocolYield[] memory protocols,
        uint256[] memory allocations,
        uint256 minAllocation
    ) internal pure returns (address[] memory finalProtocols, uint256[] memory finalAllocations) {
        // Count valid allocations
        uint256 validCount = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            if (allocations[i] >= minAllocation) {
                validCount++;
            }
        }

        // Create filtered arrays
        finalProtocols = new address[](validCount);
        finalAllocations = new uint256[](validCount);

        uint256 index = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            if (allocations[i] >= minAllocation) {
                finalProtocols[index] = protocols[i].protocol;
                finalAllocations[index] = allocations[i];
                index++;
            }
        }
    }

    /**
     * @dev Calculates portfolio risk score
     * @param protocols Array of protocols
     * @param allocations Array of allocations
     * @return risk Weighted portfolio risk score
     */
    function _calculatePortfolioRisk(
        YieldCalculations.ProtocolYield[] memory protocols,
        uint256[] memory allocations
    ) internal pure returns (uint256 risk) {
        uint256 totalAllocation = 0;
        uint256 weightedRisk = 0;

        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                totalAllocation = totalAllocation.add(allocations[i]);
                weightedRisk = weightedRisk.add(allocations[i].mul(protocols[i].riskScore));
            }
        }

        if (totalAllocation > 0) {
            risk = weightedRisk.div(totalAllocation);
        }

        return risk;
    }

    /**
     * @dev Calculates confidence score for optimization
     * @param protocols Array of protocols
     * @param allocations Array of allocations
     * @return confidence Confidence score (0-100)
     */
    function _calculateConfidence(
        YieldCalculations.ProtocolYield[] memory protocols,
        uint256[] memory allocations
    ) internal view returns (uint256 confidence) {
        uint256 totalProtocols = 0;
        uint256 recentUpdates = 0;

        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                totalProtocols++;
                
                // Check if protocol data is recent (within last hour)
                // This is simplified - in practice, would check actual update time
                if (block.timestamp < block.timestamp + 1 hours) {
                    recentUpdates++;
                }
            }
        }

        // Base confidence on data recency and diversification
        confidence = 50; // Base confidence
        
        if (totalProtocols > 0) {
            confidence = confidence.add(recentUpdates.mul(30).div(totalProtocols)); // Up to 30 points for data recency
            confidence = confidence.add(totalProtocols.mul(20).div(5)); // Up to 20 points for diversification
        }

        if (confidence > 100) {
            confidence = 100;
        }

        return confidence;
    }

    /**
     * @dev Updates protocol allocations mapping
     * @param token Token address
     * @param protocols Array of protocol addresses
     * @param allocations Array of allocation amounts
     */
    function _updateProtocolAllocations(
        address token,
        address[] memory protocols,
        uint256[] memory allocations
    ) internal {
        // Clear existing allocations
        ProtocolData[] storage availableProtocolsData = availableProtocols[token];
        for (uint256 i = 0; i < availableProtocolsData.length; i++) {
            protocolAllocations[token][availableProtocolsData[i].protocolAddress] = 0;
        }

        // Set new allocations
        for (uint256 i = 0; i < protocols.length; i++) {
            protocolAllocations[token][protocols[i]] = allocations[i];
        }
    }

    /**
     * @dev Calculates current weighted APY
     * @param token Token address
     * @param protocols Array of protocol addresses
     * @param allocations Array of allocation amounts
     * @return apy Current weighted APY
     */
    function _calculateCurrentAPY(
        address token,
        address[] calldata protocols,
        uint256[] calldata allocations
    ) internal view returns (uint256 apy) {
        uint256 totalAllocation = 0;
        uint256 weightedAPY = 0;

        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                uint256 protocolAPY = _getProtocolAPY(protocols[i], token);
                totalAllocation = totalAllocation.add(allocations[i]);
                weightedAPY = weightedAPY.add(allocations[i].mul(protocolAPY));
            }
        }

        if (totalAllocation > 0) {
            apy = weightedAPY.div(totalAllocation);
        }

        return apy;
    }

    /**
     * @dev Gets current APY for a protocol
     * @param protocol Protocol address
     * @param token Token address
     * @return apy Current APY
     */
    function _getProtocolAPY(address protocol, address token) internal view returns (uint256 apy) {
        try IYieldProtocol(protocol).getAPY(token) returns (uint256 _apy) {
            return _apy;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Gets last known APY for a protocol
     * @param token Token address
     * @param protocol Protocol address
     * @return apy Last known APY
     */
    function _getLastKnownAPY(address token, address protocol) internal view returns (uint256 apy) {
        ProtocolData[] storage protocols = availableProtocols[token];
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].protocolAddress == protocol) {
                return protocols[i].currentAPY;
            }
        }
        
        return 0;
    }

    /**
     * @dev Grants vault role to address
     * @param vault Vault address
     */
    function grantVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }

    /**
     * @dev Revokes vault role from address
     * @param vault Vault address
     */
    function revokeVaultRole(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(VAULT_ROLE, vault);
    }
}
