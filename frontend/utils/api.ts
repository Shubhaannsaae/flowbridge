// FlowBridge Frontend - API Utilities and Services
import { API_ENDPOINTS } from './constants';

// API response interface
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request configuration
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

// Base API client
class APIClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 30000,
    } = config;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body: data });
  }

  async put<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body: data });
  }

  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: any, config?: Omit<RequestConfig, 'method'>): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body: data });
  }
}

// Create API client instance
const apiClient = new APIClient();

// Authentication API
export const authAPI = {
  getChallenge: (address: string) =>
    apiClient.get(`${API_ENDPOINTS.AUTH}/metamask?address=${address}`),
  
  authenticate: (data: {
    address: string;
    signature: string;
    message: string;
    chainId: number;
  }) =>
    apiClient.post(`${API_ENDPOINTS.AUTH}/metamask`, data),
};

// Portfolio API
export const portfolioAPI = {
  getPortfolios: (address: string) =>
    apiClient.get(`${API_ENDPOINTS.PORTFOLIO}?address=${address}`),
  
  createPortfolio: (data: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.PORTFOLIO}`, data, config),
  
  updatePortfolio: (portfolioId: string, data: any, config?: RequestConfig) =>
    apiClient.put(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}`, data, config),
  
  deletePortfolio: (portfolioId: string, config?: RequestConfig) =>
    apiClient.delete(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}`, config),
  
  getBalances: (address: string, chainId?: number, config?: RequestConfig) => {
    const params = new URLSearchParams({ address });
    if (chainId) params.append('chainId', chainId.toString());
    return apiClient.get(`${API_ENDPOINTS.BALANCE}?${params}`, config);
  },
  
  rebalance: (portfolioId: string, data: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.REBALANCE}`, { portfolioId, ...data }, config),
  
  getRebalanceHistory: (portfolioId: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.REBALANCE}?portfolioId=${portfolioId}`, config),
  
  getRebalanceSettings: (portfolioId: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/rebalance-settings`, config),
  
  updateRebalanceSettings: (portfolioId: string, settings: any, config?: RequestConfig) =>
    apiClient.put(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/rebalance-settings`, settings, config),
  
  optimize: (portfolioId: string, params: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.AI_OPTIMIZE}`, { portfolioId, ...params }, config),
  
  getLiquiditySettings: (address: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.PORTFOLIO}/liquidity-settings?address=${address}`, config),
  
  updateLiquiditySettings: (address: string, settings: any, config?: RequestConfig) =>
    apiClient.put(`${API_ENDPOINTS.PORTFOLIO}/liquidity-settings`, { address, ...settings }, config),
  
  getLiquidityFlows: (address: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.PORTFOLIO}/liquidity-flows?address=${address}`, config),
  
  emergencyWithdrawal: (portfolioId: string, data: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/emergency-withdrawal`, data, config),
};

// Yield API
export const yieldAPI = {
  getStrategies: (params?: { portfolioId?: string; active?: boolean }, config?: RequestConfig) => {
    const searchParams = new URLSearchParams();
    if (params?.portfolioId) searchParams.append('portfolioId', params.portfolioId);
    if (params?.active !== undefined) searchParams.append('active', params.active.toString());
    
    const query = searchParams.toString();
    return apiClient.get(`${API_ENDPOINTS.YIELDS}${query ? `?${query}` : ''}`, config);
  },
  
  createStrategy: (data: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.YIELDS}`, data, config),
  
  updateStrategy: (strategyId: string, data: any, config?: RequestConfig) =>
    apiClient.put(`${API_ENDPOINTS.YIELDS}?strategyId=${strategyId}`, data, config),
  
  deleteStrategy: (strategyId: string, config?: RequestConfig) =>
    apiClient.delete(`${API_ENDPOINTS.YIELDS}?strategyId=${strategyId}`, config),
  
  getProtocols: () =>
    apiClient.get('/api/protocols'),
  
  getYieldHistory: (portfolioId: string, timeframe: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/yield-history?timeframe=${timeframe}`, config),
  
  executeStrategyAction: (data: {
    strategyId: string;
    action: 'harvest' | 'withdraw' | 'compound';
    chainId: number;
  }, config?: RequestConfig) =>
    apiClient.post('/api/strategy-actions', data, config),
};

// AI API
export const aiAPI = {
  generateOptimization: (data: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.AI_OPTIMIZE}`, data, config),
  
  getOptimizations: (portfolioId: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.AI_OPTIMIZE}?portfolioId=${portfolioId}`, config),
  
  implementOptimization: (optimizationId: string, config?: RequestConfig) =>
    apiClient.post(`/api/ai/implement/${optimizationId}`, {}, config),
  
  dismissOptimization: (optimizationId: string, config?: RequestConfig) =>
    apiClient.delete(`/api/ai/optimize/${optimizationId}`, config),
  
  getInsights: (portfolioId: string, config?: RequestConfig) =>
    apiClient.get(`${API_ENDPOINTS.AI_INSIGHTS}?portfolioId=${portfolioId}`, config),
  
  generateInsights: (data: any, config?: RequestConfig) =>
    apiClient.post(`${API_ENDPOINTS.AI_INSIGHTS}`, data, config),
  
  updateInsight: (insightId: string, data: any, config?: RequestConfig) =>
    apiClient.put(`${API_ENDPOINTS.AI_INSIGHTS}?insightId=${insightId}`, data, config),
};

// Risk API
export const riskAPI = {
  getRiskProfile: (address: string, config?: RequestConfig) =>
    apiClient.get(`/api/risk/profile?address=${address}`, config),
  
  updateRiskProfile: (address: string, profile: any, config?: RequestConfig) =>
    apiClient.put(`/api/risk/profile`, { address, ...profile }, config),
  
  assessPortfolio: (portfolioId: string, config?: RequestConfig) =>
    apiClient.get(`/api/risk/assess/${portfolioId}`, config),
};

// Bridge API
export const bridgeAPI = {
  getQuote: (params: any, config?: RequestConfig) =>
    apiClient.post('/api/bridge/quote', params, config),
  
  initiateBridge: (data: any, config?: RequestConfig) =>
    apiClient.post('/api/bridge/initiate', data, config),
  
  getStatus: (transactionId: string, config?: RequestConfig) =>
    apiClient.get(`/api/bridge/status/${transactionId}`, config),
  
  getHistory: (address: string, config?: RequestConfig) =>
    apiClient.get(`/api/bridge/history?address=${address}`, config),
};

// Card API (MetaMask Card integration)
export const cardAPI = {
  getCardStatus: (config?: RequestConfig) =>
    apiClient.get('/api/card/status', config),
  
  linkCard: (data: { walletAddress: string }, config?: RequestConfig) =>
    apiClient.post('/api/card/link', data, config),
  
  unlinkCard: (config?: RequestConfig) =>
    apiClient.delete('/api/card/link', config),
  
  getBalances: (config?: RequestConfig) =>
    apiClient.get('/api/card/balances', config),
  
  topUpCard: (data: {
    tokenAddress: string;
    amount: string;
    sourceType: 'portfolio' | 'external_wallet';
  }, config?: RequestConfig) =>
    apiClient.post('/api/card/topup', data, config),
  
  getTransactions: (params: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    types?: string[];
    status?: string[];
  }, config?: RequestConfig) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    return apiClient.get(`/api/card/transactions?${searchParams}`, config);
  },
  
  getSpendingLimits: (config?: RequestConfig) =>
    apiClient.get('/api/card/limits', config),
  
  updateSpendingLimits: (data: { limits: any[] }, config?: RequestConfig) =>
    apiClient.put('/api/card/limits', data, config),
  
  getAnalytics: (params: { timeframe: string }, config?: RequestConfig) =>
    apiClient.get(`/api/card/analytics?timeframe=${params.timeframe}`, config),
};

// Utility functions for API calls
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
};

export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
};

// Cache utility for API responses
class APICache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const apiCache = new APICache();

// Cached API wrapper
export const withCache = <T>(
  cacheKey: string,
  apiCall: () => Promise<APIResponse<T>>,
  ttl?: number
): Promise<APIResponse<T>> => {
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }
  
  return apiCall().then(response => {
    if (response.success) {
      apiCache.set(cacheKey, response, ttl);
    }
    return response;
  });
};
