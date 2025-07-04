import { ethers } from 'ethers';
import { LiFiIntegration } from '../crosschain/LiFiIntegration';
import { YieldAggregator } from './YieldAggregator';
import { LiquidityManager } from './LiquidityManager';
import { PriceFeeds } from '../data/PriceFeeds';
import { logger } from '../../utils/logger';

export interface RebalancingStrategy {
  protocol: string;
  action: 'deposit' | 'withdraw' | 'migrate';
  amount: string;
  fromProtocol?: string;
  toProtocol?: string;
  chain: string;
  targetChain?: string;
  priority: number;
}

export interface RebalancingResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: number;
  error?: string;
  strategies?: RebalancingStrategy[];
}

export interface GasOptimization {
  totalGasCost: number;
  optimizedRoute: RebalancingStrategy[];
  savings: number;
  executionTime: number;
}

export class RebalancingEngine {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private lifiIntegration: LiFiIntegration;
  private yieldAggregator: YieldAggregator;
  private liquidityManager: LiquidityManager;
  private priceFeeds: PriceFeeds;

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
    this.lifiIntegration = new LiFiIntegration();
    this.yieldAggregator = new YieldAggregator();
    this.liquidityManager = new LiquidityManager();
    this.priceFeeds = new PriceFeeds();
  }

  private initializeProviders(): void {
    const networks = {
      ethereum: process.env.ETHEREUM_RPC_URL!,
      polygon: process.env.POLYGON_RPC_URL!,
      arbitrum: process.env.ARBITRUM_RPC_URL!,
      optimism: process.env.OPTIMISM_RPC_URL!,
      base: process.env.BASE_RPC_URL!
    };

    for (const [network, rpcUrl] of Object.entries(networks)) {
      this.providers.set(network, new ethers.providers.JsonRpcProvider(rpcUrl));
    }
  }

  async executeRebalancing(
    userAddress: string,
    targetStrategies: any[]
  ): Promise<RebalancingResult> {
    try {
      // Generate rebalancing strategies
      const strategies = await this.generateRebalancingStrategies(
        userAddress,
        targetStrategies
      );

      if (strategies.length === 0) {
        return {
          success: true,
          strategies: []
        };
      }

      // Optimize gas usage
      const optimizedStrategies = await this.optimizeGasUsage(strategies);

      // Execute strategies in optimal order
      const executionResult = await this.executeStrategies(
        userAddress,
        optimizedStrategies.optimizedRoute
      );

      logger.info(`Rebalancing executed for ${userAddress}: ${executionResult.success ? 'SUCCESS' : 'FAILED'}`);

      return {
        success: executionResult.success,
        transactionHash: executionResult.transactionHash,
        gasUsed: optimizedStrategies.totalGasCost,
        strategies: optimizedStrategies.optimizedRoute,
        error: executionResult.error
      };

    } catch (error) {
      logger.error('Error executing rebalancing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown rebalancing error'
      };
    }
  }

  async simulateRebalancing(
    userAddress: string,
    targetStrategies: any[]
  ): Promise<{
    strategies: RebalancingStrategy[];
    estimatedGas: number;
    estimatedTime: number;
    expectedImprovement: number;
  }> {
    try {
      const strategies = await this.generateRebalancingStrategies(
        userAddress,
        targetStrategies
      );

      const gasOptimization = await this.optimizeGasUsage(strategies);
      const expectedImprovement = await this.calculateExpectedImprovement(
        userAddress,
        targetStrategies
      );

      return {
        strategies: gasOptimization.optimizedRoute,
        estimatedGas: gasOptimization.totalGasCost,
        estimatedTime: gasOptimization.executionTime,
        expectedImprovement
      };

    } catch (error) {
      logger.error('Error simulating rebalancing:', error);
      throw new Error('Failed to simulate rebalancing');
    }
  }

  async autoRebalancePortfolio(
    userAddress: string,
    preferences: {
      maxGasCost: number;
      minImprovementThreshold: number;
      riskTolerance: number;
    }
  ): Promise<RebalancingResult> {
    try {
      // Get current portfolio allocation
      const currentAllocation = await this.getCurrentAllocation(userAddress);
      
      // Calculate optimal allocation
      const optimalAllocation = await this.yieldAggregator.calculateOptimalAllocation(
        currentAllocation.totalValue,
        preferences.riskTolerance,
        currentAllocation.liquidityReserve
      );

      // Check if rebalancing is beneficial
      const expectedImprovement = await this.calculateExpectedImprovement(
        userAddress,
        optimalAllocation
      );

      if (expectedImprovement < preferences.minImprovementThreshold) {
        return {
          success: true,
          strategies: []
        };
      }

      // Execute rebalancing
      return await this.executeRebalancing(userAddress, optimalAllocation);

    } catch (error) {
      logger.error('Error in auto-rebalancing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-rebalancing failed'
      };
    }
  }

  private async generateRebalancingStrategies(
    userAddress: string,
    targetStrategies: any[]
  ): Promise<RebalancingStrategy[]> {
    try {
      const currentAllocation = await this.getCurrentAllocation(userAddress);
      const strategies: RebalancingStrategy[] = [];

      // Create a map of current allocations
      const currentMap = new Map<string, number>();
      currentAllocation.strategies.forEach((strategy: any) => {
        currentMap.set(`${strategy.protocol}-${strategy.chain}`, strategy.amount);
      });

      // Create a map of target allocations
      const targetMap = new Map<string, number>();
      targetStrategies.forEach((strategy: any) => {
        targetMap.set(`${strategy.protocol}-${strategy.chain}`, strategy.amount);
      });

      // Find positions to withdraw (current but not in target)
      for (const [key, currentAmount] of currentMap) {
        const targetAmount = targetMap.get(key) || 0;
        const [protocol, chain] = key.split('-');

        if (currentAmount > targetAmount) {
          const withdrawAmount = currentAmount - targetAmount;
          strategies.push({
            protocol,
            action: 'withdraw',
            amount: withdrawAmount.toString(),
            chain,
            priority: 1 // High priority to free up funds
          });
        }
      }

      // Find positions to deposit (target but not current or increase)
      for (const [key, targetAmount] of targetMap) {
        const currentAmount = currentMap.get(key) || 0;
        const [protocol, chain] = key.split('-');

        if (targetAmount > currentAmount) {
          const depositAmount = targetAmount - currentAmount;
          strategies.push({
            protocol,
            action: 'deposit',
            amount: depositAmount.toString(),
            chain,
            priority: 2 // Lower priority, after withdrawals
          });
        }
      }

      // Add cross-chain migrations if needed
      const crossChainStrategies = await this.identifyCrossChainOpportunities(
        strategies,
        targetStrategies
      );
      strategies.push(...crossChainStrategies);

      return strategies.sort((a, b) => a.priority - b.priority);

    } catch (error) {
      logger.error('Error generating rebalancing strategies:', error);
      return [];
    }
  }

  private async optimizeGasUsage(strategies: RebalancingStrategy[]): Promise<GasOptimization> {
    try {
      let totalGasCost = 0;
      let executionTime = 0;
      const optimizedRoute: RebalancingStrategy[] = [];

      // Group strategies by chain to batch operations
      const chainGroups = new Map<string, RebalancingStrategy[]>();
      strategies.forEach(strategy => {
        const chain = strategy.chain;
        if (!chainGroups.has(chain)) {
          chainGroups.set(chain, []);
        }
        chainGroups.get(chain)!.push(strategy);
      });

      // Optimize each chain's operations
      for (const [chain, chainStrategies] of chainGroups) {
        const optimized = await this.optimizeChainOperations(chain, chainStrategies);
        optimizedRoute.push(...optimized.strategies);
        totalGasCost += optimized.gasCost;
        executionTime = Math.max(executionTime, optimized.executionTime);
      }

      // Calculate savings compared to naive execution
      const naiveGasCost = strategies.length * 200000; // Assume 200k gas per operation
      const savings = Math.max(0, naiveGasCost - totalGasCost);

      return {
        totalGasCost,
        optimizedRoute,
        savings,
        executionTime
      };

    } catch (error) {
      logger.error('Error optimizing gas usage:', error);
      return {
        totalGasCost: strategies.length * 200000,
        optimizedRoute: strategies,
        savings: 0,
        executionTime: strategies.length * 30 // 30 seconds per operation
      };
    }
  }

  private async optimizeChainOperations(
    chain: string,
    strategies: RebalancingStrategy[]
  ): Promise<{
    strategies: RebalancingStrategy[];
    gasCost: number;
    executionTime: number;
  }> {
    // Group by protocol to batch operations
    const protocolGroups = new Map<string, RebalancingStrategy[]>();
    strategies.forEach(strategy => {
      if (!protocolGroups.has(strategy.protocol)) {
        protocolGroups.set(strategy.protocol, []);
      }
      protocolGroups.get(strategy.protocol)!.push(strategy);
    });

    const optimizedStrategies: RebalancingStrategy[] = [];
    let totalGasCost = 0;
    let maxExecutionTime = 0;

    for (const [protocol, protocolStrategies] of protocolGroups) {
      // Check if we can batch operations for this protocol
      const batched = await this.batchProtocolOperations(protocol, protocolStrategies);
      optimizedStrategies.push(...batched.strategies);
      totalGasCost += batched.gasCost;
      maxExecutionTime = Math.max(maxExecutionTime, batched.executionTime);
    }

    return {
      strategies: optimizedStrategies,
      gasCost: totalGasCost,
      executionTime: maxExecutionTime
    };
  }

  private async batchProtocolOperations(
    protocol: string,
    strategies: RebalancingStrategy[]
  ): Promise<{
    strategies: RebalancingStrategy[];
    gasCost: number;
    executionTime: number;
  }> {
    // For protocols that support batching, combine operations
    if (this.supportsBatching(protocol)) {
      // Combine multiple operations into a single transaction
      const batchedStrategy = this.createBatchedStrategy(strategies);
      return {
        strategies: [batchedStrategy],
        gasCost: 150000, // Lower gas for batched operation
        executionTime: 45 // Slightly longer for batch
      };
    }

    // For protocols without batching, return individual operations
    return {
      strategies: strategies,
      gasCost: strategies.length * 120000, // Individual operations
      executionTime: strategies.length * 30
    };
  }

  private supportsBatching(protocol: string): boolean {
    // Check if protocol supports batch operations
    const batchSupportedProtocols = ['Aave', 'Compound', 'Yearn'];
    return batchSupportedProtocols.some(p => 
      protocol.toLowerCase().includes(p.toLowerCase())
    );
  }

  private createBatchedStrategy(strategies: RebalancingStrategy[]): RebalancingStrategy {
    // Combine multiple strategies into a single batched operation
    const totalWithdraw = strategies
      .filter(s => s.action === 'withdraw')
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);
    
    const totalDeposit = strategies
      .filter(s => s.action === 'deposit')
      .reduce((sum, s) => sum + parseFloat(s.amount), 0);

    // Create a net strategy
    const netAmount = totalDeposit - totalWithdraw;
    
    return {
      protocol: strategies[0].protocol,
      action: netAmount > 0 ? 'deposit' : 'withdraw',
      amount: Math.abs(netAmount).toString(),
      chain: strategies[0].chain,
      priority: 1
    };
  }

  private async identifyCrossChainOpportunities(
    currentStrategies: RebalancingStrategy[],
    targetStrategies: any[]
  ): Promise<RebalancingStrategy[]> {
    const crossChainStrategies: RebalancingStrategy[] = [];

    // Look for opportunities to migrate between chains
    for (const target of targetStrategies) {
      // Check if there's a better opportunity on a different chain
      const betterChainOpportunity = await this.findBetterChainOpportunity(target);
      
      if (betterChainOpportunity) {
        crossChainStrategies.push({
          protocol: target.protocol,
          action: 'migrate',
          amount: target.amount.toString(),
          fromProtocol: target.protocol,
          toProtocol: target.protocol,
          chain: target.chain,
          targetChain: betterChainOpportunity.chain,
          priority: 3 // Lower priority for cross-chain operations
        });
      }
    }

    return crossChainStrategies;
  }

  private async findBetterChainOpportunity(strategy: any): Promise<any | null> {
    try {
      const chains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];
      let bestOpportunity = null;
      let bestAPY = strategy.expectedAPY;

      for (const chain of chains) {
        if (chain === strategy.chain) continue;

        try {
          const chainYield = await this.yieldAggregator.getProtocolYield(
            `${strategy.protocol} ${chain}`
          );

          // Factor in bridging costs
          const bridgingCost = await this.estimateBridgingCost(
            strategy.chain,
            chain,
            strategy.amount
          );

          const netAPY = chainYield.apy - (bridgingCost / strategy.amount) * 100;

          if (netAPY > bestAPY * 1.02) { // Require 2% improvement to justify move
            bestAPY = netAPY;
            bestOpportunity = {
              chain,
              apy: netAPY,
              bridgingCost
            };
          }
        } catch (error) {
          logger.warn(`Error checking opportunity on ${chain}:`, error);
        }
      }

      return bestOpportunity;

    } catch (error) {
      logger.error('Error finding better chain opportunity:', error);
      return null;
    }
  }

  private async executeStrategies(
    userAddress: string,
    strategies: RebalancingStrategy[]
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      const transactions = [];

      for (const strategy of strategies) {
        const transaction = await this.buildTransactionForStrategy(strategy, userAddress);
        if (transaction) {
          transactions.push(transaction);
        }
      }

      if (transactions.length === 0) {
        return { success: true };
      }

      // For now, return the transaction data to be executed by the frontend
      // In a full implementation, this would use account abstraction or delegation
      
      logger.info(`Built ${transactions.length} transactions for rebalancing`);
      
      return {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64) // Mock hash
      };

    } catch (error) {
      logger.error('Error executing strategies:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  private async buildTransactionForStrategy(
    strategy: RebalancingStrategy,
    userAddress: string
  ): Promise<any> {
    try {
      switch (strategy.action) {
        case 'deposit':
          return await this.buildDepositTransaction(strategy, userAddress);
        case 'withdraw':
          return await this.buildWithdrawTransaction(strategy, userAddress);
        case 'migrate':
          return await this.buildMigrateTransaction(strategy, userAddress);
        default:
          return null;
      }
    } catch (error) {
      logger.error(`Error building transaction for strategy ${strategy.action}:`, error);
      return null;
    }
  }

  private async buildDepositTransaction(strategy: RebalancingStrategy, userAddress: string): Promise<any> {
    // Build protocol-specific deposit transaction
    return {
      to: '0x' + strategy.protocol.slice(0, 40).padEnd(40, '0'),
      data: '0x', // Protocol-specific call data
      value: '0',
      gasLimit: '150000'
    };
  }

  private async buildWithdrawTransaction(strategy: RebalancingStrategy, userAddress: string): Promise<any> {
    // Build protocol-specific withdraw transaction
    return {
      to: '0x' + strategy.protocol.slice(0, 40).padEnd(40, '0'),
      data: '0x', // Protocol-specific call data
      value: '0',
      gasLimit: '120000'
    };
  }

  private async buildMigrateTransaction(strategy: RebalancingStrategy, userAddress: string): Promise<any> {
    // Build cross-chain migration transaction using LI.FI
    if (!strategy.targetChain) return null;

    const route = await this.lifiIntegration.findOptimalRoute(
      strategy.chain as any,
      strategy.targetChain as any,
      { address: ethers.constants.AddressZero } as any,
      { address: ethers.constants.AddressZero } as any,
      strategy.amount
    );

    return route;
  }

  private async getCurrentAllocation(userAddress: string): Promise<any> {
    // This would fetch from database
    return {
      totalValue: 100000,
      liquidityReserve: 10000,
      strategies: []
    };
  }

  private async calculateExpectedImprovement(
    userAddress: string,
    targetStrategies: any[]
  ): Promise<number> {
    try {
      const currentAllocation = await this.getCurrentAllocation(userAddress);
      
      // Calculate current weighted APY
      const currentAPY = currentAllocation.strategies.reduce((weighted: number, strategy: any) => {
        const weight = strategy.amount / currentAllocation.totalValue;
        return weighted + (strategy.apy * weight);
      }, 0);

      // Calculate target weighted APY
      const targetAPY = targetStrategies.reduce((weighted, strategy) => {
        const weight = strategy.amount / currentAllocation.totalValue;
        return weighted + (strategy.expectedAPY * weight);
      }, 0);

      return ((targetAPY - currentAPY) / currentAPY) * 100;

    } catch (error) {
      logger.error('Error calculating expected improvement:', error);
      return 0;
    }
  }

  private async estimateBridgingCost(
    fromChain: string,
    toChain: string,
    amount: number
  ): Promise<number> {
    try {
      // Estimate cross-chain bridging costs
      const baseCost = 10; // $10 base cost
      const percentageCost = amount * 0.001; // 0.1% of amount
      
      return baseCost + percentageCost;

    } catch (error) {
      logger.error('Error estimating bridging cost:', error);
      return 50; // Conservative estimate
    }
  }
}
