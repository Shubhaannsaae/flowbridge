// FlowBridge Frontend - Yield Metrics Component
import React, { useState, useEffect } from 'react';
import { useYieldData } from '../../../hooks/useYieldData';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { formatPercentage, formatUSDValue, formatNumber } from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { YieldStrategy, Protocol } from '../../../types';

interface YieldMetricsProps {
  portfolioId?: string;
  className?: string;
}

interface YieldAnalytics {
  totalYieldEarned: number;
  averageAPY: number;
  bestPerformingStrategy: YieldStrategy | null;
  worstPerformingStrategy: YieldStrategy | null;
  protocolDistribution: Record<string, number>;
  monthlyYieldTrend: Array<{ month: string; yield: number }>;
}

const YieldMetrics: React.FC<YieldMetricsProps> = ({ 
  portfolioId, 
  className 
}) => {
  const { 
    strategies, 
    protocols, 
    strategiesLoading, 
    protocolsLoading 
  } = useYieldData(portfolioId);

  const [analytics, setAnalytics] = useState<YieldAnalytics | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);

  // Calculate yield analytics
  useEffect(() => {
    if (strategies.length === 0 || protocolsLoading) {
      setLoading(false);
      return;
    }

    const activeStrategies = strategies.filter(s => s.isActive);
    
    if (activeStrategies.length === 0) {
      setAnalytics(null);
      setLoading(false);
      return;
    }

    // Calculate metrics
    const totalYieldEarned = activeStrategies.reduce(
      (sum, strategy) => sum + parseFloat(strategy.yieldEarned),
      0
    );

    const totalValue = activeStrategies.reduce(
      (sum, strategy) => sum + parseFloat(strategy.currentValue),
      0
    );

    const weightedAPY = activeStrategies.reduce(
      (sum, strategy) => {
        const weight = parseFloat(strategy.currentValue) / totalValue;
        return sum + (parseFloat(strategy.currentApy) * weight);
      },
      0
    );

    // Find best and worst performing strategies
    const sortedByPerformance = [...activeStrategies].sort(
      (a, b) => parseFloat(b.currentApy) - parseFloat(a.currentApy)
    );

    // Calculate protocol distribution
    const protocolDistribution: Record<string, number> = {};
    activeStrategies.forEach(strategy => {
      const value = parseFloat(strategy.currentValue);
      if (protocolDistribution[strategy.protocolName]) {
        protocolDistribution[strategy.protocolName] += value;
      } else {
        protocolDistribution[strategy.protocolName] = value;
      }
    });

    // Generate mock monthly trend data (in production, this would come from API)
    const monthlyYieldTrend = [
      { month: 'Jan', yield: totalYieldEarned * 0.1 },
      { month: 'Feb', yield: totalYieldEarned * 0.25 },
      { month: 'Mar', yield: totalYieldEarned * 0.45 },
      { month: 'Apr', yield: totalYieldEarned * 0.68 },
      { month: 'May', yield: totalYieldEarned * 0.85 },
      { month: 'Jun', yield: totalYieldEarned },
    ];

    setAnalytics({
      totalYieldEarned,
      averageAPY: weightedAPY,
      bestPerformingStrategy: sortedByPerformance[0] || null,
      worstPerformingStrategy: sortedByPerformance[sortedByPerformance.length - 1] || null,
      protocolDistribution,
      monthlyYieldTrend,
    });

    setLoading(false);
  }, [strategies, protocolsLoading]);

  const timeframeOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' },
  ];

  if (loading || strategiesLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <Skeleton width="200px" height="24px" />
          </CardHeader>
          <CardContent>
            <Skeleton lines={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="font-medium mb-2">No Yield Data Available</h3>
          <p className="text-sm text-muted-foreground">
            Start earning yield by creating your first strategy
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Timeframe Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Yield Metrics</h2>
          <p className="text-muted-foreground">
            Track your yield performance across all strategies
          </p>
        </div>
        
        <div className="flex space-x-1 bg-muted rounded-lg p-1">
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedTimeframe(option.value as any)}
              className={cn(
                'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                selectedTimeframe === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Yield Earned</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatUSDValue(analytics.totalYieldEarned)}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average APY</p>
                <p className="text-2xl font-bold">
                  {formatPercentage(analytics.averageAPY)}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Best Strategy APY</p>
                <p className="text-2xl font-bold text-purple-600">
                  {analytics.bestPerformingStrategy 
                    ? formatPercentage(parseFloat(analytics.bestPerformingStrategy.currentApy))
                    : '0%'
                  }
                </p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Strategies</p>
                <p className="text-2xl font-bold">
                  {strategies.filter(s => s.isActive).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top and Bottom Performers */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.bestPerformingStrategy && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-800">Best Performer</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatPercentage(parseFloat(analytics.bestPerformingStrategy.currentApy))}
                  </span>
                </div>
                <div className="text-sm text-green-700">
                  {analytics.bestPerformingStrategy.strategyName}
                </div>
                <div className="text-xs text-green-600">
                  {analytics.bestPerformingStrategy.protocolName} • 
                  {formatUSDValue(analytics.bestPerformingStrategy.currentValue)}
                </div>
              </div>
            )}

            {analytics.worstPerformingStrategy && analytics.worstPerformingStrategy !== analytics.bestPerformingStrategy && (
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-800">Lowest Performer</span>
                  <span className="text-sm font-bold text-yellow-600">
                    {formatPercentage(parseFloat(analytics.worstPerformingStrategy.currentApy))}
                  </span>
                </div>
                <div className="text-sm text-yellow-700">
                  {analytics.worstPerformingStrategy.strategyName}
                </div>
                <div className="text-xs text-yellow-600">
                  {analytics.worstPerformingStrategy.protocolName} • 
                  {formatUSDValue(analytics.worstPerformingStrategy.currentValue)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Protocol Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Protocol Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.protocolDistribution)
                .sort(([,a], [,b]) => b - a)
                .map(([protocol, value]) => {
                  const totalValue = Object.values(analytics.protocolDistribution).reduce((a, b) => a + b, 0);
                  const percentage = (value / totalValue) * 100;
                  
                  return (
                    <div key={protocol} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                        <span className="text-sm font-medium">{protocol}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatUSDValue(value)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPercentage(percentage)}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Yield Trend Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Yield Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="text-center">
              <svg className="h-12 w-12 mx-auto mb-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-muted-foreground">Yield trend chart will be displayed here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Chart component integration coming soon
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default YieldMetrics;
