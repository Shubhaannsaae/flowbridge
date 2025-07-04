// FlowBridge Frontend - Web3 and Blockchain Type Definitions
import { BigNumber } from 'ethers';

// Network and Chain Types
export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  iconUrl?: string;
  isTestnet: boolean;
  nativeCurrency: NativeCurrency;
  multicallAddress?: string;
  ensRegistryAddress?: string;
}

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface ChainInfo {
  chainId: number;
  chainName: string;
  nativeCurrency: NativeCurrency;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrls?: string[];
}

// Token Types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  tags?: string[];
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: string;
  usdValue?: string;
  lastUpdated: string;
}

export interface TokenPrice {
  address: string;
  symbol: string;
  usd: number;
  usd_24h_change: number;
  usd_24h_vol: number;
  usd_market_cap: number;
  last_updated_at: number;
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  holders: number;
  transfers: number;
  logoURI?: string;
  description?: string;
  website?: string;
  twitter?: string;
  coinGeckoId?: string;
  tags: string[];
}

// Transaction Types
export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  type?: number;
  accessList?: AccessListEntry[];
}

export interface AccessListEntry {
  address: string;
  storageKeys: string[];
}

export interface TransactionResponse {
  hash: string;
  to?: string;
  from: string;
  nonce: number;
  gasLimit: BigNumber;
  gasPrice?: BigNumber;
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
  data: string;
  value: BigNumber;
  chainId: number;
  type?: number;
  accessList?: AccessListEntry[];
  blockNumber?: number;
  blockHash?: string;
  timestamp?: number;
  confirmations: number;
  raw?: string;
  wait: (confirmations?: number) => Promise<TransactionReceipt>;
}

export interface TransactionReceipt {
  to?: string;
  from: string;
  contractAddress?: string;
  transactionIndex: number;
  gasUsed: BigNumber;
  logsBloom: string;
  blockHash: string;
  transactionHash: string;
  logs: Log[];
  blockNumber: number;
  confirmations: number;
  cumulativeGasUsed: BigNumber;
  effectiveGasPrice: BigNumber;
  status?: number;
  type: number;
  byzantium: boolean;
  events?: Event[];
}

export interface Log {
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  removed: boolean;
  address: string;
  data: string;
  topics: string[];
  transactionHash: string;
  logIndex: number;
}

export interface Event extends Log {
  event?: string;
  eventSignature?: string;
  args?: any[];
  decode?: (data: string, topics: string[]) => any;
}

// Gas Types
export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCostWei: string;
  estimatedCostEth: string;
  estimatedCostUsd: string;
}

export interface GasPrices {
  slow: GasPrice;
  standard: GasPrice;
  fast: GasPrice;
  instant: GasPrice;
}

export interface GasPrice {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedTime: number; // in seconds
  confidence: number; // 0-100
}

export interface FeeData {
  maxFeePerGas?: BigNumber;
  maxPriorityFeePerGas?: BigNumber;
  gasPrice?: BigNumber;
  lastBaseFeePerGas?: BigNumber;
}

// Smart Contract Types
export interface Contract {
  address: string;
  abi: any[];
  bytecode?: string;
  deployedBytecode?: string;
  chainId: number;
  blockNumber?: number;
  transactionHash?: string;
}

export interface ContractCall {
  target: string;
  callData: string;
  value?: string;
  gasLimit?: string;
}

export interface ContractCallResult {
  success: boolean;
  returnData: string;
  gasUsed: string;
  error?: string;
}

export interface MulticallRequest {
  calls: ContractCall[];
  blockNumber?: number;
  requireSuccess?: boolean;
}

export interface MulticallResponse {
  blockNumber: number;
  results: ContractCallResult[];
  totalGasUsed: string;
}

// Wallet Types
export interface WalletInfo {
  address: string;
  chainId: number;
  isConnected: boolean;
  balance: string;
  balanceFormatted: string;
  nonce: number;
  ensName?: string;
  ensAvatar?: string;
}

export interface WalletProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isWalletConnect?: boolean;
  request: (args: RequestArguments) => Promise<any>;
  on: (event: string, listener: (...args: any[]) => void) => void;
  removeListener: (event: string, listener: (...args: any[]) => void) => void;
  disconnect?: () => Promise<void>;
}

export interface RequestArguments {
  method: string;
  params?: any[] | Record<string, any>;
}

export interface ConnectInfo {
  chainId: string;
}

export interface ProviderMessage {
  type: string;
  data: any;
}

export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: any;
}

// Cross-chain Bridge Types
export interface BridgeRoute {
  id: string;
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  minReceived: string;
  estimatedTime: number; // in minutes
  fee: string;
  gasEstimate: BigNumber;
  bridgeProvider: string;
  steps: BridgeStep[];
  tags?: string[];
}

export interface BridgeStep {
  type: 'bridge' | 'swap' | 'deposit' | 'withdraw';
  protocol: string;
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  data: string;
  gasEstimate: string;
  fee: string;
}

export interface BridgeQuote {
  route: BridgeRoute;
  bridgeProvider: string;
  estimatedTime: number;
  fee: string;
  minReceived: string;
  gasEstimate: BigNumber;
  confidence: number;
  validUntil: number;
}

export interface BridgeTransaction {
  id: string;
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  amount: string;
  bridgeProvider: string;
  status: BridgeStatus;
  sourceTransactionHash: string;
  destinationTransactionHash?: string;
  createdAt: string;
  completedAt?: string;
  estimatedCompletionTime: number;
  progress: number;
  errorMessage?: string;
}

export type BridgeStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded' 
  | 'expired';

// DeFi Protocol Types
export interface DeFiProtocol {
  id: string;
  name: string;
  category: string;
  chainIds: number[];
  contractAddresses: Record<number, ProtocolContracts>;
  tokens: Record<number, string[]>;
  fees: ProtocolFees;
  risks: ProtocolRisks;
  metadata: ProtocolMetadata;
}

export interface ProtocolContracts {
  main: string;
  vault?: string;
  router?: string;
  factory?: string;
  multicall?: string;
  [key: string]: string | undefined;
}

export interface ProtocolFees {
  deposit: number; // basis points
  withdrawal: number;
  performance: number;
  management: number;
}

export interface ProtocolRisks {
  auditScore: number;
  riskScore: number;
  liquidityScore: number;
  volatilityScore: number;
  concentrationRisk: number;
}

export interface ProtocolMetadata {
  website: string;
  documentation: string;
  github?: string;
  twitter?: string;
  discord?: string;
  logoUrl: string;
  description: string;
  launchDate: string;
  totalValueLocked: string;
}

// Yield Farming Types
export interface YieldFarm {
  id: string;
  protocol: string;
  name: string;
  lpToken: string;
  rewardTokens: string[];
  apy: number;
  tvl: string;
  multiplier: number;
  startBlock: number;
  endBlock?: number;
  isActive: boolean;
  requiresStaking: boolean;
  lockupPeriod?: number; // in seconds
}

export interface LiquidityPosition {
  id: string;
  protocol: string;
  poolAddress: string;
  token0: Token;
  token1: Token;
  liquidity: string;
  amount0: string;
  amount1: string;
  lpTokenBalance: string;
  uncollectedFees0: string;
  uncollectedFees1: string;
  tickLower?: number;
  tickUpper?: number;
  currentPrice: string;
  priceRange?: {
    min: string;
    max: string;
  };
}

// Lending Protocol Types
export interface LendingPosition {
  id: string;
  protocol: string;
  asset: Token;
  supplied: string;
  borrowed: string;
  supplyAPY: number;
  borrowAPY: number;
  collateralFactor: number;
  liquidationThreshold: number;
  healthFactor: number;
  rewards?: {
    token: Token;
    amount: string;
    apy: number;
  }[];
}

export interface LendingMarket {
  asset: Token;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrow: string;
  utilizationRate: number;
  collateralFactor: number;
  liquidationThreshold: number;
  reserves: string;
  price: string;
}

// Block and Network State Types
export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  nonce: string;
  sha3Uncles: string;
  logsBloom: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: BigNumber;
  totalDifficulty: BigNumber;
  extraData: string;
  size: number;
  gasLimit: BigNumber;
  gasUsed: BigNumber;
  timestamp: number;
  transactions: string[] | TransactionResponse[];
  uncles: string[];
  baseFeePerGas?: BigNumber;
}

export interface NetworkStatus {
  chainId: number;
  blockNumber: number;
  gasPrice: string;
  baseFeePerGas?: string;
  networkCongestion: 'low' | 'medium' | 'high';
  lastUpdated: number;
}

// Error Types
export interface Web3Error {
  code: number;
  message: string;
  data?: any;
  stack?: string;
}

export interface TransactionError extends Web3Error {
  transactionHash?: string;
  receipt?: TransactionReceipt;
  transaction?: TransactionResponse;
  reason?: string;
}

// Utility Types
export type HexString = `0x${string}`;
export type Address = HexString;
export type Hash = HexString;
export type Bytes = HexString;
export type BigNumberish = BigNumber | string | number;

// Type Guards
export const isAddress = (value: any): value is Address => {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
};

export const isTransactionHash = (value: any): value is Hash => {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value);
};

export const isHexString = (value: any, length?: number): value is HexString => {
  if (typeof value !== 'string' || !value.startsWith('0x')) {
    return false;
  }
  if (length) {
    return value.length === 2 + length * 2;
  }
  return /^0x[a-fA-F0-9]*$/.test(value);
};

// MetaMask SDK Specific Types
export interface MetaMaskSDKOptions {
  dappMetadata: {
    name: string;
    url: string;
    iconUrl?: string;
  };
  infuraAPIKey?: string;
  readonlyRPCMap?: Record<string, string>;
  logging?: {
    developerMode?: boolean;
    sdk?: boolean;
  };
  checkInstallationImmediately?: boolean;
  useDeeplink?: boolean;
  preferDesktop?: boolean;
  storage?: {
    enabled?: boolean;
    storageManager?: any;
  };
  i18nOptions?: {
    enabled?: boolean;
  };
}

export interface SDKProvider {
  isMetaMask: boolean;
  isConnected(): boolean;
  getChainId(): string;
  getSelectedAddress(): string | null;
  request<T = any>(args: RequestArguments): Promise<T>;
  on(event: string, listener: (...args: any[]) => void): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
  disconnect(): Promise<void>;
  terminate(): void;
}
