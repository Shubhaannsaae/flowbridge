// FlowBridge Frontend - Application Constants

// Supported blockchain networks
export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  LINEA: 59144,
} as const;

// RPC URLs for each chain
export const RPC_URLS: Record<number, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || `https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`,
  [SUPPORTED_CHAINS.POLYGON]: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || `https://polygon-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`,
  [SUPPORTED_CHAINS.ARBITRUM]: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || `https://arbitrum-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`,
  [SUPPORTED_CHAINS.OPTIMISM]: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL || `https://optimism-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`,
  [SUPPORTED_CHAINS.BASE]: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  [SUPPORTED_CHAINS.LINEA]: process.env.NEXT_PUBLIC_LINEA_RPC_URL || 'https://rpc.linea.build',
};

// Chain configurations
export const CHAIN_CONFIG: Record<number, {
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorerUrl: string;
  logoUrl?: string;
}> = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    name: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: RPC_URLS[SUPPORTED_CHAINS.ETHEREUM],
    blockExplorerUrl: 'https://etherscan.io',
    logoUrl: '/images/chains/ethereum.svg',
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    name: 'Polygon',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrl: RPC_URLS[SUPPORTED_CHAINS.POLYGON],
    blockExplorerUrl: 'https://polygonscan.com',
    logoUrl: '/images/chains/polygon.svg',
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    name: 'Arbitrum One',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: RPC_URLS[SUPPORTED_CHAINS.ARBITRUM],
    blockExplorerUrl: 'https://arbiscan.io',
    logoUrl: '/images/chains/arbitrum.svg',
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    name: 'Optimism',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: RPC_URLS[SUPPORTED_CHAINS.OPTIMISM],
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    logoUrl: '/images/chains/optimism.svg',
  },
  [SUPPORTED_CHAINS.BASE]: {
    name: 'Base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: RPC_URLS[SUPPORTED_CHAINS.BASE],
    blockExplorerUrl: 'https://basescan.org',
    logoUrl: '/images/chains/base.svg',
  },
  [SUPPORTED_CHAINS.LINEA]: {
    name: 'Linea',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: RPC_URLS[SUPPORTED_CHAINS.LINEA],
    blockExplorerUrl: 'https://lineascan.build',
    logoUrl: '/images/chains/linea.svg',
  },
};

// Standard ERC-20 ABI
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
  'event Transfer(address indexed,address indexed,uint256)',
  'event Approval(address indexed,address indexed,uint256)',
];

// Risk tolerance levels
export const RISK_LEVELS = {
  VERY_CONSERVATIVE: { value: 1, label: 'Very Conservative', color: '#10b981' },
  CONSERVATIVE: { value: 2, label: 'Conservative', color: '#059669' },
  MODERATE_CONSERVATIVE: { value: 3, label: 'Moderate Conservative', color: '#34d399' },
  MODERATE: { value: 4, label: 'Moderate', color: '#fbbf24' },
  MODERATE_AGGRESSIVE: { value: 5, label: 'Moderate Aggressive', color: '#f59e0b' },
  AGGRESSIVE: { value: 6, label: 'Aggressive', color: '#ea580c' },
  VERY_AGGRESSIVE: { value: 7, label: 'Very Aggressive', color: '#dc2626' },
} as const;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  PORTFOLIO: '/api/portfolio',
  YIELDS: '/api/portfolio/yields',
  REBALANCE: '/api/portfolio/rebalance',
  AI_OPTIMIZE: '/api/ai/optimize',
  AI_INSIGHTS: '/api/ai/insights',
  BALANCE: '/api/portfolio/balance',
} as const;

// Application configuration
export const APP_CONFIG = {
  NAME: 'FlowBridge',
  DESCRIPTION: 'Next-Generation DeFi Platform',
  VERSION: '1.0.0',
  AUTHOR: 'FlowBridge Team',
  WEBSITE: 'https://flowbridge.app',
  SUPPORT_EMAIL: 'support@flowbridge.app',
  SOCIAL: {
    TWITTER: 'https://twitter.com/flowbridge',
    DISCORD: 'https://discord.gg/flowbridge',
    GITHUB: 'https://github.com/flowbridge',
  },
} as const;

// Transaction settings
export const TRANSACTION_SETTINGS = {
  DEFAULT_GAS_LIMIT: '21000',
  DEFAULT_GAS_PRICE: '20', // Gwei
  MAX_GAS_PRICE: '500', // Gwei
  CONFIRMATION_BLOCKS: 1,
  TIMEOUT_SECONDS: 300, // 5 minutes
  RETRY_ATTEMPTS: 3,
} as const;

// DeFi protocol categories
export const PROTOCOL_CATEGORIES = {
  LENDING: 'lending',
  DEX: 'dex',
  YIELD_FARMING: 'yield_farming',
  LIQUIDITY_MINING: 'liquidity_mining',
  DERIVATIVES: 'derivatives',
  INSURANCE: 'insurance',
  STAKING: 'staking',
} as const;

// Common token addresses
export const TOKEN_ADDRESSES = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    USDC: '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    WETH: '0x4200000000000000000000000000000000000006',
    OP: '0x4200000000000000000000000000000000000042',
  },
  [SUPPORTED_CHAINS.BASE]: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  [SUPPORTED_CHAINS.LINEA]: {
    USDC: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    WETH: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
  },
} as const;

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_AI_OPTIMIZATION: true,
  ENABLE_CROSS_CHAIN: true,
  ENABLE_CARD_INTEGRATION: true,
  ENABLE_ANALYTICS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_DARK_MODE: true,
  ENABLE_TESTNET: process.env.NODE_ENV === 'development',
} as const;

// Time constants
export const TIME_CONSTANTS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

// UI constants
export const UI_CONSTANTS = {
  HEADER_HEIGHT: '64px',
  SIDEBAR_WIDTH: '256px',
  SIDEBAR_COLLAPSED_WIDTH: '64px',
  MAX_CONTENT_WIDTH: '1200px',
  MOBILE_BREAKPOINT: '768px',
} as const;

// Validation constants
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 20,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ETHEREUM_ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH_REGEX: /^0x[a-fA-F0-9]{64}$/,
} as const;

// Performance constants
export const PERFORMANCE = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 1000,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  REFRESH_INTERVAL: 30 * 1000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Wallet not connected',
  UNSUPPORTED_NETWORK: 'Unsupported network',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  TRANSACTION_FAILED: 'Transaction failed',
  INVALID_ADDRESS: 'Invalid address',
  INVALID_AMOUNT: 'Invalid amount',
  CONNECTION_ERROR: 'Connection error',
  UNAUTHORIZED: 'Unauthorized access',
  SERVER_ERROR: 'Server error',
  UNKNOWN_ERROR: 'Unknown error occurred',
} as const;
