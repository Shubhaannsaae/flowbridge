// FlowBridge Frontend - AI Portfolio Optimization API
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

interface OptimizationRequest {
  portfolioId: string;
  totalAmount: string;
  userRiskTolerance: number;
  timeHorizon?: 'short' | 'medium' | 'long';
  forceRebalance?: boolean;
  excludeProtocols?: string[];
  includeOnlyCategories?: string[];
}

interface OptimizationStrategy {
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

interface OptimizationResponse {
  success: boolean;
  data?: {
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
  };
  error?: string;
}

// Available DeFi protocols with their characteristics
const AVAILABLE_PROTOCOLS = [
  {
    id: 'aave_v3',
    name: 'Aave V3',
    category: 'lending',
    baseAPY: 4.5,
    riskScore: 25,
    liquidityScore: 95,
    supportedTokens: ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC'],
    chainIds: [1, 137, 42161, 10],
  },
  {
    id: 'compound_v3',
    name: 'Compound V3',
    category: 'lending',
    baseAPY: 4.2,
    riskScore: 30,
    liquidityScore: 90,
    supportedTokens: ['USDC', 'WETH'],
    chainIds: [1, 137, 42161],
  },
  {
    id: 'uniswap_v3',
    name: 'Uniswap V3',
    category: 'dex',
    baseAPY: 8.5,
    riskScore: 55,
    liquidityScore: 85,
    supportedTokens: ['UNI-V3'],
    chainIds: [1, 137, 42161, 10],
  },
  {
    id: 'curve_finance',
    name: 'Curve Finance',
    category: 'dex',
    baseAPY: 6.8,
    riskScore: 40,
    liquidityScore: 80,
    supportedTokens: ['CRV', '3CRV', 'FRAX'],
    chainIds: [1, 137, 42161],
  },
  {
    id: 'yearn_v3',
    name: 'Yearn V3',
    category: 'yield_farming',
    baseAPY: 7.2,
    riskScore: 45,
    liquidityScore: 75,
    supportedTokens: ['USDC', 'DAI', 'WETH'],
    chainIds: [1, 137],
  },
  {
    id: 'convex_finance',
    name: 'Convex Finance',
    category: 'yield_farming',
    baseAPY: 9.1,
    riskScore: 60,
    liquidityScore: 70,
    supportedTokens: ['CVX', 'CRV'],
    chainIds: [1],
  },
];

// Risk tolerance to allocation strategy mapping
const RISK_ALLOCATION_STRATEGIES = {
  conservative: { // 1-3
    maxSingleAllocation: 30,
    maxHighRiskAllocation: 20,
    preferredCategories: ['lending'],
    maxRiskScore: 40,
  },
  moderate: { // 4-6
    maxSingleAllocation: 40,
    maxHighRiskAllocation: 40,
    preferredCategories: ['lending', 'dex'],
    maxRiskScore: 60,
  },
  aggressive: { // 7-10
    maxSingleAllocation: 60,
    maxHighRiskAllocation: 80,
    preferredCategories: ['lending', 'dex', 'yield_farming'],
    maxRiskScore: 100,
  },
};

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

// AI optimization algorithm
function optimizePortfolio(
  totalAmount: number,
  riskTolerance: number,
  timeHorizon: string = 'medium',
  excludeProtocols: string[] = [],
  includeOnlyCategories?: string[]
): {
  strategies: OptimizationStrategy[];
  expectedAPY: number;
  expectedRisk: number;
  diversificationScore: number;
  reasoning: string;
} {
  // Determine risk profile
  const riskProfile = riskTolerance <= 3 ? 'conservative' : 
                     riskTolerance <= 6 ? 'moderate' : 'aggressive';
  
  const strategy = RISK_ALLOCATION_STRATEGIES[riskProfile];
  
  // Filter available protocols
  let availableProtocols = AVAILABLE_PROTOCOLS.filter(protocol => {
    if (excludeProtocols.includes(protocol.id)) return false;
    if (includeOnlyCategories && !includeOnlyCategories.includes(protocol.category)) return false;
    if (protocol.riskScore > strategy.maxRiskScore) return false;
    return true;
  });

  // Sort by risk-adjusted return (APY / risk score)
  availableProtocols.sort((a, b) => {
    const aRiskAdjusted = a.baseAPY / Math.max(a.riskScore, 10);
    const bRiskAdjusted = b.baseAPY / Math.max(b.riskScore, 10);
    return bRiskAdjusted - aRiskAdjusted;
  });

  // Generate allocation
  const strategies: OptimizationStrategy[] = [];
  let remainingAllocation = 100;
  let totalExpectedAPY = 0;
  let totalRisk = 0;

  // Primary allocation (largest position)
  if (availableProtocols.length > 0) {
    const primaryProtocol = availableProtocols[0];
    const primaryAllocation = Math.min(strategy.maxSingleAllocation, remainingAllocation);
    
    strategies.push({
      protocolId: primaryProtocol.id,
      protocolName: primaryProtocol.name,
      tokenSymbol: primaryProtocol.supportedTokens[0],
      allocationPercentage: primaryAllocation,
      expectedAPY: primaryProtocol.baseAPY,
      riskScore: primaryProtocol.riskScore,
      liquidityScore: primaryProtocol.liquidityScore,
      confidence: 0.9,
      reasoning: `Highest risk-adjusted return in ${primaryProtocol.category} category`,
    });

    remainingAllocation -= primaryAllocation;
    totalExpectedAPY += primaryProtocol.baseAPY * (primaryAllocation / 100);
    totalRisk += primaryProtocol.riskScore * (primaryAllocation / 100);
  }

  // Secondary allocations for diversification
  for (let i = 1; i < Math.min(availableProtocols.length, 4) && remainingAllocation > 0; i++) {
    const protocol = availableProtocols[i];
    const maxAllocation = Math.min(25, remainingAllocation);
    const allocation = Math.min(maxAllocation, remainingAllocation / (availableProtocols.length - i));
    
    if (allocation >= 5) { // Minimum 5% allocation
      strategies.push({
        protocolId: protocol.id,
        protocolName: protocol.name,
        tokenSymbol: protocol.supportedTokens[0],
        allocationPercentage: allocation,
        expectedAPY: protocol.baseAPY,
        riskScore: protocol.riskScore,
        liquidityScore: protocol.liquidityScore,
        confidence: 0.8 - (i * 0.1),
        reasoning: `Diversification across ${protocol.category} with good risk-return profile`,
      });

      remainingAllocation -= allocation;
      totalExpectedAPY += protocol.baseAPY * (allocation / 100);
      totalRisk += protocol.riskScore * (allocation / 100);
    }
  }

  // Calculate diversification score
  const categoryCount = new Set(strategies.map(s => 
    AVAILABLE_PROTOCOLS.find(p => p.id === s.protocolId)?.category
  )).size;
  const diversificationScore = Math.min(100, (categoryCount * 25) + (strategies.length * 10));

  // Generate reasoning
  const reasoning = `Optimized for ${riskProfile} risk profile with ${timeHorizon} time horizon. ` +
    `Allocated across ${strategies.length} protocols in ${categoryCount} categories. ` +
    `Expected return: ${totalExpectedAPY.toFixed(2)}% with risk score: ${totalRisk.toFixed(1)}.`;

  return {
    strategies,
    expectedAPY: totalExpectedAPY,
    expectedRisk: totalRisk,
    diversificationScore,
    reasoning,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OptimizationResponse>
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

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    const {
      portfolioId,
      totalAmount,
      userRiskTolerance,
      timeHorizon = 'medium',
      forceRebalance = false,
      excludeProtocols = [],
      includeOnlyCategories
    }: OptimizationRequest = req.body;

    // Validate required fields
    if (!portfolioId || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: portfolioId, totalAmount'
      });
    }

    // Validate risk tolerance
    if (userRiskTolerance < 1 || userRiskTolerance > 10) {
      return res.status(400).json({
        success: false,
        error: 'Risk tolerance must be between 1 and 10'
      });
    }

    // Validate total amount
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid total amount'
      });
    }

    // Get current allocation (mock data)
    const currentAllocation: Record<string, number> = {
      'aave_v3': 40,
      'compound_v3': 35,
      'uniswap_v3': 25,
    };

    // Run AI optimization
    const optimization = optimizePortfolio(
      amount,
      userRiskTolerance,
      timeHorizon,
      excludeProtocols,
      includeOnlyCategories
    );

    // Generate recommended allocation
    const recommendedAllocation: Record<string, number> = {};
    optimization.strategies.forEach(strategy => {
      recommendedAllocation[strategy.protocolId] = strategy.allocationPercentage;
    });

    // Calculate confidence score
    const avgConfidence = optimization.strategies.reduce((sum, s) => sum + s.confidence, 0) / optimization.strategies.length;
    const confidenceScore = Math.round(avgConfidence * 100);

    // Estimate gas costs and complexity
    const changeCount = Object.keys({...currentAllocation, ...recommendedAllocation}).length;
    const gasCostEstimate = (changeCount * 0.005 * 2500).toFixed(2); // Mock calculation
    const implementationComplexity = changeCount <= 2 ? 'low' : changeCount <= 4 ? 'medium' : 'high';

    // Create optimization result
    const optimizationId = `opt_${Date.now()}`;
    const result = {
      optimizationId,
      portfolioId,
      currentAllocation,
      recommendedAllocation,
      strategies: optimization.strategies,
      expectedAPY: optimization.expectedAPY.toFixed(2),
      expectedRisk: Math.round(optimization.expectedRisk),
      diversificationScore: optimization.diversificationScore,
      confidenceScore,
      gasCostEstimate,
      implementationComplexity,
      reasoning: optimization.reasoning,
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('AI Optimization error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
