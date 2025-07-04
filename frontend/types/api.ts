// FlowBridge Frontend - API Request and Response Type Definitions

// Base API Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
}

// Authentication API Types
export interface AuthChallengeRequest {
  address: string;
}

export interface AuthChallengeResponse extends APIResponse {
  message: string;
  nonce: string;
  expiresAt: string;
}

export interface AuthVerifyRequest {
  address: string;
  signature: string;
  message: string;
  chainId: number;
}

export interface AuthVerifyResponse extends APIResponse {
  token: string;
  user: {
    address: string;
    chainId: number;
    nonce: string;
  };
  expiresAt: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse extends APIResponse {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

// Portfolio API Types
export interface CreatePortfolioRequest {
  name: string;
  description?: string;
  riskTolerance: number;
  autoRebalanceEnabled?: boolean;
  initialStrategies?: CreateStrategyRequest[];
}

export interface CreatePortfolioResponse extends APIResponse {
  portfolioId: string;
  portfolio: Portfolio;
}

export interface UpdatePortfolioRequest {
  name?: string;
  description?: string;
  riskTolerance?: number;
  autoRebalanceEnabled?: boolean;
}

export interface GetPortfolioResponse extends APIResponse {
  portfolio: Portfolio;
}

export interface GetPortfoliosResponse extends APIResponse {
  portfolios: Portfolio[];
}

export interface DeletePortfolioResponse extends APIResponse {
  deletedAt: string;
}

// Balance API Types
export interface GetBalanceRequest {
  address: string;
  chainId?: number;
  tokenAddresses?: string[];
  includeUsdValue?: boolean;
}

export interface BalanceData {
  address: string;
  chainId: number;
  nativeBalance: string;
  nativeSymbol: string;
  nativeUsdValue: string;
  tokenBalances: TokenBalance[];
  totalUsdValue: string;
  lastUpdated: string;
}

export interface GetBalanceResponse extends APIResponse<BalanceData> {}

// Yield Strategy API Types
export interface CreateStrategyRequest {
  portfolioId: string;
  protocolId: string;
  strategyName: string;
  strategyType: string;
  tokenAddress: string;
  tokenSymbol: string;
  chainId: number;
  allocationPercentage: number;
  deployedAmount: string;
  currentApy: string;
  riskScore: number;
  autoRebalanceEnabled?: boolean;
  customParameters?: Record<string, any>;
}

export interface CreateStrategyResponse extends APIResponse {
  strategyId: string;
  strategy: YieldStrategy;
}

export interface UpdateStrategyRequest {
  strategyName?: string;
  allocationPercentage?: number;
  autoRebalanceEnabled?: boolean;
  customParameters?: Record<string, any>;
}

export interface UpdateStrategyResponse extends APIResponse {
  strategy: YieldStrategy;
}

export interface GetStrategiesRequest {
  portfolioId?: string;
  active?: boolean;
  protocolId?: string;
  chainId?: number;
  page?: number;
  limit?: number;
}

export interface GetStrategiesResponse extends PaginatedResponse<YieldStrategy> {}

export interface DeleteStrategyResponse extends APIResponse {
  deletedAt: string;
}

export interface ExecuteStrategyActionRequest {
  strategyId: string;
  action: 'harvest' | 'withdraw' | 'compound' | 'rebalance';
  amount?: string;
  gasPrice?: string;
  slippageTolerance?: number;
}

export interface ExecuteStrategyActionResponse extends APIResponse {
  transactionHash: string;
  estimatedGasCost: string;
  expectedOutput?: string;
}

// Rebalancing API Types
export interface InitiateRebalanceRequest {
  portfolioId: string;
  newAllocations: Record<string, string>;
  slippageTolerance: number;
  gasPrice?: string;
  forceRebalance?: boolean;
  deadline?: number;
}

export interface InitiateRebalanceResponse extends APIResponse {
  rebalanceId: string;
  execution: RebalanceExecution;
}

export interface GetRebalanceStatusRequest {
  rebalanceId: string;
}

export interface GetRebalanceStatusResponse extends APIResponse<RebalanceExecution> {}

export interface GetRebalanceHistoryRequest {
  portfolioId: string;
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetRebalanceHistoryResponse extends PaginatedResponse<RebalanceExecution> {}

export interface UpdateRebalanceSettingsRequest {
  portfolioId: string;
  settings: RebalanceSettings;
}

export interface UpdateRebalanceSettingsResponse extends APIResponse<RebalanceSettings> {}

// AI Optimization API Types
export interface GenerateOptimizationRequest {
  portfolioId: string;
  totalAmount: string;
  userRiskTolerance: number;
  timeHorizon?: 'short' | 'medium' | 'long';
  forceRebalance?: boolean;
  excludeProtocols?: string[];
  includeOnlyCategories?: string[];
  maxSlippage?: number;
  customConstraints?: Record<string, any>;
}

export interface OptimizationStrategy {
  protocolId: string;
  protocolName: string;
  tokenSymbol: string;
  allocationPercentage: number;
  expectedAPY: number;
  riskScore: number;
  liquidityScore: number;
  confidence: number;
  reasoning: string;
}

export interface OptimizationResult {
  optimizationId: string;
  portfolioId: string;
  currentAllocation: Record<string, number>;
  recommendedAllocation: Record<string, number>;
  strategies: OptimizationStrategy[];
  expectedAPY: string;
  expectedRisk: number;
  diversificationScore: number;
  confidenceScore: number;
  gasCostEstimate: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  reasoning: string;
  createdAt: string;
  validUntil: string;
}

export interface GenerateOptimizationResponse extends APIResponse<OptimizationResult> {}

export interface ImplementOptimizationRequest {
  optimizationId: string;
  slippageTolerance?: number;
  gasPrice?: string;
}

export interface ImplementOptimizationResponse extends APIResponse {
  rebalanceId: string;
  transactionHashes: string[];
  estimatedGasCost: string;
}

// AI Insights API Types
export interface GenerateInsightsRequest {
  portfolioId: string;
  forceRefresh?: boolean;
  insightTypes?: string[];
  minConfidence?: number;
  timeframe?: string;
}

export interface GetInsightsRequest {
  portfolioId: string;
  priority?: string;
  insightType?: string;
  implemented?: boolean;
  page?: number;
  limit?: number;
}

export interface GetInsightsResponse extends PaginatedResponse<AIInsight> {}

export interface UpdateInsightRequest {
  insightId: string;
  isImplemented?: boolean;
  actionTaken?: string;
  feedback?: string;
}

export interface UpdateInsightResponse extends APIResponse<AIInsight> {}

// Risk Assessment API Types
export interface AssessRiskRequest {
  portfolioId: string;
  includeRecommendations?: boolean;
  detailedAnalysis?: boolean;
}

export interface AssessRiskResponse extends APIResponse<RiskAssessment> {}

export interface UpdateRiskProfileRequest {
  address: string;
  riskProfile: RiskProfile;
}

export interface UpdateRiskProfileResponse extends APIResponse<RiskProfile> {}

// Protocol API Types
export interface GetProtocolsRequest {
  category?: string;
  chainId?: number;
  minTvl?: string;
  minApy?: number;
  maxRisk?: number;
  auditStatus?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetProtocolsResponse extends PaginatedResponse<Protocol> {}

export interface GetProtocolDetailsRequest {
  protocolId: string;
  includeMarkets?: boolean;
  includeRiskData?: boolean;
}

export interface ProtocolDetails extends Protocol {
  markets?: any[];
  riskAnalysis?: any;
  historicalData?: any[];
}

export interface GetProtocolDetailsResponse extends APIResponse<ProtocolDetails> {}

// Cross-chain Bridge API Types
export interface GetBridgeQuoteRequest {
  sourceChain: number;
  destinationChain: number;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  recipient: string;
  slippageTolerance?: number;
  deadline?: number;
}

export interface GetBridgeQuoteResponse extends APIResponse<BridgeQuote[]> {}

export interface InitiateBridgeRequest {
  routeId: string;
  slippageTolerance: number;
  deadline: number;
  recipient: string;
  gasPrice?: string;
}

export interface InitiateBridgeResponse extends APIResponse {
  transactionId: string;
  transactionHash: string;
  estimatedCompletionTime: number;
}

export interface GetBridgeStatusRequest {
  transactionId: string;
}

export interface BridgeStatusData {
  id: string;
  status: string;
  sourceTransactionHash?: string;
  destinationTransactionHash?: string;
  progress: number;
  estimatedCompletionTime: number;
  errorMessage?: string;
  refundTransactionHash?: string;
}

export interface GetBridgeStatusResponse extends APIResponse<BridgeStatusData> {}

export interface GetBridgeHistoryRequest {
  address: string;
  page?: number;
  limit?: number;
  status?: string;
  fromChain?: number;
  toChain?: number;
  startDate?: string;
  endDate?: string;
}

export interface GetBridgeHistoryResponse extends PaginatedResponse<BridgeTransaction> {}

// Card Integration API Types
export interface LinkCardRequest {
  walletAddress: string;
  cardToken?: string;
  verificationCode?: string;
}

export interface LinkCardResponse extends APIResponse {
  cardId: string;
  linkedAt: string;
}

export interface UnlinkCardResponse extends APIResponse {
  unlinkedAt: string;
}

export interface GetCardStatusResponse extends APIResponse {
  isLinked: boolean;
  cardId?: string;
  linkedAt?: string;
  lastActivity?: string;
}

export interface CardBalanceData {
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

export interface GetCardBalancesResponse extends APIResponse<CardBalanceData[]> {}

export interface TopUpCardRequest {
  tokenAddress: string;
  amount: string;
  sourceType: 'portfolio' | 'external_wallet';
  gasPrice?: string;
}

export interface TopUpCardResponse extends APIResponse {
  transactionId: string;
  transactionHash: string;
  estimatedArrival: string;
}

export interface CardTransaction {
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

export interface GetCardTransactionsRequest {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  types?: string[];
  status?: string[];
  merchantCategory?: string;
}

export interface GetCardTransactionsResponse extends APIResponse<CardTransaction[]> {}

export interface SpendingLimit {
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

export interface UpdateSpendingLimitsRequest {
  limits: SpendingLimit[];
}

export interface UpdateSpendingLimitsResponse extends APIResponse<SpendingLimit[]> {}

export interface GetSpendingLimitsResponse extends APIResponse<SpendingLimit[]> {}

export interface GetCardAnalyticsRequest {
  timeframe: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  category?: string;
}

export interface CardAnalyticsData {
  totalSpent: string;
  transactionCount: number;
  averageTransactionAmount: string;
  topCategories: Array<{
    category: string;
    amount: string;
    count: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: string;
    count: number;
  }>;
  yieldSacrificed: string;
  opportunityCost: string;
  savingsOpportunities: Array<{
    category: string;
    potentialSavings: string;
    recommendation: string;
  }>;
}

export interface GetCardAnalyticsResponse extends APIResponse<CardAnalyticsData> {}

// Notification API Types
export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface CreateNotificationResponse extends APIResponse {
  notificationId: string;
}

export interface GetNotificationsRequest {
  read?: boolean;
  type?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  expiresAt?: string;
  metadata: Record<string, any>;
}

export interface GetNotificationsResponse extends PaginatedResponse<NotificationData> {}

export interface MarkNotificationReadRequest {
  notificationId: string;
}

export interface MarkNotificationReadResponse extends APIResponse {}

// Analytics API Types
export interface TrackEventRequest {
  event: string;
  properties: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

export interface TrackEventResponse extends APIResponse {}

export interface GetAnalyticsRequest {
  metric: string;
  timeframe: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  filters?: Record<string, any>;
}

export interface AnalyticsData {
  metric: string;
  timeframe: string;
  granularity: string;
  data: Array<{
    timestamp: string;
    value: number;
    metadata?: Record<string, any>;
  }>;
  summary: {
    total: number;
    average: number;
    min: number;
    max: number;
    change: number;
    changePercent: number;
  };
}

export interface GetAnalyticsResponse extends APIResponse<AnalyticsData> {}

// Import types from main index
import type {
  Portfolio,
  YieldStrategy,
  Protocol,
  RebalanceExecution,
  RebalanceSettings,
  OptimizationSuggestion,
  AIInsight,
  RiskAssessment,
  RiskProfile,
  TokenBalance,
  BridgeQuote,
  BridgeTransaction,
} from './index';
