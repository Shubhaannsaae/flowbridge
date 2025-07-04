// FlowBridge Frontend - Yield Strategies API
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { isValidAddress } from '../../../utils/web3';

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

interface YieldsResponse {
  success: boolean;
  data?: YieldStrategy[];
  error?: string;
}

interface CreateStrategyRequest {
  portfolioId: string;
  protocolId: string;
  strategyName: string;
  strategyType: YieldStrategy['strategyType'];
  tokenAddress: string;
  tokenSymbol: string;
  chainId: number;
  allocationPercentage: number;
  deployedAmount: string;
  currentApy: string;
  riskScore: number;
}

// Mock data for yield strategies (would be from database in production)
const mockStrategies: YieldStrategy[] = [
  {
    id: 'strategy_1',
    portfolioId: 'portfolio_1',
    strategyName: 'Aave USDC Lending',
    protocolName: 'Aave',
    protocolId: 'aave_v3',
    tokenAddress: '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    tokenSymbol: 'USDC',
    chainId: 1,
    chainName: 'Ethereum',
    strategyType: 'lending',
    deployedAmount: '10000.00',
    currentValue: '10250.50',
    yieldEarned: '250.50',
    currentApy: '5.25',
    expectedApy: '5.50',
    riskScore: 25,
    allocationPercentage: '40.0',
    isActive: true,
    isAutoRebalanceEnabled: true,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastRebalancedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'lending',
  },
  {
    id: 'strategy_2',
    portfolioId: 'portfolio_1',
    strategyName: 'Compound ETH Vault',
    protocolName: 'Compound',
    protocolId: 'compound_v3',
    tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    tokenSymbol: 'WETH',
    chainId: 1,
    chainName: 'Ethereum',
    strategyType: 'vault',
    deployedAmount: '5.0',
    currentValue: '5.125',
    yieldEarned: '0.125',
    currentApy: '4.80',
    expectedApy: '5.00',
    riskScore: 30,
    allocationPercentage: '35.0',
    isActive: true,
    isAutoRebalanceEnabled: false,
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'vault',
  },
  {
    id: 'strategy_3',
    portfolioId: 'portfolio_1',
    strategyName: 'Uniswap V3 USDC/ETH LP',
    protocolName: 'Uniswap V3',
    protocolId: 'uniswap_v3',
    tokenAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    tokenSymbol: 'UNI-V3',
    chainId: 1,
    chainName: 'Ethereum',
    strategyType: 'lp_token',
    deployedAmount: '7500.00',
    currentValue: '7650.25',
    yieldEarned: '150.25',
    currentApy: '8.50',
    expectedApy: '9.00',
    riskScore: 55,
    allocationPercentage: '25.0',
    isActive: true,
    isAutoRebalanceEnabled: true,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'dex',
  },
];

// Verify JWT token
function verifyToken(authorization: string | undefined): { address: string; chainId: number } | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authorization.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    return { address: decoded.address, chainId: decoded.chainId };
  } catch (error) {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<YieldsResponse | { success: boolean; id?: string; error?: string }>
) {
  try {
    // Verify authentication
    const auth = verifyToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (req.method === 'GET') {
      // Get yield strategies
      const { portfolioId, active } = req.query;
      
      let strategies = mockStrategies;
      
      // Filter by portfolio ID if provided
      if (portfolioId && typeof portfolioId === 'string') {
        strategies = strategies.filter(s => s.portfolioId === portfolioId);
      }
      
      // Filter by active status if provided
      if (active === 'true') {
        strategies = strategies.filter(s => s.isActive);
      } else if (active === 'false') {
        strategies = strategies.filter(s => !s.isActive);
      }
      
      return res.status(200).json({
        success: true,
        data: strategies
      });
    }
    
    if (req.method === 'POST') {
      // Create new yield strategy
      const strategyData: CreateStrategyRequest = req.body;
      
      // Validate required fields
      const requiredFields = [
        'portfolioId', 'protocolId', 'strategyName', 'strategyType',
        'tokenAddress', 'tokenSymbol', 'chainId', 'allocationPercentage',
        'deployedAmount', 'currentApy', 'riskScore'
      ];
      
      for (const field of requiredFields) {
        if (!strategyData[field as keyof CreateStrategyRequest]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }
      
      // Validate token address
      if (!isValidAddress(strategyData.tokenAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid token address'
        });
      }
      
      // Validate allocation percentage
      if (strategyData.allocationPercentage < 0 || strategyData.allocationPercentage > 100) {
        return res.status(400).json({
          success: false,
          error: 'Allocation percentage must be between 0 and 100'
        });
      }
      
      // Create new strategy
      const newStrategy: YieldStrategy = {
        id: `strategy_${Date.now()}`,
        portfolioId: strategyData.portfolioId,
        strategyName: strategyData.strategyName,
        protocolName: strategyData.protocolId, // Would map from protocol ID in production
        protocolId: strategyData.protocolId,
        tokenAddress: strategyData.tokenAddress,
        tokenSymbol: strategyData.tokenSymbol,
        chainId: strategyData.chainId,
        chainName: strategyData.chainId === 1 ? 'Ethereum' : 'Unknown', // Would map properly
        strategyType: strategyData.strategyType,
        deployedAmount: strategyData.deployedAmount,
        currentValue: strategyData.deployedAmount, // Initially same as deployed
        yieldEarned: '0',
        currentApy: strategyData.currentApy,
        expectedApy: strategyData.currentApy,
        riskScore: strategyData.riskScore,
        allocationPercentage: strategyData.allocationPercentage.toString(),
        isActive: true,
        isAutoRebalanceEnabled: false,
        createdAt: new Date().toISOString(),
        category: strategyData.strategyType,
      };
      
      // In production, save to database
      mockStrategies.push(newStrategy);
      
      return res.status(201).json({
        success: true,
        id: newStrategy.id
      });
    }
    
    if (req.method === 'PUT') {
      // Update yield strategy
      const { strategyId } = req.query;
      const updateData = req.body;
      
      if (!strategyId || typeof strategyId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID required'
        });
      }
      
      const strategyIndex = mockStrategies.findIndex(s => s.id === strategyId);
      if (strategyIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found'
        });
      }
      
      // Update strategy
      mockStrategies[strategyIndex] = {
        ...mockStrategies[strategyIndex],
        ...updateData,
      };
      
      return res.status(200).json({
        success: true
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete/deactivate yield strategy
      const { strategyId } = req.query;
      
      if (!strategyId || typeof strategyId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Strategy ID required'
        });
      }
      
      const strategyIndex = mockStrategies.findIndex(s => s.id === strategyId);
      if (strategyIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Strategy not found'
        });
      }
      
      // Mark as inactive instead of deleting
      mockStrategies[strategyIndex].isActive = false;
      
      return res.status(200).json({
        success: true
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Yields API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
