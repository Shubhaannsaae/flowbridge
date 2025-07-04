// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SafeMath.sol";

/**
 * @title YieldCalculations
 * @dev Library for yield-related calculations and optimizations
 */
library YieldCalculations {
    using SafeMath for uint256;

    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    struct YieldData {
        uint256 principal;
        uint256 apy; // In basis points
        uint256 startTime;
        uint256 lastCompoundTime;
        uint256 accruedYield;
    }

    struct ProtocolYield {
        address protocol;
        uint256 apy;
        uint256 liquidity;
        uint256 riskScore; // 1-100, higher = riskier
        uint256 gasEstimate;
    }

    /**
     * @dev Calculates compound interest for a given period
     * @param principal Initial amount
     * @param apy Annual percentage yield in basis points
     * @param timeElapsed Time elapsed in seconds
     * @return interest Accrued interest
     */
    function calculateCompoundInterest(
        uint256 principal,
        uint256 apy,
        uint256 timeElapsed
    ) internal pure returns (uint256 interest) {
        if (principal == 0 || apy == 0 || timeElapsed == 0) {
            return 0;
        }

        // Convert APY from basis points to decimal: apy / BASIS_POINTS
        // Calculate time fraction: timeElapsed / SECONDS_PER_YEAR
        // Formula: principal * ((1 + apy/BASIS_POINTS) ^ (timeElapsed/SECONDS_PER_YEAR) - 1)
        // Simplified for gas efficiency using linear approximation for short periods
        
        uint256 yearFraction = timeElapsed.mul(BASIS_POINTS).div(SECONDS_PER_YEAR);
        uint256 simpleInterest = principal.mul(apy).mul(yearFraction).div(BASIS_POINTS).div(BASIS_POINTS);
        
        return simpleInterest;
    }

    /**
     * @dev Calculates risk-adjusted APY
     * @param apy Base APY in basis points
     * @param riskScore Risk score (1-100)
     * @return adjustedApy Risk-adjusted APY
     */
    function calculateRiskAdjustedAPY(
        uint256 apy,
        uint256 riskScore
    ) internal pure returns (uint256 adjustedApy) {
        require(riskScore <= 100, "Risk score must be <= 100");
        
        // Apply risk discount: higher risk = lower effective APY
        uint256 riskDiscount = riskScore.mul(50); // Max 50% discount for highest risk
        uint256 discountFactor = BASIS_POINTS.sub(riskDiscount);
        
        return apy.mul(discountFactor).div(BASIS_POINTS);
    }

    /**
     * @dev Finds optimal protocol allocation based on yield and risk
     * @param protocols Array of available protocols
     * @param totalAmount Total amount to allocate
     * @param maxRiskScore Maximum acceptable risk score
     * @return allocations Optimal allocation amounts for each protocol
     */
    function calculateOptimalAllocation(
        ProtocolYield[] memory protocols,
        uint256 totalAmount,
        uint256 maxRiskScore
    ) internal pure returns (uint256[] memory allocations) {
        allocations = new uint256[](protocols.length);
        
        if (totalAmount == 0 || protocols.length == 0) {
            return allocations;
        }

        // Filter protocols by risk tolerance
        uint256 validProtocols = 0;
        uint256 totalScore = 0;
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].riskScore <= maxRiskScore && protocols[i].liquidity > 0) {
                uint256 score = calculateRiskAdjustedAPY(protocols[i].apy, protocols[i].riskScore);
                totalScore = totalScore.add(score);
                validProtocols++;
            }
        }
        
        if (validProtocols == 0 || totalScore == 0) {
            return allocations;
        }

        // Allocate proportionally based on risk-adjusted APY
        uint256 allocatedAmount = 0;
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i].riskScore <= maxRiskScore && protocols[i].liquidity > 0) {
                uint256 score = calculateRiskAdjustedAPY(protocols[i].apy, protocols[i].riskScore);
                uint256 allocation = totalAmount.mul(score).div(totalScore);
                
                // Ensure allocation doesn't exceed protocol liquidity
                if (allocation > protocols[i].liquidity) {
                    allocation = protocols[i].liquidity;
                }
                
                allocations[i] = allocation;
                allocatedAmount = allocatedAmount.add(allocation);
            }
        }
        
        // Handle rounding differences by allocating remainder to best protocol
        if (allocatedAmount < totalAmount) {
            uint256 remainder = totalAmount.sub(allocatedAmount);
            uint256 bestProtocolIndex = 0;
            uint256 bestScore = 0;
            
            for (uint256 i = 0; i < protocols.length; i++) {
                if (allocations[i] > 0) {
                    uint256 score = calculateRiskAdjustedAPY(protocols[i].apy, protocols[i].riskScore);
                    if (score > bestScore && protocols[i].liquidity >= allocations[i].add(remainder)) {
                        bestScore = score;
                        bestProtocolIndex = i;
                    }
                }
            }
            
            allocations[bestProtocolIndex] = allocations[bestProtocolIndex].add(remainder);
        }
        
        return allocations;
    }

    /**
     * @dev Calculates expected yield for given allocation
     * @param protocols Array of protocols
     * @param allocations Allocation amounts for each protocol
     * @param timeHorizon Time horizon in seconds
     * @return expectedYield Total expected yield
     */
    function calculateExpectedYield(
        ProtocolYield[] memory protocols,
        uint256[] memory allocations,
        uint256 timeHorizon
    ) internal pure returns (uint256 expectedYield) {
        require(protocols.length == allocations.length, "Array length mismatch");
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                uint256 protocolYield = calculateCompoundInterest(
                    allocations[i],
                    protocols[i].apy,
                    timeHorizon
                );
                expectedYield = expectedYield.add(protocolYield);
            }
        }
        
        return expectedYield;
    }

    /**
     * @dev Calculates portfolio-weighted APY
     * @param protocols Array of protocols
     * @param allocations Allocation amounts for each protocol
     * @return weightedAPY Portfolio-weighted APY in basis points
     */
    function calculateWeightedAPY(
        ProtocolYield[] memory protocols,
        uint256[] memory allocations
    ) internal pure returns (uint256 weightedAPY) {
        require(protocols.length == allocations.length, "Array length mismatch");
        
        uint256 totalAllocation = 0;
        uint256 weightedSum = 0;
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                totalAllocation = totalAllocation.add(allocations[i]);
                weightedSum = weightedSum.add(allocations[i].mul(protocols[i].apy));
            }
        }
        
        if (totalAllocation == 0) {
            return 0;
        }
        
        return weightedSum.div(totalAllocation);
    }

    /**
     * @dev Updates yield data with accrued interest
     * @param yieldData Current yield data
     * @param currentTime Current timestamp
     * @return updatedData Updated yield data with accrued interest
     */
    function updateYieldData(
        YieldData memory yieldData,
        uint256 currentTime
    ) internal pure returns (YieldData memory updatedData) {
        updatedData = yieldData;
        
        if (currentTime > yieldData.lastCompoundTime) {
            uint256 timeElapsed = currentTime.sub(yieldData.lastCompoundTime);
            uint256 newInterest = calculateCompoundInterest(
                yieldData.principal.add(yieldData.accruedYield),
                yieldData.apy,
                timeElapsed
            );
            
            updatedData.accruedYield = yieldData.accruedYield.add(newInterest);
            updatedData.lastCompoundTime = currentTime;
        }
        
        return updatedData;
    }
}
