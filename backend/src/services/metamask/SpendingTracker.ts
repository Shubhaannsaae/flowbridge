import { CardIntegration, CardTransaction } from './CardIntegration';
import { logger } from '../../utils/logger';

export interface SpendingAnalytics {
  dailyAverage: number;
  weeklyAverage: number;
  monthlyTotal: number;
  largestTransaction: {
    amount: number;
    merchant: string;
    date: Date;
  };
  categories: Record<string, {
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
  trends: {
    last7Days: number[];
    last30Days: number[];
    monthlyTrend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
  };
  predictedNextWeek: number;
  recommendedReserve: number;
  spendingVelocity: number; // transactions per day
  averageTransactionSize: number;
}

export interface SpendingAlert {
  type: 'high_spending' | 'unusual_pattern' | 'large_transaction' | 'category_spike';
  severity: 'low' | 'medium' | 'high';
  message: string;
  amount?: number;
  category?: string;
  timestamp: Date;
  recommendations: string[];
}

export interface BudgetTracking {
  categories: Record<string, {
    budget: number;
    spent: number;
    remaining: number;
    isOverBudget: boolean;
    daysRemaining: number;
  }>;
  totalBudget: number;
  totalSpent: number;
  projectedMonthlySpend: number;
  budgetStatus: 'on_track' | 'over_budget' | 'under_budget';
}

export class SpendingTracker {
  private cardIntegration: CardIntegration;
  private alertThresholds = {
    largeTransaction: 500, // $500
    unusualSpendingMultiplier: 2.5, // 250% of average
    categorySpike: 3.0 // 300% of category average
  };

  constructor() {
    this.cardIntegration = new CardIntegration();
  }

  async getSpendingAnalytics(userAddress: string, days: number = 90): Promise<SpendingAnalytics> {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const transactions = await this.cardIntegration.getCardTransactions(
        userAddress,
        fromDate,
        new Date()
      );

      const purchaseTransactions = transactions.filter(
        tx => tx.type === 'purchase' && tx.status === 'completed'
      );

      if (purchaseTransactions.length === 0) {
        return this.getEmptyAnalytics();
      }

      // Calculate basic metrics
      const totalSpent = purchaseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const daysAnalyzed = Math.min(days, this.getDaysSpan(purchaseTransactions));
      
      const dailyAverage = totalSpent / daysAnalyzed;
      const weeklyAverage = dailyAverage * 7;
      const monthlyTotal = dailyAverage * 30;

      // Find largest transaction
      const largestTransaction = purchaseTransactions.reduce((largest, tx) => {
        const amount = parseFloat(tx.amount);
        return amount > largest.amount ? {
          amount,
          merchant: tx.merchant,
          date: tx.timestamp
        } : largest;
      }, { amount: 0, merchant: '', date: new Date() });

      // Category analysis
      const categories = this.analyzeCategoriesSpending(purchaseTransactions, totalSpent);

      // Trend analysis
      const trends = this.calculateSpendingTrends(purchaseTransactions);

      // Predictions
      const predictedNextWeek = this.predictNextWeekSpending(purchaseTransactions, trends);
      const recommendedReserve = Math.max(predictedNextWeek * 1.5, dailyAverage * 10);

      // Additional metrics
      const spendingVelocity = purchaseTransactions.length / daysAnalyzed;
      const averageTransactionSize = totalSpent / purchaseTransactions.length;

      const analytics: SpendingAnalytics = {
        dailyAverage,
        weeklyAverage,
        monthlyTotal,
        largestTransaction,
        categories,
        trends,
        predictedNextWeek,
        recommendedReserve,
        spendingVelocity,
        averageTransactionSize
      };

      logger.info(`Generated spending analytics for ${userAddress}: $${dailyAverage.toFixed(2)}/day`);
      return analytics;

    } catch (error) {
      logger.error('Error getting spending analytics:', error);
      throw new Error(`Failed to get spending analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectSpendingAlerts(userAddress: string): Promise<SpendingAlert[]> {
    try {
      const analytics = await this.getSpendingAnalytics(userAddress, 30);
      const alerts: SpendingAlert[] = [];

      // Check for large transactions
      if (analytics.largestTransaction.amount > this.alertThresholds.largeTransaction) {
        alerts.push({
          type: 'large_transaction',
          severity: 'medium',
          message: `Large transaction detected: $${analytics.largestTransaction.amount} at ${analytics.largestTransaction.merchant}`,
          amount: analytics.largestTransaction.amount,
          timestamp: analytics.largestTransaction.date,
          recommendations: [
            'Review transaction details',
            'Consider setting transaction limits',
            'Enable transaction notifications'
          ]
        });
      }

      // Check for unusual spending patterns
      const currentWeekSpending = analytics.trends.last7Days.reduce((sum, day) => sum + day, 0);
      if (currentWeekSpending > analytics.weeklyAverage * this.alertThresholds.unusualSpendingMultiplier) {
        alerts.push({
          type: 'unusual_pattern',
          severity: 'high',
          message: `Spending is ${((currentWeekSpending / analytics.weeklyAverage - 1) * 100).toFixed(0)}% above average`,
          amount: currentWeekSpending,
          timestamp: new Date(),
          recommendations: [
            'Review recent transactions',
            'Check for unauthorized charges',
            'Consider increasing card monitoring'
          ]
        });
      }

      // Check for category spikes
      for (const [category, data] of Object.entries(analytics.categories)) {
        const categoryAverage = data.amount / 30; // Daily average for category
        const recentCategorySpending = this.getRecentCategorySpending(userAddress, category, 7);
        
        if (recentCategorySpending > categoryAverage * 7 * this.alertThresholds.categorySpike) {
          alerts.push({
            type: 'category_spike',
            severity: 'medium',
            message: `Unusual spending spike in ${category}: ${((recentCategorySpending / (categoryAverage * 7) - 1) * 100).toFixed(0)}% above normal`,
            category,
            amount: recentCategorySpending,
            timestamp: new Date(),
            recommendations: [
              `Review ${category} transactions`,
              'Check if this aligns with your budget',
              'Consider setting category limits'
            ]
          });
        }
      }

      logger.info(`Generated ${alerts.length} spending alerts for ${userAddress}`);
      return alerts;

    } catch (error) {
      logger.error('Error detecting spending alerts:', error);
      return [];
    }
  }

  async trackBudget(
    userAddress: string,
    budgets: Record<string, number>
  ): Promise<BudgetTracking> {
    try {
      const analytics = await this.getSpendingAnalytics(userAddress, 30);
      const currentDate = new Date();
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const daysPassed = currentDate.getDate();
      const daysRemaining = daysInMonth - daysPassed;

      const categories: Record<string, any> = {};
      let totalBudget = 0;
      let totalSpent = 0;

      for (const [category, budget] of Object.entries(budgets)) {
        const categoryData = analytics.categories[category];
        const spent = categoryData ? categoryData.amount : 0;
        
        totalBudget += budget;
        totalSpent += spent;

        categories[category] = {
          budget,
          spent,
          remaining: budget - spent,
          isOverBudget: spent > budget,
          daysRemaining
        };
      }

      // Calculate projected spending
      const dailySpendRate = totalSpent / daysPassed;
      const projectedMonthlySpend = dailySpendRate * daysInMonth;

      let budgetStatus: 'on_track' | 'over_budget' | 'under_budget' = 'on_track';
      if (projectedMonthlySpend > totalBudget * 1.05) {
        budgetStatus = 'over_budget';
      } else if (projectedMonthlySpend < totalBudget * 0.9) {
        budgetStatus = 'under_budget';
      }

      const budgetTracking: BudgetTracking = {
        categories,
        totalBudget,
        totalSpent,
        projectedMonthlySpend,
        budgetStatus
      };

      logger.info(`Generated budget tracking for ${userAddress}: ${budgetStatus}`);
      return budgetTracking;

    } catch (error) {
      logger.error('Error tracking budget:', error);
      throw new Error(`Failed to track budget: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOptimalTopUpTiming(userAddress: string): Promise<{
    recommendedAmount: number;
    urgency: 'low' | 'medium' | 'high';
    daysUntilEmpty: number;
    confidence: number;
  }> {
    try {
      const analytics = await this.getSpendingAnalytics(userAddress, 30);
      const balance = await this.cardIntegration.getCardBalance(userAddress);
      
      const currentBalance = parseFloat(balance.available);
      const dailySpendRate = analytics.dailyAverage;
      
      const daysUntilEmpty = dailySpendRate > 0 ? currentBalance / dailySpendRate : 999;
      
      let urgency: 'low' | 'medium' | 'high' = 'low';
      if (daysUntilEmpty <= 3) urgency = 'high';
      else if (daysUntilEmpty <= 7) urgency = 'medium';

      // Recommend top-up amount based on spending pattern
      const recommendedAmount = Math.max(
        analytics.predictedNextWeek,
        analytics.dailyAverage * 14 // 2 weeks worth
      );

      // Calculate confidence based on spending consistency
      const spendingVariance = this.calculateSpendingVariance(analytics.trends.last30Days);
      const confidence = Math.max(0.5, 1 - spendingVariance);

      return {
        recommendedAmount,
        urgency,
        daysUntilEmpty,
        confidence
      };

    } catch (error) {
      logger.error('Error calculating optimal top-up timing:', error);
      throw new Error(`Failed to calculate top-up timing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private analyzeCategoriesSpending(
    transactions: CardTransaction[],
    totalSpent: number
  ): Record<string, { amount: number; percentage: number; transactionCount: number }> {
    const categories: Record<string, { amount: number; transactionCount: number }> = {};

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      if (!categories[tx.category]) {
        categories[tx.category] = { amount: 0, transactionCount: 0 };
      }
      categories[tx.category].amount += amount;
      categories[tx.category].transactionCount += 1;
    });

    const result: Record<string, { amount: number; percentage: number; transactionCount: number }> = {};
    for (const [category, data] of Object.entries(categories)) {
      result[category] = {
        amount: data.amount,
        percentage: (data.amount / totalSpent) * 100,
        transactionCount: data.transactionCount
      };
    }

    return result;
  }

  private calculateSpendingTrends(transactions: CardTransaction[]): {
    last7Days: number[];
    last30Days: number[];
    monthlyTrend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
  } {
    const now = new Date();
    const last7Days: number[] = [];
    const last30Days: number[] = [];

    // Calculate daily spending for last 30 days
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const daySpending = transactions
        .filter(tx => tx.timestamp >= dayStart && tx.timestamp < dayEnd)
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      last30Days.push(daySpending);
      if (i < 7) {
        last7Days.push(daySpending);
      }
    }

    // Calculate trend
    const firstHalf = last30Days.slice(0, 15).reduce((sum, day) => sum + day, 0) / 15;
    const secondHalf = last30Days.slice(15).reduce((sum, day) => sum + day, 0) / 15;
    
    const trendPercentage = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    
    let monthlyTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(trendPercentage) > 10) {
      monthlyTrend = trendPercentage > 0 ? 'increasing' : 'decreasing';
    }

    return {
      last7Days,
      last30Days,
      monthlyTrend,
      trendPercentage
    };
  }

  private predictNextWeekSpending(
    transactions: CardTransaction[],
    trends: { monthlyTrend: string; trendPercentage: number; last7Days: number[] }
  ): number {
    const recentWeekSpending = trends.last7Days.reduce((sum, day) => sum + day, 0);
    
    // Apply trend adjustment
    let adjustmentFactor = 1;
    if (trends.monthlyTrend === 'increasing') {
      adjustmentFactor = 1 + (trends.trendPercentage / 100) * 0.5; // Moderate the trend
    } else if (trends.monthlyTrend === 'decreasing') {
      adjustmentFactor = 1 + (trends.trendPercentage / 100) * 0.5;
    }

    return recentWeekSpending * adjustmentFactor;
  }

  private getDaysSpan(transactions: CardTransaction[]): number {
    if (transactions.length === 0) return 1;
    
    const timestamps = transactions.map(tx => tx.timestamp.getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    
    return Math.max(1, (latest - earliest) / (24 * 60 * 60 * 1000));
  }

  private async getRecentCategorySpending(
    userAddress: string,
    category: string,
    days: number
  ): Promise<number> {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const transactions = await this.cardIntegration.getCardTransactions(
        userAddress,
        fromDate,
        new Date()
      );

      return transactions
        .filter(tx => tx.category === category && tx.type === 'purchase' && tx.status === 'completed')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    } catch (error) {
      logger.error('Error getting recent category spending:', error);
      return 0;
    }
  }

  private calculateSpendingVariance(dailyAmounts: number[]): number {
    if (dailyAmounts.length === 0) return 1;
    
    const mean = dailyAmounts.reduce((sum, amount) => sum + amount, 0) / dailyAmounts.length;
    const variance = dailyAmounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / dailyAmounts.length;
    
    return mean > 0 ? Math.sqrt(variance) / mean : 1;
  }

  private getEmptyAnalytics(): SpendingAnalytics {
    return {
      dailyAverage: 0,
      weeklyAverage: 0,
      monthlyTotal: 0,
      largestTransaction: { amount: 0, merchant: '', date: new Date() },
      categories: {},
      trends: {
        last7Days: Array(7).fill(0),
        last30Days: Array(30).fill(0),
        monthlyTrend: 'stable',
        trendPercentage: 0
      },
      predictedNextWeek: 0,
      recommendedReserve: 100,
      spendingVelocity: 0,
      averageTransactionSize: 0
    };
  }
}
