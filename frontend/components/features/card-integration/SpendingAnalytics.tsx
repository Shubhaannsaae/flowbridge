// FlowBridge Frontend - Spending Analytics Component
import React, { useState, useEffect } from 'react';
import { useCardIntegration, useCardAnalytics } from '../../../hooks/useCardIntegration';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { 
  formatUSDValue, 
  formatDateTime, 
  formatRelativeTime,
  formatPercentage 
} from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { CardTransaction, CardAnalyticsResponse } from '../../../types';

interface SpendingAnalyticsProps {
  className?: string;
}

const SpendingAnalytics: React.FC<SpendingAnalyticsProps> = ({ className }) => {
  const { 
    transactions, 
    transactionsLoading, 
    getTransactionHistory 
  } = useCardIntegration();

  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { 
    analytics, 
    loading: analyticsLoading, 
    spendingTrends, 
    categoryBreakdown, 
    topMerchants,
    refresh: refreshAnalytics 
  } = useCardAnalytics(selectedPeriod);

  // Load transaction history
  useEffect(() => {
    getTransactionHistory({
      limit: 100,
      status: ['settled', 'authorized'],
    });
  }, []);

  // Period options
  const periodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ];

  // Get spending by category
  const getSpendingByCategory = () => {
    const categoryTotals: Record<string, number> = {};
    
    transactions.forEach(transaction => {
      if (transaction.transactionType === 'purchase') {
        const category = transaction.merchantCategory || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(transaction.amount);
      }
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  };

  // Get recent transactions
  const getRecentTransactions = () => {
    return transactions
      .filter(tx => tx.transactionType === 'purchase')
      .sort((a, b) => new Date(b.transactionTimestamp).getTime() - new Date(a.transactionTimestamp).getTime())
      .slice(0, 10);
  };

  // Calculate spending velocity
  const getSpendingVelocity = () => {
    const now = new Date();
    const thisMonth = transactions.filter(tx => {
      const txDate = new Date(tx.transactionTimestamp);
      return txDate.getMonth() === now.getMonth() && 
             txDate.getFullYear() === now.getFullYear() &&
             tx.transactionType === 'purchase';
    });

    const lastMonth = transactions.filter(tx => {
      const txDate = new Date(tx.transactionTimestamp);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonthDate.getMonth() && 
             txDate.getFullYear() === lastMonthDate.getFullYear() &&
             tx.transactionType === 'purchase';
    });

    const thisMonthTotal = thisMonth.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const lastMonthTotal = lastMonth.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const change = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
    
    return {
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal,
      change,
      isIncrease: change > 0,
    };
  };

  const categorySpending = getSpendingByCategory();
  const recentTransactions = getRecentTransactions();
  const spendingVelocity = getSpendingVelocity();

  if (transactionsLoading && !analytics) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton lines={2} />
                </Card>
              ))}
            </div>
            <Skeleton lines={5} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Spending Analytics</span>
          </CardTitle>
          
          <div className="flex items-center space-x-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-3 py-2 border border-input rounded-md text-sm bg-background"
            >
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshAnalytics}
              loading={analyticsLoading}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {analytics ? formatUSDValue(analytics.totalSpent) : formatUSDValue(spendingVelocity.thisMonth)}
                </div>
                <div className="text-sm text-muted-foreground">Total Spent</div>
                {spendingVelocity.change !== 0 && (
                  <div className={cn(
                    'text-xs mt-1',
                    spendingVelocity.isIncrease ? 'text-red-600' : 'text-green-600'
                  )}>
                    {spendingVelocity.isIncrease ? '+' : ''}{formatPercentage(Math.abs(spendingVelocity.change))} vs last month
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {analytics?.transactionCount || transactions.filter(tx => tx.transactionType === 'purchase').length}
                </div>
                <div className="text-sm text-muted-foreground">Transactions</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {analytics 
                    ? formatUSDValue(analytics.averageTransactionAmount)
                    : formatUSDValue(spendingVelocity.thisMonth / Math.max(1, transactions.length))
                  }
                </div>
                <div className="text-sm text-muted-foreground">Avg Transaction</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics ? formatUSDValue(analytics.yieldSacrificed) : formatUSDValue(spendingVelocity.thisMonth * 0.05)}
                </div>
                <div className="text-sm text-muted-foreground">Yield Sacrificed</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spending by Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categorySpending.length > 0 ? (
                <div className="space-y-3">
                  {categorySpending.slice(0, 8).map((item, index) => {
                    const total = categorySpending.reduce((sum, cat) => sum + cat.amount, 0);
                    const percentage = total > 0 ? (item.amount / total) * 100 : 0;
                    
                    return (
                      <div key={item.category} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            `bg-${['blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'red', 'indigo'][index % 8]}-500`
                          )} />
                          <span className="text-sm font-medium">{item.category}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatUSDValue(item.amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPercentage(percentage)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">No spending data available</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Merchants */}
          <Card>
            <CardHeader>
              <CardTitle>Top Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics && topMerchants.length > 0 ? (
                <div className="space-y-3">
                  {topMerchants.slice(0, 8).map((merchant, index) => (
                    <div key={merchant.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {merchant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium">{merchant.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatUSDValue(merchant.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {merchant.count} transactions
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.slice(0, 8).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {transaction.merchantName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium">{transaction.merchantName}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatUSDValue(transaction.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRelativeTime(transaction.transactionTimestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Spending Trend Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-center">
                <svg className="h-12 w-12 mx-auto mb-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-muted-foreground">Spending trend chart will be displayed here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Chart component integration coming soon
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      
                      <div>
                        <div className="font-medium">{transaction.merchantName}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.merchantCategory || 'Purchase'} • {formatRelativeTime(transaction.transactionTimestamp)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        -{formatUSDValue(transaction.amount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.tokenSymbol}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="font-medium mb-2">No Transactions</h3>
                <p className="text-sm text-muted-foreground">
                  Start using your MetaMask Card to see spending analytics here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Yield Impact Analysis */}
        {analytics && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-orange-600">Yield Impact Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Opportunity Cost</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Spent:</span>
                      <span className="font-medium">{formatUSDValue(analytics.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Potential Yield (5% APY):</span>
                      <span className="font-medium text-orange-600">
                        {formatUSDValue(analytics.opportunityCost)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Yield Sacrificed:</span>
                      <span className="font-medium text-red-600">
                        -{formatUSDValue(analytics.yieldSacrificed)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Optimization Tips</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start space-x-2">
                      <svg className="h-4 w-4 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Keep spending under 10% of yield earnings to maintain growth</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <svg className="h-4 w-4 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Consider using card rewards to offset opportunity cost</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <svg className="h-4 w-4 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Monitor spending velocity to avoid depleting reserves</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default SpendingAnalytics;
