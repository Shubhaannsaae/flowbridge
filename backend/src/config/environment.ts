import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
  
  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_NAME_TEST?: string;
  DB_SSL: boolean;
  
  // Security
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  CORS_ORIGIN: string[];
  
  // Blockchain RPCs
  ETHEREUM_RPC_URL: string;
  POLYGON_RPC_URL: string;
  ARBITRUM_RPC_URL: string;
  OPTIMISM_RPC_URL: string;
  BASE_RPC_URL: string;
  AVALANCHE_RPC_URL: string;
  
  // WebSocket URLs (optional)
  ETHEREUM_WS_URL?: string;
  POLYGON_WS_URL?: string;
  ARBITRUM_WS_URL?: string;
  OPTIMISM_WS_URL?: string;
  BASE_WS_URL?: string;
  AVALANCHE_WS_URL?: string;
  
  // AI Services
  GEMINI_API_KEY: string;
  
  // External APIs
  COINGECKO_API_KEY?: string;
  DEFILLAMA_API_KEY?: string;
  
  // Application
  FRONTEND_URL: string;
  LOG_LEVEL: string;
  LOG_DIR: string;
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  
  // Features
  ENABLE_METRICS: boolean;
  ENABLE_SWAGGER: boolean;
  ENABLE_RATE_LIMITING: boolean;
}

function validateEnvironment(): EnvironmentConfig {
  const requiredVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'ETHEREUM_RPC_URL',
    'POLYGON_RPC_URL',
    'ARBITRUM_RPC_URL',
    'OPTIMISM_RPC_URL',
    'BASE_RPC_URL',
    'GEMINI_API_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validate URLs
  const urlVars = [
    'ETHEREUM_RPC_URL',
    'POLYGON_RPC_URL', 
    'ARBITRUM_RPC_URL',
    'OPTIMISM_RPC_URL',
    'BASE_RPC_URL'
  ];

  for (const urlVar of urlVars) {
    const url = process.env[urlVar];
    if (url && !isValidUrl(url)) {
      throw new Error(`Invalid URL format for ${urlVar}: ${url}`);
    }
  }

  return {
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    PORT: parseInt(process.env.PORT || '3001'),
    HOST: process.env.HOST || '0.0.0.0',
    
    // Database
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_NAME: process.env.DB_NAME!,
    DB_NAME_TEST: process.env.DB_NAME_TEST,
    DB_SSL: process.env.DB_SSL === 'true',
    
    // Security
    JWT_SECRET: process.env.JWT_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!,
    CORS_ORIGIN: process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3000'],
    
    // Blockchain RPCs
    ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL!,
    POLYGON_RPC_URL: process.env.POLYGON_RPC_URL!,
    ARBITRUM_RPC_URL: process.env.ARBITRUM_RPC_URL!,
    OPTIMISM_RPC_URL: process.env.OPTIMISM_RPC_URL!,
    BASE_RPC_URL: process.env.BASE_RPC_URL!,
    AVALANCHE_RPC_URL: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    
    // WebSocket URLs
    ETHEREUM_WS_URL: process.env.ETHEREUM_WS_URL,
    POLYGON_WS_URL: process.env.POLYGON_WS_URL,
    ARBITRUM_WS_URL: process.env.ARBITRUM_WS_URL,
    OPTIMISM_WS_URL: process.env.OPTIMISM_WS_URL,
    BASE_WS_URL: process.env.BASE_WS_URL,
    AVALANCHE_WS_URL: process.env.AVALANCHE_WS_URL,
    
    // AI Services
    GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
    
    // External APIs
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
    DEFILLAMA_API_KEY: process.env.DEFILLAMA_API_KEY,
    
    // Application
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_DIR: process.env.LOG_DIR || './logs',
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    
    // Features
    ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
    ENABLE_SWAGGER: process.env.ENABLE_SWAGGER !== 'false',
    ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false'
  };
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

function isTest(): boolean {
  return config.NODE_ENV === 'test';
}

// Validate and export configuration
export const config = validateEnvironment();

// Helper functions
export const env = {
  isDevelopment,
  isProduction,
  isTest,
  get: (key: keyof EnvironmentConfig) => config[key]
};

// Log configuration (excluding sensitive data)
const logConfig = {
  ...config,
  JWT_SECRET: '[REDACTED]',
  DB_PASSWORD: '[REDACTED]',
  ENCRYPTION_KEY: '[REDACTED]',
  GEMINI_API_KEY: '[REDACTED]',
  COINGECKO_API_KEY: config.COINGECKO_API_KEY ? '[REDACTED]' : undefined,
  DEFILLAMA_API_KEY: config.DEFILLAMA_API_KEY ? '[REDACTED]' : undefined
};

logger.info('Environment configuration loaded:', logConfig);

export default config;
