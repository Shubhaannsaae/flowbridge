// FlowBridge Frontend - AI Optimizer Hook
import { useState, useEffect, useCallback } from 'react';
import { useMetaMask } from './useMetaMask';
import { aiAPI } from '../utils/api';

interface OptimizationSuggestion {
  id: string;
  optimizationType: 'rebalance' | 'yield_optimization' | 'risk_reduction' | 'gas_optimization';
  portfolioId: string;
  title: string;
  description: string;
  currentAllocation: Record<string, string>;
  suggestedAllocation: Record<string, string>;
  expectedApyImprovement?: string;
  riskScoreChange?: number;
  estimatedGasCost: string;
  confidenceScore: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  reasoning: string;
  validUntil: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  createdAt: string;
}

interface AIInsight {
  id: string;
  portfolioId: string;
  insightType: 'yield_optimization' | 'risk_alert' | 'rebalance_suggestion' | 'market_trend' | 'protocol_analysis';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation?: string;
  actionRequired: boolean;
  isActionable: boolean;
  isImplemented: boolean;
  confidenceScore: number;
  modelName: string;
  modelVersion: string;
  validFrom: string;
  validUntil: string;
  metadata: Record<string, any>;
}

interface OptimizationRequest {
  portfolioId: string;
  totalAmount: string;
  userRiskTolerance: number;
  timeHorizon?: 'short' | 'medium' | 'long';
  forceRebalance?: boolean;
  excludeProtocols?: string[];
  includeOnlyCategories?: string[];
}

interface UseAIOptimizerReturn {
  // Optimization suggestions
  suggestions: OptimizationSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  
  // AI insights
  insights: AIInsight[];
  insightsLoading: boolean;
  insightsError: string | null;
  
  // Actions
  generateOptimization: (request: OptimizationRequest) => Promise<OptimizationSuggestion>;
  implementSuggestion: (suggestionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => Promise<void>;
  getOptimizationSuggestions: () => Promise<OptimizationSuggestion[]>;
  refreshInsights: () => Promise<void>;
  implementInsight: (insightId: string, approved: boolean) => Promise<void>;
  
  // Filtering and analysis
  getInsightsByPriority: (priority: string) => AIInsight[];
  getCriticalInsights: () => AIInsight[];
  getActionableInsights: () => AIInsight[];
  getSuggestionsByType: (type: string) => OptimizationSuggestion[];
  
  // Error handling
  clearErrors: () => void;
}

export function useAIOptimizer(portfolioId?: string): UseAIOptimizerReturn {
  const { token, isAuthenticated } = useMetaMask();
  
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Generate new optimization suggestion
  const generateOptimization = useCallback(async (request: OptimizationRequest): Promise<OptimizationSuggestion> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const response = await aiAPI.generateOptimization(request, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        const suggestion: OptimizationSuggestion = {
          id: response.data.optimizationId,
          optimizationType: 'rebalance',
          portfolioId: response.data.portfolioId,
          title: 'AI Portfolio Optimization',
          description: `Optimized allocation to improve expected APY to ${response.data.expectedAPY}%`,
          currentAllocation: response.data.currentAllocation,
          suggestedAllocation: response.data.recommendedAllocation,
          expectedApyImprovement: response.data.expectedAPY,
          riskScoreChange: response.data.expectedRisk - 50, // Assume current risk is 50
          estimatedGasCost: response.data.gasCostEstimate,
          confidenceScore: response.data.confidenceScore / 100,
          implementationComplexity: response.data.implementationComplexity,
          reasoning: response.data.reasoning,
          validUntil: response.data.validUntil,
          status: 'pending',
          createdAt: response.data.createdAt,
        };

        setSuggestions(prev => [suggestion, ...prev]);
        return suggestion;
      } else {
        throw new Error(response.error || 'Failed to generate optimization');
      }
    } catch (error: any) {
      console.error('Error generating optimization:', error);
      setSuggestionsError(error.message);
      throw error;
    } finally {
      setSuggestionsLoading(false);
    }
  }, [isAuthenticated, token]);

  // Get existing optimization suggestions
  const getOptimizationSuggestions = useCallback(async (): Promise<OptimizationSuggestion[]> => {
    if (!isAuthenticated || !token || !portfolioId) {
      return [];
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const response = await aiAPI.getOptimizations(portfolioId, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setSuggestions(response.data);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch suggestions');
      }
    } catch (error: any) {
      console.error('Error fetching suggestions:', error);
      setSuggestionsError(error.message);
      return [];
    } finally {
      setSuggestionsLoading(false);
    }
  }, [portfolioId, isAuthenticated, token]);

  // Implement optimization suggestion
  const implementSuggestion = useCallback(async (suggestionId: string): Promise<void> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await aiAPI.implementOptimization(suggestionId, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        // Update suggestion status
        setSuggestions(prev => 
          prev.map(s => 
            s.id === suggestionId 
              ? { ...s, status: 'implemented' }
              : s
          )
        );
      } else {
        throw new Error(response.error || 'Failed to implement suggestion');
      }
    } catch (error: any) {
      console.error('Error implementing suggestion:', error);
      throw error;
    }
  }, [isAuthenticated, token]);

  // Dismiss optimization suggestion
  const dismissSuggestion = useCallback(async (suggestionId: string): Promise<void> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await aiAPI.dismissOptimization(suggestionId, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        // Update suggestion status
        setSuggestions(prev => 
          prev.map(s => 
            s.id === suggestionId 
              ? { ...s, status: 'rejected' }
              : s
          )
        );
      } else {
        throw new Error(response.error || 'Failed to dismiss suggestion');
      }
    } catch (error: any) {
      console.error('Error dismissing suggestion:', error);
      throw error;
    }
  }, [isAuthenticated, token]);

  // Refresh AI insights
  const refreshInsights = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !token || !portfolioId) {
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const response = await aiAPI.getInsights(portfolioId, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setInsights(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch insights');
      }
    } catch (error: any) {
      console.error('Error fetching insights:', error);
      setInsightsError(error.message);
    } finally {
      setInsightsLoading(false);
    }
  }, [portfolioId, isAuthenticated, token]);

  // Implement AI insight
  const implementInsight = useCallback(async (insightId: string, approved: boolean): Promise<void> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await aiAPI.updateInsight(insightId, {
        isImplemented: approved,
        actionTaken: approved ? 'approved' : 'dismissed',
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        // Update insight status
        setInsights(prev => 
          prev.map(insight => 
            insight.id === insightId 
              ? { ...insight, isImplemented: approved }
              : insight
          )
        );
      } else {
        throw new Error(response.error || 'Failed to update insight');
      }
    } catch (error: any) {
      console.error('Error updating insight:', error);
      throw error;
    }
  }, [isAuthenticated, token]);

  // Filter insights by priority
  const getInsightsByPriority = useCallback((priority: string) => {
    return insights.filter(insight => insight.priority === priority);
  }, [insights]);

  // Get critical insights
  const getCriticalInsights = useCallback(() => {
    return insights.filter(insight => insight.priority === 'critical');
  }, [insights]);

  // Get actionable insights
  const getActionableInsights = useCallback(() => {
    return insights.filter(insight => insight.isActionable && !insight.isImplemented);
  }, [insights]);

  // Get suggestions by type
  const getSuggestionsByType = useCallback((type: string) => {
    return suggestions.filter(suggestion => suggestion.optimizationType === type);
  }, [suggestions]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setSuggestionsError(null);
    setInsightsError(null);
  }, []);

  // Load initial data when portfolio changes
  useEffect(() => {
    if (isAuthenticated && portfolioId) {
      refreshInsights();
      getOptimizationSuggestions();
    }
  }, [isAuthenticated, portfolioId, refreshInsights, getOptimizationSuggestions]);

  // Clear errors after 5 seconds
  useEffect(() => {
    if (suggestionsError || insightsError) {
      const timer = setTimeout(clearErrors, 5000);
      return () => clearTimeout(timer);
    }
  }, [suggestionsError, insightsError, clearErrors]);

  return {
    // Optimization suggestions
    suggestions,
    suggestionsLoading,
    suggestionsError,
    
    // AI insights
    insights,
    insightsLoading,
    insightsError,
    
    // Actions
    generateOptimization,
    implementSuggestion,
    dismissSuggestion,
    getOptimizationSuggestions,
    refreshInsights,
    implementInsight,
    
    // Filtering and analysis
    getInsightsByPriority,
    getCriticalInsights,
    getActionableInsights,
    getSuggestionsByType,
    
    // Error handling
    clearErrors,
  };
}

export default useAIOptimizer;
