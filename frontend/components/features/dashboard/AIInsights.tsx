// FlowBridge Frontend - AI Insights Component
import React, { useState, useEffect } from 'react';
import { useAIOptimizer } from '../../../hooks/useAIOptimizer';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { formatPercentage, formatUSDValue, formatRelativeTime } from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { AIInsight, OptimizationSuggestion } from '../../../types';

interface AIInsightsProps {
  portfolioId?: string;
  className?: string;
}

const AIInsights: React.FC<AIInsightsProps> = ({ 
  portfolioId, 
  className 
}) => {
  const {
    insights,
    insightsLoading,
    optimizationSuggestions,
    implementInsight,
    refreshInsights,
    getInsightsByPriority,
    getCriticalInsights,
    getActionableInsights,
  } = useAIOptimizer(portfolioId);

  const { success: showSuccess, error: showError } = useToastNotification();
  
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [implementingInsights, setImplementingInsights] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'actionable'>('all');

  // Handle insight implementation
  const handleImplementInsight = async (insight: AIInsight, approved: boolean) => {
    setImplementingInsights(prev => new Set([...prev, insight.id]));
    
    try {
      await implementInsight(insight.id, approved);
      showSuccess(
        approved ? 'Insight Implemented' : 'Insight Dismissed',
        approved 
          ? 'The AI recommendation has been applied to your portfolio'
          : 'The AI recommendation has been dismissed'
      );
    } catch (error: any) {
      showError('Implementation Failed', error.message);
    } finally {
      setImplementingInsights(prev => {
        const newSet = new Set(prev);
        newSet.delete(insight.id);
        return newSet;
      });
    }
  };

  // Get insights based on active tab
  const getFilteredInsights = () => {
    switch (activeTab) {
      case 'critical':
        return getCriticalInsights();
      case 'actionable':
        return getActionableInsights();
      default:
        return insights;
    }
  };

  // Get insight icon based on type
  const getInsightIcon = (type: string, priority: string) => {
    const iconColor = {
      critical: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-blue-600',
      low: 'text-gray-600',
    }[priority] || 'text-gray-600';

    const icons = {
      yield_optimization: (
        <svg className={cn('h-5 w-5', iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      risk_alert: (
        <svg className={cn('h-5 w-5', iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.296 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      rebalance_suggestion: (
        <svg className={cn('h-5 w-5', iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      market_trend: (
        <svg className={cn('h-5 w-5', iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      protocol_analysis: (
        <svg className={cn('h-5 w-5', iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    };

    return icons[type as keyof typeof icons] || icons.yield_optimization;
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-blue-100 text-blue-800 border-blue-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const filteredInsights = getFilteredInsights();
  const criticalCount = getCriticalInsights().length;
  const actionableCount = getActionableInsights().length;

  if (insightsLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton lines={3} />
              </div>
            ))}
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
            <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>AI Insights</span>
          </CardTitle>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={refreshInsights}
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted rounded-lg p-1 mt-4">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1',
              activeTab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All Insights ({insights.length})
          </button>
          
          <button
            onClick={() => setActiveTab('critical')}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1',
              activeTab === 'critical'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Critical ({criticalCount})
          </button>
          
          <button
            onClick={() => setActiveTab('actionable')}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1',
              activeTab === 'actionable'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Actionable ({actionableCount})
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {filteredInsights.length > 0 ? (
          <div className="space-y-4">
            {filteredInsights.map((insight) => (
              <div 
                key={insight.id}
                className={cn(
                  'p-4 rounded-lg border transition-all',
                  insight.priority === 'critical' && 'border-red-200 bg-red-50',
                  insight.priority === 'high' && 'border-orange-200 bg-orange-50',
                  !['critical', 'high'].includes(insight.priority) && 'hover:bg-accent/50'
                )}
              >
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    {getInsightIcon(insight.insightType, insight.priority)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium">{insight.title}</h4>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full border',
                        getPriorityBadgeColor(insight.priority)
                      )}>
                        {insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatPercentage(insight.confidenceScore * 100)} confidence
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {insight.description}
                    </p>
                    
                    {insight.recommendation && (
                      <div className="bg-muted/50 p-3 rounded-md mb-3">
                        <p className="text-sm font-medium mb-1">Recommendation:</p>
                        <p className="text-sm">{insight.recommendation}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        Generated {formatRelativeTime(insight.validFrom)} • 
                        Model: {insight.modelName} v{insight.modelVersion}
                      </div>
                      
                      {insight.isActionable && !insight.isImplemented && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImplementInsight(insight, false)}
                            loading={implementingInsights.has(insight.id)}
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleImplementInsight(insight, true)}
                            loading={implementingInsights.has(insight.id)}
                          >
                            Implement
                          </Button>
                        </div>
                      )}
                      
                      {insight.isImplemented && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Implemented
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">
              {activeTab === 'all' && 'No AI Insights Available'}
              {activeTab === 'critical' && 'No Critical Insights'}
              {activeTab === 'actionable' && 'No Actionable Insights'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'all' 
                ? 'AI insights will appear here as your portfolio grows and market conditions change'
                : `Switch to "All Insights" to see other available recommendations`
              }
            </p>
          </div>
        )}

        {/* Optimization Suggestions Summary */}
        {optimizationSuggestions.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-3">Latest Optimization Suggestions</h4>
            <div className="space-y-2">
              {optimizationSuggestions.slice(0, 3).map((suggestion) => (
                <div 
                  key={suggestion.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {suggestion.optimizationType.charAt(0).toUpperCase() + 
                       suggestion.optimizationType.slice(1).replace('_', ' ')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.expectedApyImprovement && 
                        `+${formatPercentage(parseFloat(suggestion.expectedApyImprovement))} APY improvement`
                      }
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Priority: {suggestion.priorityScore}/100
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(suggestion.generatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIInsights;
