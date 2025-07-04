// FlowBridge Frontend - MetaMask Card Integration Hook
import { useState, useEffect, useCallback } from 'react';
import { useMetaMask } from './useMetaMask';
import { cardAPI } from '../utils/api';

interface CardBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  totalBalance: string;
  availableBalance: string;
  pendingBalance: string;
  decimals: number;
  usdValue: string;
  lastUpdated: string;
}

interface CardTransaction {
  id: string;
  transactionType: 'purchase' | 'topup' | 'refund' | 'fee';
  amount: string;
  tokenSymbol: string;
  merchantName: string;
  merchantCategory?: string;
  description: string;
  status: 'pending' | 'authorized' | 'settled' | 'failed' | 'cancelled';
  transactionTimestamp: string;
  settledTimestamp?: string;
  location?: {
    country: string;
    city: string;
  };
  metadata: Record<string, any>;
}

interface SpendingLimit {
  id?: string;
  limitType: 'daily' | 'weekly' | 'monthly' | 'per_transaction';
  limitAmount: string;
  limitCurrency: 'USD' | 'EUR' | 'GBP';
  merchantCategory?: string;
  isActive: boolean;
  createdAt?: string;
  usedAmount?: string;
  remainingAmount?: string;
}

interface CardAnalyticsResponse {
  totalSpent: string;
  transactionCount: number;
  averageTransactionAmount: string;
  topCategories: Array<{ category: string; amount: string; count: number }>;
  monthlyTrend: Array<{ month: string; amount: string }>;
  yieldSacrificed: string;
  opportunityCost: string;
}

interface UseCardIntegrationReturn {
  // Card status
  isCardLinked: boolean;
  linkLoading: boolean;
  
  // Balances
  balances: CardBalance[];
  balancesLoading: boolean;
  totalValueUSD: string;
  
  // Transactions
  transactions: CardTransaction[];
  transactionsLoading: boolean;
  
  // Spending limits
  spendingLimits: SpendingLimit[];
  limitsLoading: boolean;
  
  // Actions
  linkCard: () => Promise<void>;
  unlinkCard: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  topUpCard: (tokenAddress: string, amount: string, sourceType: 'portfolio' | 'external_wallet') => Promise<string>;
  setSpendingLimits: (limits: SpendingLimit[]) => Promise<void>;
  getTransactionHistory: (params?: any) => Promise<void>;
  
  // Analytics
  getSpendingAnalytics: (timeframe: string) => Promise<CardAnalyticsResponse>;
  
  // Utility functions
  getBalanceByToken: (tokenAddress: string) => CardBalance | undefined;
  canSpend: (amount: string, tokenAddress: string) => boolean;
  getRemainingDailyLimit: (tokenAddress: string) => string;
  getRemainingMonthlyLimit: (tokenAddress: string) => string;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

export function useCardIntegration(): UseCardIntegrationReturn {
  const { account, token, isAuthenticated } = useMetaMask();
  
  const [isCardLinked, setIsCardLinked] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  
  const [balances, setBalances] = useState<CardBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  const [spendingLimits, setSpendingLimitsState] = useState<SpendingLimit[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  // Check if card is linked on mount
  useEffect(() => {
    const checkCardLinkStatus = async () => {
      if (!isAuthenticated || !token || !account) return;

      try {
        const response = await cardAPI.getCardStatus({
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.success && response.data) {
          setIsCardLinked(response.data.isLinked);
          if (response.data.isLinked) {
            // Load initial card data
            await Promise.all([
              refreshBalances(),
              loadSpendingLimits(),
              getTransactionHistory({ limit: 20 }),
            ]);
          }
        }
      } catch (err: any) {
        console.error('Error checking card status:', err);
      }
    };

    checkCardLinkStatus();
  }, [isAuthenticated, token, account]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Link MetaMask Card
  const linkCard = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !token || !account) {
      throw new Error('Authentication required');
    }

    setLinkLoading(true);
    setError(null);

    try {
      const response = await cardAPI.linkCard({
        walletAddress: account,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        setIsCardLinked(true);
        // Load initial card data after linking
        await Promise.all([
          refreshBalances(),
          loadSpendingLimits(),
        ]);
      } else {
        throw new Error(response.error || 'Failed to link card');
      }
    } catch (err: any) {
      console.error('Error linking card:', err);
      setError(err.message);
      throw err;
    } finally {
      setLinkLoading(false);
    }
  }, [isAuthenticated, token, account]);

  // Unlink MetaMask Card
  const unlinkCard = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    setLinkLoading(true);
    setError(null);

    try {
      const response = await cardAPI.unlinkCard({
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        setIsCardLinked(false);
        setBalances([]);
        setTransactions([]);
        setSpendingLimitsState([]);
      } else {
        throw new Error(response.error || 'Failed to unlink card');
      }
    } catch (err: any) {
      console.error('Error unlinking card:', err);
      setError(err.message);
      throw err;
    } finally {
      setLinkLoading(false);
    }
  }, [isAuthenticated, token]);

  // Refresh card balances
  const refreshBalances = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !token || !isCardLinked) {
      return;
    }

    setBalancesLoading(true);
    setError(null);

    try {
      const response = await cardAPI.getBalances({
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setBalances(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch balances');
      }
    } catch (err: any) {
      console.error('Error fetching balances:', err);
      setError(err.message);
    } finally {
      setBalancesLoading(false);
    }
  }, [isAuthenticated, token, isCardLinked]);

  // Top up card
  const topUpCard = useCallback(async (
    tokenAddress: string, 
    amount: string, 
    sourceType: 'portfolio' | 'external_wallet'
  ): Promise<string> => {
    if (!isAuthenticated || !token || !isCardLinked) {
      throw new Error('Card not linked or authentication required');
    }

    setError(null);

    try {
      const response = await cardAPI.topUpCard({
        tokenAddress,
        amount,
        sourceType,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        // Refresh balances after top-up
        await refreshBalances();
        return response.data.transactionId;
      } else {
        throw new Error(response.error || 'Top-up failed');
      }
    } catch (err: any) {
      console.error('Error topping up card:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, token, isCardLinked, refreshBalances]);

  // Load spending limits
  const loadSpendingLimits = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !token || !isCardLinked) {
      return;
    }

    setLimitsLoading(true);
    setError(null);

    try {
      const response = await cardAPI.getSpendingLimits({
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setSpendingLimitsState(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch spending limits');
      }
    } catch (err: any) {
      console.error('Error fetching spending limits:', err);
      setError(err.message);
    } finally {
      setLimitsLoading(false);
    }
  }, [isAuthenticated, token, isCardLinked]);

  // Set spending limits
  const setSpendingLimits = useCallback(async (limits: SpendingLimit[]): Promise<void> => {
    if (!isAuthenticated || !token || !isCardLinked) {
      throw new Error('Card not linked or authentication required');
    }

    setError(null);

    try {
      const response = await cardAPI.updateSpendingLimits({
        limits,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success) {
        setSpendingLimitsState(limits);
      } else {
        throw new Error(response.error || 'Failed to update spending limits');
      }
    } catch (err: any) {
      console.error('Error updating spending limits:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, token, isCardLinked]);

  // Get transaction history
  const getTransactionHistory = useCallback(async (params?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    types?: string[];
    status?: string[];
  }): Promise<void> => {
    if (!isAuthenticated || !token || !isCardLinked) {
      return;
    }

    setTransactionsLoading(true);
    setError(null);

    try {
      const response = await cardAPI.getTransactions(params || {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        setTransactions(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch transactions');
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setTransactionsLoading(false);
    }
  }, [isAuthenticated, token, isCardLinked]);

  // Get spending analytics
  const getSpendingAnalytics = useCallback(async (timeframe: string): Promise<CardAnalyticsResponse> => {
    if (!isAuthenticated || !token || !isCardLinked) {
      throw new Error('Card not linked or authentication required');
    }

    setError(null);

    try {
      const response = await cardAPI.getAnalytics({
        timeframe,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
      throw err;
    }
  }, [isAuthenticated, token, isCardLinked]);

  // Get balance by token address
  const getBalanceByToken = useCallback((tokenAddress: string): CardBalance | undefined => {
    return balances.find(balance => balance.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
  }, [balances]);

  // Check if user can spend amount
  const canSpend = useCallback((amount: string, tokenAddress: string): boolean => {
    const balance = getBalanceByToken(tokenAddress);
    if (!balance) return false;
    
    const spendAmount = parseFloat(amount);
    const availableAmount = parseFloat(balance.availableBalance);
    
    return spendAmount <= availableAmount;
  }, [getBalanceByToken]);

  // Get remaining daily spending limit
  const getRemainingDailyLimit = useCallback((tokenAddress: string): string => {
    const dailyLimits = spendingLimits.filter(limit => 
      limit.limitType === 'daily' && limit.isActive
    );
    
    if (dailyLimits.length === 0) return '0';
    
    const totalDailyLimit = dailyLimits.reduce((sum, limit) => 
      sum + parseFloat(limit.limitAmount), 0
    );
    
    const usedToday = dailyLimits.reduce((sum, limit) => 
      sum + parseFloat(limit.usedAmount || '0'), 0
    );
    
    return Math.max(0, totalDailyLimit - usedToday).toString();
  }, [spendingLimits]);

  // Get remaining monthly spending limit
  const getRemainingMonthlyLimit = useCallback((tokenAddress: string): string => {
    const monthlyLimits = spendingLimits.filter(limit => 
      limit.limitType === 'monthly' && limit.isActive
    );
    
    if (monthlyLimits.length === 0) return '0';
    
    const totalMonthlyLimit = monthlyLimits.reduce((sum, limit) => 
      sum + parseFloat(limit.limitAmount), 0
    );
    
    const usedThisMonth = monthlyLimits.reduce((sum, limit) => 
      sum + parseFloat(limit.usedAmount || '0'), 0
    );
    
    return Math.max(0, totalMonthlyLimit - usedThisMonth).toString();
  }, [spendingLimits]);

  // Calculate total USD value
  const totalValueUSD = balances.reduce((sum, balance) => 
    sum + parseFloat(balance.usdValue || '0'), 0
  ).toFixed(2);

  return {
    // Card status
    isCardLinked,
    linkLoading,
    
    // Balances
    balances,
    balancesLoading,
    totalValueUSD,
    
    // Transactions
    transactions,
    transactionsLoading,
    
    // Spending limits
    spendingLimits,
    limitsLoading,
    
    // Actions
    linkCard,
    unlinkCard,
    refreshBalances,
    topUpCard,
    setSpendingLimits,
    getTransactionHistory,
    
    // Analytics
    getSpendingAnalytics,
    
    // Utility functions
    getBalanceByToken,
    canSpend,
    getRemainingDailyLimit,
    getRemainingMonthlyLimit,
    
    // Error handling
    error,
    clearError,
  };
}

// Hook for card analytics with caching
export function useCardAnalytics(timeframe: string) {
  const { getSpendingAnalytics, isCardLinked } = useCardIntegration();
  const [analytics, setAnalytics] = useState<CardAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [spendingTrends, setSpendingTrends] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    if (!isCardLinked) return;

    setLoading(true);
    try {
      const data = await getSpendingAnalytics(timeframe);
      setAnalytics(data);
      setSpendingTrends(data.monthlyTrend || []);
      setCategoryBreakdown(data.topCategories || []);
      // Mock top merchants from category data
      setTopMerchants(data.topCategories?.map(cat => ({
        name: `Top ${cat.category} Merchant`,
        amount: cat.amount,
        count: cat.count,
      })) || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [isCardLinked, getSpendingAnalytics, timeframe]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    analytics,
    loading,
    spendingTrends,
    categoryBreakdown,
    topMerchants,
    refresh,
  };
}

export default useCardIntegration;
