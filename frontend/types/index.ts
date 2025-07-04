// FlowBridge Frontend - Main Type Definitions

// User and Authentication Types
export interface User {
  id: string;
  walletAddress: string;
  chainId: number;
  isVerified: boolean;
  riskProfile: RiskProfile;
  preferences: UserPreferences;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  currency: 'USD' | 'EUR' | 'GBP';
  language: string;
  notifications: NotificationSettings;
  defaultChain: number;
  autoRebalance: boolean;
  gasPreference: 'slow' | 'standard' | 'fast';
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  portfolio: boolean;
  transactions: boolean;
  security: boolean;
  marketing: boolean;
}

export interface RiskProfile {
  tolerance: number; // 1-10 scale
  timeHorizon: 'short' | 'medium' | 'long';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  maxAllocationPercentage: number;
  preferredCategories: string[];
  excludedProtocols: string[];
  updatedAt: string;
}

// Portfolio and Strategy Types
export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  totalValue: string;
  totalYieldEarned: string;
  currentAPY: string;
  riskScore: number;
  strategies: YieldStrategy[];
  isActive: boolean;
  autoRebalanceEnabled: boolean;
  lastRebalancedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface YieldStrategy {
  id: string;
  portfolioId: string;
  strategyName: string;
  protocolName: string;
  protocolId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chainId: number;
  chainName: string;
  strategyType: StrategyType;
  deployedAmount: string;
  currentValue: string;
  yieldEarned: string;
  currentApy: string;
  expectedApy: string;
  riskScore: number;
  allocationPercentage: string;
  isActive: boolean;
  isAutoRebalanceEnabled: boolean;
  lastHarvestedAt?: string;
  createdAt: string;
  lastRebalancedAt?: string;
  category: ProtocolCategory;
  metadata: StrategyMetadata;
}

export type StrategyType = 
  | 'single_asset' 
  | 'lp_token' 
  | 'vault' 
  | 'lending' 
  | 'staking' 
  | 'yield_farming'
  | 'derivatives';

export type ProtocolCategory = 
  | 'lending' 
  | 'dex' 
  | 'yield_farming' 
  | 'liquidity_mining' 
  | 'derivatives' 
  | 'insurance' 
  | 'staking';

export interface StrategyMetadata {
  contractAddress: string;
  poolId?: string;
  lpTokenAddress?: string;
  rewardTokens: string[];
  harvestFrequency: number; // in hours
  compoundingEnabled: boolean;
  emergencyExitEnabled: boolean;
  customParameters: Record<string, any>;
}

// Protocol and Market Data Types
export interface Protocol {
  id: string;
  name: string;
  category: ProtocolCategory;
  description: string;
  website: string;
  logoUrl: string;
  tvl: string;
  apyCurrent: string;
  apyHistorical: string;
  apy7d: string;
  apy30d: string;
  riskScore: number;
  liquidityScore: number;
  auditStatus: AuditStatus;
  supportedChains: number[];
  supportedTokens: string[];
  integrationStatus: IntegrationStatus;
  fees: ProtocolFees;
  lastUpdated: string;
  isActive: boolean;
}

export type AuditStatus = 'audited' | 'unaudited' | 'partially_audited';
export type IntegrationStatus = 'active' | 'maintenance' | 'deprecated' | 'beta';

export interface ProtocolFees {
  depositFee: string;
  withdrawalFee: string;
  performanceFee: string;
  managementFee: string;
  gasEstimate: string;
}

// Transaction and History Types
export interface Transaction {
  id: string;
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  chainId: number;
  blockNumber: number;
  timestamp: string;
  confirmations: number;
  metadata: TransactionMetadata;
}

export type TransactionType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'harvest' 
  | 'compound' 
  | 'rebalance' 
  | 'bridge' 
  | 'swap' 
  | 'approval';

export type TransactionStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'failed' 
  | 'cancelled' 
  | 'replaced';

export interface TransactionMetadata {
  strategyId?: string;
  protocolName?: string;
  tokenSymbol?: string;
  amount?: string;
  usdValue?: string;
  gasEstimate?: string;
  errorMessage?: string;
  retryCount?: number;
}

// AI and Optimization Types
export interface OptimizationSuggestion {
  id: string;
  optimizationType: OptimizationType;
  portfolioId: string;
  title: string;
  description: string;
  currentAllocation: Record<string, string>;
  suggestedAllocation: Record<string, string>;
  expectedApyImprovement?: string;
  riskScoreChange?: number;
  estimatedGasCost: string;
  confidenceScore: number;
  implementationComplexity: ComplexityLevel;
  reasoning: string;
  validUntil: string;
  status: SuggestionStatus;
  createdAt: string;
  implementedAt?: string;
}

export type OptimizationType = 
  | 'rebalance' 
  | 'yield_optimization' 
  | 'risk_reduction' 
  | 'gas_optimization' 
  | 'protocol_migration';

export type ComplexityLevel = 'low' | 'medium' | 'high';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'implemented' | 'expired';

export interface AIInsight {
  id: string;
  portfolioId: string;
  insightType: InsightType;
  priority: Priority;
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
  metadata: InsightMetadata;
}

export type InsightType = 
  | 'yield_optimization' 
  | 'risk_alert' 
  | 'rebalance_suggestion' 
  | 'market_trend' 
  | 'protocol_analysis' 
  | 'gas_optimization';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface InsightMetadata {
  triggeredBy?: string;
  affectedStrategies?: string[];
  marketConditions?: MarketCondition[];
  riskFactors?: string[];
  potentialImpact?: string;
  customData?: Record<string, any>;
}

export interface MarketCondition {
  metric: string;
  value: string;
  change: string;
  timeframe: string;
}

// Rebalancing Types
export interface RebalanceExecution {
  id: string;
  portfolioId: string;
  status: RebalanceStatus;
  oldAllocations: Record<string, string>;
  newAllocations: Record<string, string>;
  transactionHashes: string[];
  gasUsed: string;
  estimatedGasCost: string;
  actualGasCost: string;
  expectedApyImprovement: string;
  actualApyImprovement?: string;
  slippageTolerance: number;
  deadline: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
}

export type RebalanceStatus = 
  | 'pending' 
  | 'estimating' 
  | 'executing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'partially_completed';

export interface RebalanceSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'threshold_based';
  thresholdPercentage: number;
  maxSlippage: number;
  gasPrice: 'slow' | 'standard' | 'fast' | 'custom';
  customGasPrice?: string;
  scheduledTime?: string;
  emergencyStopEnabled: boolean;
}

// Yield and Performance Types
export interface YieldMetrics {
  totalValue: string;
  totalYieldEarned: string;
  dailyYield: string;
  weeklyYield: string;
  monthlyYield: string;
  yearlyYield: string;
  currentAPY: string;
  averageAPY: string;
  bestPerformingStrategy: string;
  worstPerformingStrategy: string;
  riskAdjustedReturn: string;
  sharpeRatio: number;
  maxDrawdown: string;
  volatility: string;
  lastUpdated: string;
}

export interface PerformanceData {
  timestamp: string;
  portfolioValue: string;
  yieldEarned: string;
  apy: string;
  riskScore: number;
  gasSpent: string;
  transactionCount: number;
}

export interface YieldHistoryPoint {
  timestamp: string;
  yieldEarned: string;
  apy: string;
  cumulativeYield: string;
  strategyId: string;
  protocolName: string;
  riskScore: number;
}

// Risk Management Types
export interface RiskAssessment {
  portfolioId: string;
  overallRiskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  recommendations: string[];
  concentrationRisk: ConcentrationRisk;
  liquidityRisk: LiquidityRisk;
  protocolRisk: ProtocolRisk[];
  marketRisk: MarketRisk;
  assessedAt: string;
  validUntil: string;
}

export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'extreme';

export interface RiskFactor {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  mitigationSuggestions: string[];
}

export interface ConcentrationRisk {
  maxSingleProtocol: number;
  maxSingleToken: number;
  maxSingleChain: number;
  diversificationScore: number;
  recommendations: string[];
}

export interface LiquidityRisk {
  averageLiquidityScore: number;
  illiquidPositions: string[];
  estimatedExitTime: string;
  slippageEstimate: string;
}

export interface ProtocolRisk {
  protocolId: string;
  protocolName: string;
  riskScore: number;
  auditStatus: AuditStatus;
  tvlTrend: 'increasing' | 'stable' | 'decreasing';
  lastIncident?: string;
  insuranceCoverage: boolean;
}

export interface MarketRisk {
  volatilityScore: number;
  correlationRisk: number;
  liquidityConditions: 'favorable' | 'normal' | 'stressed';
  marketSentiment: 'bullish' | 'neutral' | 'bearish';
  expectedDrawdown: string;
}

// UI Component Types
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
  progress?: number;
}

export interface ErrorState {
  hasError: boolean;
  error?: Error | string;
  errorCode?: string;
  retryable?: boolean;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export interface SortingProps {
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string, direction: 'asc' | 'desc') => void;
}

export interface FilterProps {
  filters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
  onFilterReset: () => void;
}

// Chart and Visualization Types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface ChartConfiguration {
  type: 'line' | 'bar' | 'pie' | 'donut' | 'area';
  timeframe: '1h' | '1d' | '7d' | '30d' | '90d' | '1y' | 'all';
  showGrid: boolean;
  showTooltip: boolean;
  showLegend: boolean;
  colors: string[];
  height: number;
  responsive: boolean;
}

// Event and Notification Types
export interface AppEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  priority: Priority;
  actionUrl?: string;
  metadata: Record<string, any>;
}

export type EventType = 
  | 'transaction' 
  | 'yield_harvest' 
  | 'rebalance' 
  | 'security_alert' 
  | 'price_alert' 
  | 'protocol_update' 
  | 'system_maintenance';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

// Search and Discovery Types
export interface SearchResult {
  id: string;
  type: 'protocol' | 'strategy' | 'token' | 'transaction';
  title: string;
  description: string;
  relevanceScore: number;
  category?: string;
  metadata: Record<string, any>;
}

export interface SearchFilters {
  category?: ProtocolCategory[];
  chains?: number[];
  minAPY?: number;
  maxRisk?: number;
  minTVL?: number;
  auditStatus?: AuditStatus[];
}

// Export utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Environment and Configuration Types
export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
  walletConnectProjectId: string;
  infuraApiKey: string;
  supportedChains: number[];
  defaultChain: number;
  features: FeatureFlags;
  analytics: AnalyticsConfig;
}

export interface FeatureFlags {
  aiOptimization: boolean;
  crossChain: boolean;
  cardIntegration: boolean;
  analytics: boolean;
  notifications: boolean;
  darkMode: boolean;
  testnet: boolean;
}

export interface AnalyticsConfig {
  enabled: boolean;
  provider: 'google' | 'mixpanel' | 'amplitude';
  trackingId: string;
  anonymizeData: boolean;
}
