// FlowBridge Frontend - Yield Data Hook
import { useState, useEffect, useCallback } from 'react';
import { portfolioAPI, yieldAPI } from '../utils/api';
import { useMetaMask } from './useMetaMask';

interface YieldStrategy {
  id: string;
  portfolioId: string;
  strategyName: string;
  protocolName: string;
  protocolId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chainId: number;
  chainName: string;
  strategyType: 'single_asset' | 'lp_token' | 'vault' | 'lending' | 'staking';
  deployedAmount: string;
  currentValue: string;
  yieldEarned: string;
  currentApy: string;
  expectedApy: string;
  riskScore: number;
  allocationPercentage: string;
  isActive: boolean;
  isAutoRebalanceEnabled: boolean;
  createdAt: string;
  lastRebalancedAt?: string;
  category: string;
}

interface Protocol {
  id: string;
  name: string;
  category: string;
  description: string;
  tvl: string;
  apyCurrent: string;
  apyHistorical: string;
  riskScore: number;
  liquidityScore: number;
  auditStatus: 'audited' | 'unaudited' | 'partially_audited';
  supportedChains: number[];
  supportedTokens: string[];
  integrationStatus: 'active' | 'maintenance' | 'deprecated';
  lastUpdated: string;
}

interface YieldHistoryPoint {
  timestamp: string;
  yieldEarned: string;
  apy: string;
  cumulativeYield: string;
  strategyId: string;
}

interface UseYieldDataReturn {
  // Strategies
  strategies: YieldStrategy[];
  strategiesLoading: boolean;
  strategiesError: string | null;
  
  // Protocols
  protocols: Protocol[];
  protocolsLoading: boolean;
  protocolsError: string | null;
  
  // Actions
  fetchStrategies: (portfolioId?: string) => Promise<void>;
  fetchProtocols: () => Promise<void>;
  createStrategy: (strategyData: any) => Promise<string>;
  updateStrategy: (strategyId: string, updateData: any) => Promise<void>;
  deleteStrategy: (strategyId: string) => Promise<void>;
  optimizeYield: (portfolioId: string, params: any) => Promise<any>;
  refreshData: () => Promise<void>;
  
  // Filtering and searching
  filterStrategies: (filters: any) => YieldStrategy[];
  filterProtocols: (filters: any) => Protocol[];
  getProtocolsByCategory: (category: string) => Protocol[];
  getStrategiesByProtocol: (protocolId: string) => YieldStrategy[];
}

export function useYieldData(portfolioId?: string): UseYieldDataReturn {
  const { token, isAuthenticated } = useMetaMask();
  
  const [strategies, setStrategies] = useState<YieldStrategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(false);
  const [protocolsError, setProtocolsError] = useState<string | null>(null);

  // Fetch yield strategies
  const fetchStrategies = useCallback(async (targetPortfolioId?: string) => {
    if (!isAuthenticated || !token) return;

    setStrategiesLoading(true);
    setStrategiesError(null);

    try {
      const response = await yieldAPI.getStrategies({
        portfolioId: targetPortfolioId || portfolioId,
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setStrategies(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch strategies');
      }
    } catch (error: any) {
      console.error('Error fetching strategies:', error);
      setStrategiesError(error.message);
    } finally {
      setStrategiesLoading(false);
    }
  }, [portfolioId, isAuthenticated, token]);

  // Fetch available protocols
  const fetchProtocols = useCallback(async () => {
    setProtocolsLoading(true);
    setProtocolsError(null);

    try {
      const response = await yieldAPI.getProtocols();

      if (response.success && response.data) {
        setProtocols(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch protocols');
      }
    } catch (error: any) {
      console.error('Error fetching protocols:', error);
      setProtocolsError(error.message);
    } finally {
      setProtocolsLoading(false);
    }
  }, []);

  // Create new strategy
  const createStrategy = useCallback(async (strategyData: any): Promise<string> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await yieldAPI.createStrategy(strategyData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.id) {
        // Refresh strategies after creation
        await fetchStrategies();
        return response.id;
      } else {
        throw new Error(response.error || 'Failed to create strategy');
      }
    } catch (error: any) {
      console.error('Error creating strategy:', error);
      throw error;
    }
  }, [isAuthenticated, token, fetchStrategies]);

  // Update existing strategy
  const updateStrategy = useCallback(async (strategyId: string, updateData: any): Promise<void> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await yieldAPI.updateStrategy(strategyId, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        // Refresh strategies after update
        await fetchStrategies();
      } else {
        throw new Error(response.error || 'Failed to update strategy');
      }
    } catch (error: any) {
      console.error('Error updating strategy:', error);
      throw error;
    }
  }, [isAuthenticated, token, fetchStrategies]);

  // Delete strategy
  const deleteStrategy = useCallback(async (strategyId: string): Promise<void> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await yieldAPI.deleteStrategy(strategyId, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        // Refresh strategies after deletion
        await fetchStrategies();
      } else {
        throw new Error(response.error || 'Failed to delete strategy');
      }
    } catch (error: any) {
      console.error('Error deleting strategy:', error);
      throw error;
    }
  }, [isAuthenticated, token, fetchStrategies]);

  // Optimize yield for portfolio
  const optimizeYield = useCallback(async (targetPortfolioId: string, params: any): Promise<any> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await portfolioAPI.optimize(targetPortfolioId, params, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Optimization failed');
      }
    } catch (error: any) {
      console.error('Error optimizing yield:', error);
      throw error;
    }
  }, [isAuthenticated, token]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchStrategies(),
      fetchProtocols()
    ]);
  }, [fetchStrategies, fetchProtocols]);

  // Filter strategies
  const filterStrategies = useCallback((filters: {
    active?: boolean;
    protocolId?: string;
    category?: string;
    minApy?: number;
    maxRisk?: number;
  }) => {
    return strategies.filter(strategy => {
      if (filters.active !== undefined && strategy.isActive !== filters.active) {
        return false;
      }
      if (filters.protocolId && strategy.protocolId !== filters.protocolId) {
        return false;
      }
      if (filters.category && strategy.category !== filters.category) {
        return false;
      }
      if (filters.minApy && parseFloat(strategy.currentApy) < filters.minApy) {
        return false;
      }
      if (filters.maxRisk && strategy.riskScore > filters.maxRisk) {
        return false;
      }
      return true;
    });
  }, [strategies]);

  // Filter protocols
  const filterProtocols = useCallback((filters: {
    category?: string;
    minAPY?: number;
    maxRisk?: number;
    minTVL?: number;
    chainId?: number;
  }) => {
    return protocols.filter(protocol => {
      if (filters.category && protocol.category !== filters.category) {
        return false;
      }
      if (filters.minAPY && parseFloat(protocol.apyCurrent) < filters.minAPY) {
        return false;
      }
      if (filters.maxRisk && protocol.riskScore > filters.maxRisk) {
        return false;
      }
      if (filters.minTVL && parseFloat(protocol.tvl) < filters.minTVL) {
        return false;
      }
      if (filters.chainId && !protocol.supportedChains.includes(filters.chainId)) {
        return false;
      }
      return true;
    });
  }, [protocols]);

  // Get protocols by category
  const getProtocolsByCategory = useCallback((category: string) => {
    return protocols.filter(protocol => protocol.category === category);
  }, [protocols]);

  // Get strategies by protocol
  const getStrategiesByProtocol = useCallback((protocolId: string) => {
    return strategies.filter(strategy => strategy.protocolId === protocolId);
  }, [strategies]);

  // Load initial data
  useEffect(() => {
    if (isAuthenticated) {
      fetchStrategies();
      fetchProtocols();
    }
  }, [isAuthenticated, fetchStrategies, fetchProtocols]);

  return {
    // Strategies
    strategies,
    strategiesLoading,
    strategiesError,
    
    // Protocols
    protocols,
    protocolsLoading,
    protocolsError,
    
    // Actions
    fetchStrategies,
    fetchProtocols,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    optimizeYield,
    refreshData,
    
    // Filtering and searching
    filterStrategies,
    filterProtocols,
    getProtocolsByCategory,
    getStrategiesByProtocol,
  };
}

// Hook for yield history data
export function useYieldHistory(portfolioId: string, timeframe: string) {
  const { token, isAuthenticated } = useMetaMask();
  const [history, setHistory] = useState<YieldHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !token || !portfolioId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await yieldAPI.getYieldHistory(portfolioId, timeframe, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setHistory(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch yield history');
      }
    } catch (err: any) {
      console.error('Error fetching yield history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, timeframe, isAuthenticated, token]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { history, loading, error, refetch };
}

export default useYieldData;
