// FlowBridge Frontend - AI Insights API
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

interface AIInsight {
  id: string;
  portfolioId: string;
  insightType: 'yield_optimization' | 'risk_alert' | 'rebalance_suggestion' | 'market_trend' | 'protocol_analysis';
  priority: 'critical' | 'high' | 'medium' | 'low';
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
  metadata: Record<string, any>;
}

interface InsightsResponse {
  success: boolean;
  data?: AIInsight[];
  error?: string;
}

interface GenerateInsightsRequest {
  portfolioId: string;
  forceRefresh?: boolean;
  insightTypes?: string[];
  minConfidence?: number;
}

// Mock portfolio data for insight generation
interface PortfolioData {
  totalValue: number;
  allocations: Record<string, number>;
  performance: {
    dailyReturn: number;
    weeklyReturn: number;
    monthlyReturn: number;
    volatility: number;
  };
  riskScore: number;
  lastRebalance: string;
}

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

// AI insight generation algorithms
function generateYieldOptimizationInsights(portfolioData: PortfolioData): AIInsight[] {
  const insights: AIInsight[] = [];
  
  // Check for underperforming allocations
  if (portfolioData.performance.monthlyReturn < 0.5) {
    insights.push({
      id: `insight_yield_${Date.now()}`,
      portfolioId: portfolioData.toString(),
      insightType: 'yield_optimization',
      priority: 'high',
      title: 'Low Yield Performance Detected',
      description: 'Your portfolio is underperforming compared to market averages. Current monthly return is below optimal threshold.',
      recommendation: 'Consider reallocating to higher-yield protocols like Convex Finance or optimized Curve strategies.',
      actionRequired: true,
      isActionable: true,
      isImplemented: false,
      confidenceScore: 0.85,
      modelName: 'YieldOptimizer',
      modelVersion: '2.1.0',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        currentReturn: portfolioData.performance.monthlyReturn,
        benchmarkReturn: 0.8,
        suggestedProtocols: ['convex_finance', 'curve_finance'],
      },
    });
  }

  // Check allocation efficiency
  const allocationCount = Object.keys(portfolioData.allocations).length;
  if (allocationCount > 6) {
    insights.push({
      id: `insight_allocation_${Date.now()}`,
      portfolioId: portfolioData.toString(),
      insightType: 'yield_optimization',
      priority: 'medium',
      title: 'Over-Diversification Detected',
      description: 'Your portfolio has too many small allocations which may reduce overall efficiency and increase gas costs.',
      recommendation: 'Consolidate into 3-5 main positions for better capital efficiency.',
      actionRequired: false,
      isActionable: true,
      isImplemented: false,
      confidenceScore: 0.75,
      modelName: 'AllocationOptimizer',
      modelVersion: '1.8.3',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      metadata: {
        currentAllocations: allocationCount,
        recommendedAllocations: 4,
        potentialGasSavings: '15%',
      },
    });
  }

  return insights;
}

function generateRiskAlerts(portfolioData: PortfolioData): AIInsight[] {
  const insights: AIInsight[] = [];

  // High volatility alert
  if (portfolioData.performance.volatility > 20) {
    insights.push({
      id: `insight_risk_${Date.now()}`,
      portfolioId: portfolioData.toString(),
      insightType: 'risk_alert',
      priority: 'critical',
      title: 'High Portfolio Volatility Alert',
      description: 'Your portfolio volatility is significantly above safe thresholds, indicating elevated risk exposure.',
      recommendation: 'Reduce exposure to high-risk protocols and increase allocation to stable yield sources.',
      actionRequired: true,
      isActionable: true,
      isImplemented: false,
      confidenceScore: 0.92,
      modelName: 'RiskAnalyzer',
      modelVersion: '3.2.1',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      metadata: {
        currentVolatility: portfolioData.performance.volatility,
        safeThreshold: 15,
        riskScore: portfolioData.riskScore,
      },
    });
  }

  // Concentration risk
  const maxAllocation = Math.max(...Object.values(portfolioData.allocations));
  if (maxAllocation > 60) {
    insights.push({
      id: `insight_concentration_${Date.now()}`,
      portfolioId: portfolioData.toString(),
      insightType: 'risk_alert',
      priority: 'high',
      title: 'Concentration Risk Warning',
      description: 'Your portfolio has excessive concentration in a single protocol, creating significant risk exposure.',
      recommendation: 'Diversify holdings across multiple protocols to reduce concentration risk.',
      actionRequired: true,
      isActionable: true,
      isImplemented: false,
      confidenceScore: 0.88,
      modelName: 'RiskAnalyzer',
      modelVersion: '3.2.1',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        maxAllocation,
        recommendedMax: 40,
        affectedProtocol: Object.keys(portfolioData.allocations)[0],
      },
    });
  }

  return insights;
}

function generateRebalanceInsights(portfolioData: PortfolioData): AIInsight[] {
  const insights: AIInsight[] = [];

  // Time-based rebalancing
  const daysSinceRebalance = Math.floor(
    (Date.now() - new Date(portfolioData.lastRebalance).getTime()) / (24 * 60 * 60 * 1000)
  );

  if (daysSinceRebalance > 30) {
    insights.push({
      id: `insight_rebalance_${Date.now()}`,
      portfolioId: portfolioData.toString(),
      insightType: 'rebalance_suggestion',
      priority: 'medium',
      title: 'Rebalancing Opportunity',
      description: 'Your portfolio hasn\'t been rebalanced recently. Market conditions may have created optimization opportunities.',
      recommendation: 'Run portfolio optimization to identify potential yield improvements.',
      actionRequired: false,
      isActionable: true,
      isImplemented: false,
      confidenceScore: 0.72,
      modelName: 'RebalanceAdvisor',
      modelVersion: '2.5.0',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        daysSinceRebalance,
        recommendedFrequency: 21,
        potentialImprovement: '0.3%',
      },
    });
  }

  return insights;
}

function generateMarketInsights(portfolioData: PortfolioData): AIInsight[] {
  const insights: AIInsight[] = [];

  // Market trend analysis (simplified)
  if (portfolioData.performance.weeklyReturn < -2) {
    insights.push({
      id: `insight_market_${Date.now()}`,
      portfolioId: portfolioData.toString(),
      insightType: 'market_trend',
      priority: 'medium',
      title: 'Market Downturn Impact',
      description: 'Recent market volatility has negatively impacted your portfolio performance.',
      recommendation: 'Consider defensive positioning with increased stablecoin allocations during market uncertainty.',
      actionRequired: false,
      isActionable: true,
      isImplemented: false,
      confidenceScore: 0.68,
      modelName: 'MarketAnalyzer',
      modelVersion: '1.9.2',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        weeklyReturn: portfolioData.performance.weeklyReturn,
        marketSentiment: 'bearish',
        suggestedDefensiveAllocation: 30,
      },
    });
  }

  return insights;
}

// Generate comprehensive insights for a portfolio
function generateInsights(
  portfolioData: PortfolioData,
  insightTypes?: string[],
  minConfidence: number = 0.6
): AIInsight[] {
  let allInsights: AIInsight[] = [];

  // Generate different types of insights
  if (!insightTypes || insightTypes.includes('yield_optimization')) {
    allInsights.push(...generateYieldOptimizationInsights(portfolioData));
  }

  if (!insightTypes || insightTypes.includes('risk_alert')) {
    allInsights.push(...generateRiskAlerts(portfolioData));
  }

  if (!insightTypes || insightTypes.includes('rebalance_suggestion')) {
    allInsights.push(...generateRebalanceInsights(portfolioData));
  }

  if (!insightTypes || insightTypes.includes('market_trend')) {
    allInsights.push(...generateMarketInsights(portfolioData));
  }

  // Filter by confidence score
  return allInsights.filter(insight => insight.confidenceScore >= minConfidence);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InsightsResponse | { success: boolean; error?: string }>
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
      // Get existing insights
      const { portfolioId, priority, implemented } = req.query;

      if (!portfolioId || typeof portfolioId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Portfolio ID required'
        });
      }

      // Mock portfolio data
      const portfolioData: PortfolioData = {
        totalValue: 25000,
        allocations: {
          'aave_v3': 45,
          'compound_v3': 30,
          'uniswap_v3': 25,
        },
        performance: {
          dailyReturn: 0.05,
          weeklyReturn: -1.2,
          monthlyReturn: 2.8,
          volatility: 12.5,
        },
        riskScore: 42,
        lastRebalance: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Generate insights
      let insights = generateInsights(portfolioData);

      // Apply filters
      if (priority && typeof priority === 'string') {
        insights = insights.filter(insight => insight.priority === priority);
      }

      if (implemented === 'true') {
        insights = insights.filter(insight => insight.isImplemented);
      } else if (implemented === 'false') {
        insights = insights.filter(insight => !insight.isImplemented);
      }

      return res.status(200).json({
        success: true,
        data: insights
      });
    }

    if (req.method === 'POST') {
      // Generate new insights
      const {
        portfolioId,
        forceRefresh = false,
        insightTypes,
        minConfidence = 0.6
      }: GenerateInsightsRequest = req.body;

      if (!portfolioId) {
        return res.status(400).json({
          success: false,
          error: 'Portfolio ID required'
        });
      }

      // Mock portfolio data (would fetch from database in production)
      const portfolioData: PortfolioData = {
        totalValue: 25000,
        allocations: {
          'aave_v3': 45,
          'compound_v3': 30,
          'uniswap_v3': 25,
        },
        performance: {
          dailyReturn: 0.05,
          weeklyReturn: -1.2,
          monthlyReturn: 2.8,
          volatility: 12.5,
        },
        riskScore: 42,
        lastRebalance: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Generate fresh insights
      const insights = generateInsights(portfolioData, insightTypes, minConfidence);

      return res.status(200).json({
        success: true,
        data: insights
      });
    }

    if (req.method === 'PUT') {
      // Update insight (mark as implemented, etc.)
      const { insightId } = req.query;
      const { isImplemented, actionTaken } = req.body;

      if (!insightId || typeof insightId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Insight ID required'
        });
      }

      // In production, update the insight in the database
      // For now, just return success
      return res.status(200).json({
        success: true
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('AI Insights error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
