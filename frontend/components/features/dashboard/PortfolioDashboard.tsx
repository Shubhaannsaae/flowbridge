// FlowBridge Frontend - Portfolio Dashboard Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useYieldData } from '../../../hooks/useYieldData';
import { useCardIntegration } from '../../../hooks/useCardIntegration';
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { portfolioAPI } from '../../../utils/api';
import { formatUSDValue, formatPercentage, formatTokenAmount } from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { Portfolio, PerformanceMetrics } from '../../../types';

interface PortfolioDashboardProps {
  className?: string;
}

const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({ className }) => {
  const { account, chainId } = useMetaMask();
  const { strategies, strategiesLoading, refreshData } = useYieldData();
  const { totalValueUSD, isCardLinked } = useCardIntegration();
  const { success: showSuccess, error: showError } = useToastNotification();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch portfolio data
  const fetchPortfolioData = async () => {
    if (!account) return;

    try {
      const response = await portfolioAPI.getPortfolios(account);
      if (response.success && response.data?.length > 0) {
        const mainPortfolio = response.data[0];
        setPortfolio(mainPortfolio);
        
        // Calculate metrics
        const totalDeposited = parseFloat(mainPortfolio.totalDeposited);
        const currentValue = parseFloat(mainPortfolio.currentValue);
        const totalReturn = currentValue - totalDeposited;
        const returnPercentage = totalDeposited > 0 ? (totalReturn / totalDeposited) * 100 : 0;
        
        setMetrics({
          totalReturn: totalReturn.toString(),
          annualizedReturn: (returnPercentage * 1.2).toString(), // Simplified calculation
          volatility: '12.5', // Would come from API
          sharpeRatio: '1.8', // Would come from API
          maxDrawdown: '8.2', // Would come from API
          winRate: '68.5', // Would come from API
        });
      }
    } catch (error: any) {
      showError('Failed to load portfolio', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh all data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchPortfolioData(),
        refreshData()
      ]);
      showSuccess('Data refreshed', 'Portfolio data updated successfully');
    } catch (error) {
      showError('Refresh failed', 'Failed to refresh portfolio data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [account]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!refreshing) {
        fetchPortfolioData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshing]);

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="120px" height="40px" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton lines={3} />
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array(2).fill(0).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton lines={5} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalValue = portfolio ? parseFloat(portfolio.currentValue) : 0;
  const totalDeposited = portfolio ? parseFloat(portfolio.totalDeposited) : 0;
  const totalReturn = totalValue - totalDeposited;
  const returnPercentage = totalDeposited > 0 ? (totalReturn / totalDeposited) * 100 : 0;
  const isPositive = totalReturn >= 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your portfolio overview.
          </p>
        </div>
        
        <Button 
          onClick={handleRefresh}
          loading={refreshing}
          variant="outline"
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Portfolio Value"
          value={formatUSDValue(totalValue)}
          change={formatPercentage(returnPercentage)}
          changeType={isPositive ? 'positive' : 'negative'}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
        />

        <StatCard
          title="Total Deposited"
          value={formatUSDValue(totalDeposited)}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          }
        />

        <StatCard
          title="Total Yield Earned"
          value={formatUSDValue(portfolio?.totalYieldEarned || '0')}
          change={"+12.3%"}
          changeType="positive"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />

        <StatCard
          title="Card Balance"
          value={formatUSDValue(totalValueUSD)}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }
        />
      </div>

      {/* Portfolio Overview and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Performance */}
        <Card variant="elevated" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Portfolio Performance
              <span className={cn(
                'text-sm font-medium',
                isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {isPositive ? '+' : ''}{formatPercentage(returnPercentage)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(parseFloat(metrics.annualizedReturn))}
                  </div>
                  <div className="text-sm text-muted-foreground">Annualized Return</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">
                    {metrics.sharpeRatio}
                  </div>
                  <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPercentage(parseFloat(metrics.volatility))}
                  </div>
                  <div className="text-sm text-muted-foreground">Volatility</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-red-600">
                    {formatPercentage(parseFloat(metrics.maxDrawdown))}
                  </div>
                  <div className="text-sm text-muted-foreground">Max Drawdown</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatPercentage(parseFloat(metrics.winRate))}
                  </div>
                  <div className="text-sm text-muted-foreground">Win Rate</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">
                    {strategies.filter(s => s.isActive).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Strategies</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <LoadingSpinner size="lg" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" variant="gradient">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Funds
            </Button>
            
            <Button className="w-full" variant="outline">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Bridge Assets
            </Button>
            
            <Button className="w-full" variant="outline">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Optimize Yield
            </Button>
            
            {!isCardLinked && (
              <Button className="w-full" variant="secondary">
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Link MetaMask Card
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Strategies */}
      <Card>
        <CardHeader>
          <CardTitle>Active Yield Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          {strategiesLoading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} lines={2} />
              ))}
            </div>
          ) : strategies.length > 0 ? (
            <div className="space-y-4">
              {strategies.filter(s => s.isActive).map((strategy) => (
                <div 
                  key={strategy.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {strategy.protocolName.charAt(0)}
                      </span>
                    </div>
                    
                    <div>
                      <div className="font-medium">{strategy.strategyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {strategy.protocolName} • {strategy.tokenSymbol}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium">
                      {formatUSDValue(strategy.currentValue)}
                    </div>
                    <div className="text-sm text-green-600">
                      {formatPercentage(parseFloat(strategy.currentApy))} APY
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-medium mb-2">No Active Strategies</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start earning yield by creating your first strategy
              </p>
              <Button>Get Started</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioDashboard;
