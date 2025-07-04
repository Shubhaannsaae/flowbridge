import axios from 'axios';
import { ProtocolScanner } from './ProtocolScanner';
import { HistoricalData } from '../data/HistoricalData';
import { logger } from '../../utils/logger';

export interface YieldData {
  protocol: string;
  apy: number;
  tvl: number;
  riskScore: number;
  lastUpdated: string;
  chain: string;
}

export interface HistoricalYieldData {
  date: string;
  totalValue: number;
  yieldEarned: number;
  apy: number;
  strategies: {
    protocol: string;
    value: number;
    yield: number;
  }[];
}

export interface YieldOpportunity {
  protocol: string;
  currentAPY: number;
  projectedAPY: number;
  riskAdjustedReturn: number;
  confidence: number;
  timeframe: string;
}

export class YieldAggregator {
  private protocolScanner: ProtocolScanner;
  private historicalData: HistoricalData;
  private yieldCache: Map<string, YieldData> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.protocolScanner = new ProtocolScanner();
    this.historicalData = new HistoricalData();
  }

  async getProtocolYield(protocolName: string): Promise<YieldData> {
    try {
      // Check cache first
      const cached = this.getCachedYield(protocolName);
      if (cached) {
        return cached;
      }

      // Fetch fresh data
      const protocolDetails = await this.protocolScanner.getProtocolDetails(protocolName);
      
      const yieldData: YieldData = {
        protocol: protocolName,
        apy: protocolDetails.currentAPY,
        tvl: protocolDetails.tvl,
        riskScore: protocolDetails.riskScore,
        lastUpdated: new Date().toISOString(),
        chain: protocolDetails.chain
      };

      // Cache the result
      this.setCachedYield(protocolName, yieldData);

      logger.info(`Fetched yield data for ${protocolName}: ${yieldData.apy}% APY`);
      return yieldData;

    } catch (error) {
      logger.error(`Error getting yield for ${protocolName}:`, error);
      throw new Error(`Failed to get yield data for ${protocolName}`);
    }
  }

  async getHistoricalYield(portfolioId: string, days: number): Promise<HistoricalYieldData[]> {
    try {
      const historicalData = await this.historicalData.getPortfolioHistory(portfolioId, days);
      
      const formattedData: HistoricalYieldData[] = historicalData.map(entry => ({
        date: entry.date,
        totalValue: entry.totalValue,
        yieldEarned: entry.yieldEarned,
        apy: entry.apy,
        strategies: entry.strategies.map(strategy => ({
          protocol: strategy.protocol,
          value: strategy.value,
          yield: strategy.yield
        }))
      }));

      logger.info(`Retrieved ${formattedData.length} days of historical yield data`);
      return formattedData;

    } catch (error) {
      logger.error('Error getting historical yield data:', error);
      throw new Error('Failed to retrieve historical yield data');
    }
  }

  async findYieldOpportunities(
    currentStrategies: any[],
    riskTolerance: number
  ): Promise<YieldOpportunity[]> {
    try {
      // Get all available protocols
      const allProtocols = await this.protocolScanner.scanAllProtocols();
      
      // Filter by risk tolerance
      const suitableProtocols = allProtocols.filter(
        protocol => protocol.riskScore <= riskTolerance
      );

      const opportunities: YieldOpportunity[] = [];

      for (const protocol of suitableProtocols) {
        // Skip if already invested
        const alreadyInvested = currentStrategies.some(
          strategy => strategy.protocol === protocol.name
        );
        
        if (alreadyInvested) continue;

        // Calculate projected APY based on historical trends
        const projectedAPY = await this.calculateProjectedAPY(protocol.name);
        
        // Calculate risk-adjusted return
        const riskAdjustedReturn = this.calculateRiskAdjustedReturn(
          projectedAPY,
          protocol.riskScore
        );

        // Calculate confidence based on data quality
        const confidence = this.calculateConfidence(protocol);

        opportunities.push({
          protocol: protocol.name,
          currentAPY: protocol.currentAPY,
          projectedAPY,
          riskAdjustedReturn,
          confidence,
          timeframe: '30d'
        });
      }

      // Sort by risk-adjusted return
      opportunities.sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);

      logger.info(`Found ${opportunities.length} yield opportunities`);
      return opportunities.slice(0, 10); // Return top 10

    } catch (error) {
      logger.error('Error finding yield opportunities:', error);
      throw new Error('Failed to find yield opportunities');
    }
  }

  async aggregateMultiChainYields(chains: string[]): Promise<Map<string, YieldData[]>> {
    try {
      const chainYields = new Map<string, YieldData[]>();

      await Promise.all(
        chains.map(async (chain) => {
          try {
            const protocols = await this.protocolScanner.scanAllProtocols(chain);
            const yields: YieldData[] = [];

            for (const protocol of protocols.slice(0, 20)) { // Top 20 per chain
              const yieldData = await this.getProtocolYield(protocol.name);
              yields.push(yieldData);
            }

            chainYields.set(chain, yields);
            logger.info(`Aggregated ${yields.length} yields for ${chain}`);
          } catch (error) {
            logger.warn(`Failed to aggregate yields for ${chain}:`, error);
            chainYields.set(chain, []);
          }
        })
      );

      return chainYields;

    } catch (error) {
      logger.error('Error aggregating multi-chain yields:', error);
      throw new Error('Failed to aggregate multi-chain yields');
    }
  }

  async calculateOptimalAllocation(
    totalAmount: number,
    riskTolerance: number,
    liquidityRequirement: number
  ): Promise<any[]> {
    try {
      // Get available protocols within risk tolerance
      const availableProtocols = await this.protocolScanner.scanAllProtocols();
      const suitableProtocols = availableProtocols.filter(
        protocol => protocol.riskScore <= riskTolerance
      );

      if (suitableProtocols.length === 0) {
        throw new Error('No suitable protocols found for given risk tolerance');
      }

      const deployableAmount = totalAmount - liquidityRequirement;
      if (deployableAmount <= 0) {
        throw new Error('Insufficient amount after liquidity requirement');
      }

      // Use Modern Portfolio Theory principles
      const allocation = await this.optimizePortfolioAllocation(
        suitableProtocols,
        deployableAmount,
        riskTolerance
      );

      logger.info(`Calculated optimal allocation for $${totalAmount} across ${allocation.length} protocols`);
      return allocation;

    } catch (error) {
      logger.error('Error calculating optimal allocation:', error);
      throw new Error('Failed to calculate optimal allocation');
    }
  }

  private async calculateProjectedAPY(protocolName: string): Promise<number> {
    try {
      // Get historical data for trend analysis
      const historical = await this.historicalData.getProtocolYieldHistory(protocolName, 30);
      
      if (historical.length < 7) {
        // Not enough data, return current APY
        const current = await this.getProtocolYield(protocolName);
        return current.apy;
      }

      // Calculate trend using linear regression
      const trend = this.calculateLinearTrend(historical.map(h => h.apy));
      const currentAPY = historical[historical.length - 1].apy;
      
      // Project 30 days forward
      const projectedAPY = currentAPY + (trend * 30);
      
      // Cap projection to reasonable bounds
      return Math.max(0.1, Math.min(projectedAPY, currentAPY * 2));

    } catch (error) {
      logger.warn(`Error calculating projected APY for ${protocolName}:`, error);
      const current = await this.getProtocolYield(protocolName);
      return current.apy;
    }
  }

  private calculateRiskAdjustedReturn(apy: number, riskScore: number): number {
    // Sharpe ratio-like calculation
    const riskFreeRate = 4; // 4% risk-free rate
    const riskPenalty = (riskScore / 10) * 2; // 0-20% penalty based on risk
    
    return (apy - riskFreeRate) / (1 + riskPenalty);
  }

  private calculateConfidence(protocol: any): number {
    let confidence = 0.5; // Base confidence

    // TVL confidence
    if (protocol.tvl > 1000000000) confidence += 0.3; // >$1B TVL
    else if (protocol.tvl > 100000000) confidence += 0.2; // >$100M TVL
    else if (protocol.tvl < 10000000) confidence -= 0.2; // <$10M TVL

    // Audit confidence
    if (protocol.audited) confidence += 0.2;

    // Age confidence
    const age = Date.now() - new Date(protocol.launchDate).getTime();
    const ageInDays = age / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) confidence += 0.1; // > 1 year
    else if (ageInDays < 90) confidence -= 0.1; // < 3 months

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private async optimizePortfolioAllocation(
    protocols: any[],
    totalAmount: number,
    riskTolerance: number
  ): Promise<any[]> {
    // Simplified portfolio optimization
    const sortedProtocols = protocols
      .map(p => ({
        ...p,
        riskAdjustedReturn: this.calculateRiskAdjustedReturn(p.currentAPY, p.riskScore)
      }))
      .sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);

    const allocation = [];
    let remainingAmount = totalAmount;
    const maxProtocols = Math.min(5, sortedProtocols.length); // Diversify across max 5 protocols

    for (let i = 0; i < maxProtocols && remainingAmount > 0; i++) {
      const protocol = sortedProtocols[i];
      
      // Allocate based on risk-adjusted return and remaining amount
      const weight = this.calculateAllocationWeight(protocol, i, maxProtocols);
      const allocatedAmount = Math.min(remainingAmount * weight, remainingAmount * 0.4); // Max 40% per protocol
      
      allocation.push({
        protocol: protocol.name,
        amount: allocatedAmount,
        percentage: (allocatedAmount / totalAmount) * 100,
        expectedAPY: protocol.currentAPY,
        riskScore: protocol.riskScore,
        chain: protocol.chain
      });

      remainingAmount -= allocatedAmount;
    }

    // Allocate any remaining amount to the top protocol
    if (remainingAmount > 0 && allocation.length > 0) {
      allocation[0].amount += remainingAmount;
      allocation[0].percentage = (allocation[0].amount / totalAmount) * 100;
    }

    return allocation;
  }

  private calculateAllocationWeight(protocol: any, index: number, totalProtocols: number): number {
    // Weight based on position in sorted list (top protocols get more)
    const positionWeight = (totalProtocols - index) / totalProtocols;
    
    // Weight based on risk-adjusted return
    const returnWeight = Math.min(protocol.riskAdjustedReturn / 10, 1);
    
    return (positionWeight + returnWeight) / 2;
  }

  private getCachedYield(protocolName: string): YieldData | null {
    const cached = this.yieldCache.get(protocolName);
    if (!cached) return null;

    const now = Date.now();
    const cacheTime = new Date(cached.lastUpdated).getTime();
    
    if (now - cacheTime > this.cacheExpiry) {
      this.yieldCache.delete(protocolName);
      return null;
    }

    return cached;
  }

  private setCachedYield(protocolName: string, yieldData: YieldData): void {
    this.yieldCache.set(protocolName, yieldData);
  }
}
