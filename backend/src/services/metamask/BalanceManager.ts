import { CardIntegration } from './CardIntegration';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';

export interface BalanceSnapshot {
  timestamp: Date;
  cardBalance: string;
  portfolioBalance: string;
  liquidityReserve: string;
  totalBalance: string;
  utilizationRate: number;
}

export interface BalanceAlert {
  type: 'low_balance' | 'high_utilization' | 'imbalance' | 'insufficient_reserve';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentValue: string;
  thresholdValue: string;
  recommendedAction: string;
  timestamp: Date;
}

export interface RebalanceRecommendation {
  action: 'increase_reserve' | 'decrease_reserve' | 'rebalance_portfolio' | 'top_up_card';
  amount: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedGasCost: string;
  expectedBenefit: string;
}

export interface LiquidityMetrics {
  liquidityRatio: number; // card balance / total balance
  reserveRatio: number; // reserve / total balance
  utilizationRate: number; // used / available
  efficiency: number; // yield earning / total balance
  optimalRange: {
    min: number;
    max: number;
  };
}

export class BalanceManager {
  private cardIntegration: CardIntegration;
  private provider: ethers.providers.JsonRpcProvider;
  private balanceHistory: Map<string, BalanceSnapshot[]> = new Map();

  // Default thresholds
  private readonly thresholds = {
    lowBalance: 50, // $50
    highUtilization: 0.8, // 80%
    minReserve: 100, // $100
    maxReserve: 1000, // $1000
    rebalanceThreshold: 0.05 // 5%
  };

  constructor() {
    this.cardIntegration = new CardIntegration();
    this.provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL!);
  }

  async getCardBalance(userAddress: string): Promise<{
    available: string;
    pending: string;
    total: string;
    currency: string;
    lastUpdated: string;
  }> {
    try {
      const balance = await this.cardIntegration.getCardBalance(userAddress);
      
      return {
        available: balance.available,
        pending: balance.pending,
        total: balance.total,
        currency: balance.currency,
        lastUpdated: balance.lastUpdated.toISOString()
      };

    } catch (error) {
      logger.error(`Error getting card balance for ${userAddress}:`, error);
      throw new Error(`Failed to get card balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPortfolioBalance(userAddress: string): Promise<{
    totalValue: string;
    deployedAmount: string;
    yieldEarned: string;
    liquidityReserve: string;
  }> {
    try {
      // Get USDC balance from wallet
      const usdcAddress = '0xA0b86a33E6417c68c1CA1E32BcE04EF3D9C77E4E'; // USDC on Ethereum
      const usdcContract = new ethers.Contract(
        usdcAddress,
        [
          'function balanceOf(address account) external view returns (uint256)',
          'function decimals() external view returns (uint8)'
        ],
        this.provider
      );

      const [balance, decimals] = await Promise.all([
        usdcContract.balanceOf(userAddress),
        usdcContract.decimals()
      ]);

      const totalValue = ethers.utils.formatUnits(balance, decimals);

      // This would typically fetch from database for actual deployed amounts
      const deployedAmount = (parseFloat(totalValue) * 0.8).toString(); // 80% deployed
      const yieldEarned = (parseFloat(deployedAmount) * 0.05).toString(); // 5% yield
      const liquidityReserve = (parseFloat(totalValue) * 0.2).toString(); // 20% reserve

      return {
        totalValue,
        deployedAmount,
        yieldEarned,
        liquidityReserve
      };

    } catch (error) {
      logger.error(`Error getting portfolio balance for ${userAddress}:`, error);
      throw new Error(`Failed to get portfolio balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createBalanceSnapshot(userAddress: string): Promise<BalanceSnapshot> {
    try {
      const [cardBalance, portfolioBalance] = await Promise.all([
        this.getCardBalance(userAddress),
        this.getPortfolioBalance(userAddress)
      ]);

      const totalBalance = (parseFloat(cardBalance.total) + parseFloat(portfolioBalance.totalValue)).toString();
      const utilizationRate = parseFloat(cardBalance.total) > 0 
        ? (parseFloat(cardBalance.total) - parseFloat(cardBalance.available)) / parseFloat(cardBalance.total)
        : 0;

      const snapshot: BalanceSnapshot = {
        timestamp: new Date(),
        cardBalance: cardBalance.total,
        portfolioBalance: portfolioBalance.totalValue,
        liquidityReserve: portfolioBalance.liquidityReserve,
        totalBalance,
        utilizationRate
      };

      // Store in history
      const history = this.balanceHistory.get(userAddress) || [];
      history.push(snapshot);
      
      // Keep only last 100 snapshots
      if (history.length > 100) {
        history.shift();
      }
      
      this.balanceHistory.set(userAddress, history);

      logger.info(`Balance snapshot created for ${userAddress}: $${totalBalance} total`);
      return snapshot;

    } catch (error) {
      logger.error(`Error creating balance snapshot for ${userAddress}:`, error);
      throw new Error(`Failed to create balance snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectBalanceAlerts(userAddress: string): Promise<BalanceAlert[]> {
    try {
      const snapshot = await this.createBalanceSnapshot(userAddress);
      const alerts: BalanceAlert[] = [];

      // Low balance alert
      if (parseFloat(snapshot.cardBalance) < this.thresholds.lowBalance) {
        alerts.push({
          type: 'low_balance',
          severity: parseFloat(snapshot.cardBalance) < this.thresholds.lowBalance / 2 ? 'critical' : 'high',
          message: `Card balance is critically low: $${snapshot.cardBalance}`,
          currentValue: snapshot.cardBalance,
          thresholdValue: this.thresholds.lowBalance.toString(),
          recommendedAction: 'Top up card immediately or enable auto-top-up',
          timestamp: new Date()
        });
      }

      // High utilization alert
      if (snapshot.utilizationRate > this.thresholds.highUtilization) {
        alerts.push({
          type: 'high_utilization',
          severity: snapshot.utilizationRate > 0.95 ? 'critical' : 'medium',
          message: `Card utilization is high: ${(snapshot.utilizationRate * 100).toFixed(1)}%`,
          currentValue: (snapshot.utilizationRate * 100).toFixed(1) + '%',
          thresholdValue: (this.thresholds.highUtilization * 100).toString() + '%',
          recommendedAction: 'Consider increasing card limit or reducing spending',
          timestamp: new Date()
        });
      }

      // Insufficient reserve alert
      const reserveAmount = parseFloat(snapshot.liquidityReserve);
      if (reserveAmount < this.thresholds.minReserve) {
        alerts.push({
          type: 'insufficient_reserve',
          severity: 'medium',
          message: `Liquidity reserve is below minimum: $${reserveAmount}`,
          currentValue: reserveAmount.toString(),
          thresholdValue: this.thresholds.minReserve.toString(),
          recommendedAction: 'Rebalance portfolio to increase liquidity reserve',
          timestamp: new Date()
        });
      }

      // Portfolio imbalance alert
      const cardRatio = parseFloat(snapshot.cardBalance) / parseFloat(snapshot.totalBalance);
      if (cardRatio < 0.05 || cardRatio > 0.5) {
        alerts.push({
          type: 'imbalance',
          severity: 'low',
          message: `Portfolio allocation may be imbalanced: ${(cardRatio * 100).toFixed(1)}% in card`,
          currentValue: (cardRatio * 100).toFixed(1) + '%',
          thresholdValue: '5-50%',
          recommendedAction: 'Consider rebalancing between card and portfolio',
          timestamp: new Date()
        });
      }

      logger.info(`Generated ${alerts.length} balance alerts for ${userAddress}`);
      return alerts;

    } catch (error) {
      logger.error(`Error detecting balance alerts for ${userAddress}:`, error);
      return [];
    }
  }

  async generateRebalanceRecommendations(userAddress: string): Promise<RebalanceRecommendation[]> {
    try {
      const snapshot = await this.createBalanceSnapshot(userAddress);
      const alerts = await this.detectBalanceAlerts(userAddress);
      const recommendations: RebalanceRecommendation[] = [];

      // Analyze current state
      const cardBalance = parseFloat(snapshot.cardBalance);
      const portfolioBalance = parseFloat(snapshot.portfolioBalance);
      const totalBalance = parseFloat(snapshot.totalBalance);
      const liquidityReserve = parseFloat(snapshot.liquidityReserve);

      // Low card balance recommendation
      if (cardBalance < this.thresholds.lowBalance) {
        const recommendedTopUp = Math.max(
          this.thresholds.lowBalance * 2,
          liquidityReserve * 0.5
        );

        recommendations.push({
          action: 'top_up_card',
          amount: recommendedTopUp.toString(),
          reason: 'Card balance is below safe threshold',
          priority: cardBalance < this.thresholds.lowBalance / 2 ? 'high' : 'medium',
          estimatedGasCost: '5',
          expectedBenefit: 'Prevent card transaction failures and maintain spending capability'
        });
      }

      // Insufficient reserve recommendation
      if (liquidityReserve < this.thresholds.minReserve) {
        const recommendedIncrease = this.thresholds.minReserve - liquidityReserve;

        recommendations.push({
          action: 'increase_reserve',
          amount: recommendedIncrease.toString(),
          reason: 'Liquidity reserve is below minimum safe level',
          priority: 'medium',
          estimatedGasCost: '15',
          expectedBenefit: 'Improve liquidity management and reduce rebalancing frequency'
        });
      }

      // Excess reserve recommendation
      if (liquidityReserve > this.thresholds.maxReserve && portfolioBalance > 0) {
        const excessAmount = liquidityReserve - this.thresholds.maxReserve;

        recommendations.push({
          action: 'decrease_reserve',
          amount: excessAmount.toString(),
          reason: 'Excess liquidity could be deployed for yield generation',
          priority: 'low',
          estimatedGasCost: '20',
          expectedBenefit: `Potentially earn additional ${(excessAmount * 0.05).toFixed(2)} annually in yield`
        });
      }

      // Portfolio rebalancing recommendation
      const optimalCardRatio = 0.1; // 10% in card
      const currentCardRatio = cardBalance / totalBalance;
      
      if (Math.abs(currentCardRatio - optimalCardRatio) > this.thresholds.rebalanceThreshold) {
        const targetCardBalance = totalBalance * optimalCardRatio;
        const rebalanceAmount = Math.abs(targetCardBalance - cardBalance);

        recommendations.push({
          action: 'rebalance_portfolio',
          amount: rebalanceAmount.toString(),
          reason: `Card allocation (${(currentCardRatio * 100).toFixed(1)}%) deviates from optimal (${(optimalCardRatio * 100).toFixed(1)}%)`,
          priority: 'low',
          estimatedGasCost: '25',
          expectedBenefit: 'Optimize risk-adjusted returns and liquidity management'
        });
      }

      // Sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

      logger.info(`Generated ${recommendations.length} rebalance recommendations for ${userAddress}`);
      return recommendations;

    } catch (error) {
      logger.error(`Error generating rebalance recommendations for ${userAddress}:`, error);
      return [];
    }
  }

  async calculateLiquidityMetrics(userAddress: string): Promise<LiquidityMetrics> {
    try {
      const snapshot = await this.createBalanceSnapshot(userAddress);
      
      const cardBalance = parseFloat(snapshot.cardBalance);
      const totalBalance = parseFloat(snapshot.totalBalance);
      const liquidityReserve = parseFloat(snapshot.liquidityReserve);
      
      const liquidityRatio = totalBalance > 0 ? cardBalance / totalBalance : 0;
      const reserveRatio = totalBalance > 0 ? liquidityReserve / totalBalance : 0;
      const utilizationRate = snapshot.utilizationRate;
      
      // Calculate efficiency (simplified)
      const portfolioBalance = parseFloat(snapshot.portfolioBalance);
      const deployedBalance = portfolioBalance - liquidityReserve;
      const estimatedYield = deployedBalance * 0.05; // 5% APY assumption
      const efficiency = totalBalance > 0 ? estimatedYield / totalBalance : 0;

      const metrics: LiquidityMetrics = {
        liquidityRatio,
        reserveRatio,
        utilizationRate,
        efficiency,
        optimalRange: {
          min: 0.05, // 5% minimum in card
          max: 0.3   // 30% maximum in card
        }
      };

      logger.info(`Calculated liquidity metrics for ${userAddress}: ${(liquidityRatio * 100).toFixed(1)}% liquidity ratio`);
      return metrics;

    } catch (error) {
      logger.error(`Error calculating liquidity metrics for ${userAddress}:`, error);
      throw new Error(`Failed to calculate liquidity metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBalanceHistory(
    userAddress: string,
    days: number = 30
  ): Promise<BalanceSnapshot[]> {
    try {
      const history = this.balanceHistory.get(userAddress) || [];
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const filteredHistory = history.filter(snapshot => snapshot.timestamp >= cutoffDate);
      
      logger.info(`Retrieved ${filteredHistory.length} balance snapshots for ${userAddress}`);
      return filteredHistory;

    } catch (error) {
      logger.error(`Error getting balance history for ${userAddress}:`, error);
      return [];
    }
  }

  async optimizeBalanceDistribution(userAddress: string): Promise<{
    currentDistribution: { card: number; portfolio: number; reserve: number };
    optimalDistribution: { card: number; portfolio: number; reserve: number };
    recommendations: string[];
    expectedImprovement: number;
  }> {
    try {
      const snapshot = await this.createBalanceSnapshot(userAddress);
      const totalBalance = parseFloat(snapshot.totalBalance);
      
      if (totalBalance === 0) {
        return {
          currentDistribution: { card: 0, portfolio: 0, reserve: 0 },
          optimalDistribution: { card: 0, portfolio: 0, reserve: 0 },
          recommendations: ['Deposit funds to begin optimization'],
          expectedImprovement: 0
        };
      }

      // Current distribution
      const currentDistribution = {
        card: parseFloat(snapshot.cardBalance) / totalBalance,
        portfolio: parseFloat(snapshot.portfolioBalance) / totalBalance,
        reserve: parseFloat(snapshot.liquidityReserve) / totalBalance
      };

      // Optimal distribution based on spending patterns and yield opportunities
      const spendingData = await this.cardIntegration.analyzeSpendingPattern(userAddress);
      const weeklySpendingNeed = spendingData.predictedNextWeek;
      const optimalCardBalance = Math.min(weeklySpendingNeed * 2, totalBalance * 0.3); // 2 weeks of spending or 30% max
      const optimalReserve = Math.max(weeklySpendingNeed * 1.5, totalBalance * 0.1); // 1.5 weeks reserve or 10% min
      
      const optimalDistribution = {
        card: optimalCardBalance / totalBalance,
        reserve: optimalReserve / totalBalance,
        portfolio: 1 - (optimalCardBalance / totalBalance) - (optimalReserve / totalBalance)
      };

      // Generate recommendations
      const recommendations: string[] = [];
      const cardDiff = optimalDistribution.card - currentDistribution.card;
      const reserveDiff = optimalDistribution.reserve - currentDistribution.reserve;

      if (Math.abs(cardDiff) > 0.05) {
        const action = cardDiff > 0 ? 'increase' : 'decrease';
        const amount = Math.abs(cardDiff * totalBalance);
        recommendations.push(`${action.charAt(0).toUpperCase() + action.slice(1)} card balance by $${amount.toFixed(2)}`);
      }

      if (Math.abs(reserveDiff) > 0.05) {
        const action = reserveDiff > 0 ? 'increase' : 'decrease';
        const amount = Math.abs(reserveDiff * totalBalance);
        recommendations.push(`${action.charAt(0).toUpperCase() + action.slice(1)} liquidity reserve by $${amount.toFixed(2)}`);
      }

      // Calculate expected improvement (simplified)
      const currentYield = currentDistribution.portfolio * totalBalance * 0.05; // 5% APY
      const optimalYield = optimalDistribution.portfolio * totalBalance * 0.05;
      const expectedImprovement = ((optimalYield - currentYield) / totalBalance) * 100;

      return {
        currentDistribution,
        optimalDistribution,
        recommendations,
        expectedImprovement
      };

    } catch (error) {
      logger.error(`Error optimizing balance distribution for ${userAddress}:`, error);
      throw new Error(`Failed to optimize balance distribution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
