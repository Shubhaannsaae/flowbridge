import { Request, Response } from 'express';
import { YieldOptimizer } from '../services/ai/YieldOptimizer';
import { RiskAssessment } from '../services/ai/RiskAssessment';
import { PredictionEngine } from '../services/ai/PredictionEngine';
import { PortfolioAnalyzer } from '../services/ai/PortfolioAnalyzer';
import { Portfolio } from '../models/Portfolio';
import { AIInsight } from '../models/AIInsight';
import { logger } from '../utils/logger';

export class AIController {
  private yieldOptimizer: YieldOptimizer;
  private riskAssessment: RiskAssessment;
  private predictionEngine: PredictionEngine;
  private portfolioAnalyzer: PortfolioAnalyzer;

  constructor() {
    this.yieldOptimizer = new YieldOptimizer();
    this.riskAssessment = new RiskAssessment();
    this.predictionEngine = new PredictionEngine();
    this.portfolioAnalyzer = new PortfolioAnalyzer();
  }

  async optimize(req: Request, res: Response): Promise<Response> {
    try {
      const { portfolioId, forceRebalance = false } = req.body;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { id: portfolioId, userId }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const preferences = {
        riskLevel: portfolio.riskLevel,
        cardLiquidityReserve: parseFloat(portfolio.cardLiquidityReserve),
        minImprovementThreshold: forceRebalance ? 0 : 0.01
      };

      const optimization = await this.yieldOptimizer.optimizePortfolio(
        portfolio.walletAddress,
        preferences
      );

      // Store AI insight
      await AIInsight.create({
        portfolioId: portfolio.id,
        insightType: 'optimization',
        data: JSON.stringify(optimization),
        confidence: optimization.confidence || 0.8,
        createdAt: new Date()
      });

      return res.json({
        success: true,
        optimization: {
          status: optimization.status,
          expectedImprovement: optimization.expectedImprovement,
          recommendedStrategies: optimization.strategy,
          confidence: optimization.confidence,
          reasoning: optimization.reasoning,
          estimatedGasCost: optimization.estimatedGasCost,
          timeToExecute: optimization.timeToExecute
        }
      });

    } catch (error) {
      logger.error('AI optimization error:', error);
      return res.status(500).json({ error: 'AI optimization failed' });
    }
  }

  async analyzeRisk(req: Request, res: Response): Promise<Response> {
    try {
      const { portfolioId } = req.params;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { id: portfolioId, userId }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const riskAnalysis = await this.riskAssessment.analyzePortfolioRisk(portfolio.id);

      // Store risk insight
      await AIInsight.create({
        portfolioId: portfolio.id,
        insightType: 'risk_analysis',
        data: JSON.stringify(riskAnalysis),
        confidence: riskAnalysis.confidence,
        createdAt: new Date()
      });

      return res.json({
        success: true,
        riskAnalysis: {
          overallRiskScore: riskAnalysis.overallRiskScore,
          riskLevel: riskAnalysis.riskLevel,
          vulnerabilities: riskAnalysis.vulnerabilities,
          recommendations: riskAnalysis.recommendations,
          diversificationScore: riskAnalysis.diversificationScore,
          protocolRisks: riskAnalysis.protocolRisks,
          marketRisk: riskAnalysis.marketRisk,
          confidence: riskAnalysis.confidence
        }
      });

    } catch (error) {
      logger.error('Risk analysis error:', error);
      return res.status(500).json({ error: 'Risk analysis failed' });
    }
  }

  async predict(req: Request, res: Response): Promise<Response> {
    try {
      const { protocol, timeframe = 7 } = req.body;

      if (!protocol) {
        return res.status(400).json({ error: 'Protocol is required' });
      }

      const prediction = await this.predictionEngine.predictYield(protocol, timeframe);

      return res.json({
        success: true,
        prediction: {
          protocol,
          timeframe: `${timeframe} days`,
          currentAPY: prediction.currentAPY,
          predictedAPY: prediction.predictedAPY,
          confidence: prediction.confidence,
          trend: prediction.trend,
          factors: prediction.factors,
          riskFactors: prediction.riskFactors,
          lastUpdated: prediction.lastUpdated
        }
      });

    } catch (error) {
      logger.error('Yield prediction error:', error);
      return res.status(500).json({ error: 'Yield prediction failed' });
    }
  }

  async getInsights(req: Request, res: Response): Promise<Response> {
    try {
      const { portfolioId } = req.params;
      const { limit = 10 } = req.query;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { id: portfolioId, userId }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const insights = await AIInsight.findAll({
        where: { portfolioId },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit as string)
      });

      const formattedInsights = insights.map(insight => ({
        id: insight.id,
        type: insight.insightType,
        data: JSON.parse(insight.data),
        confidence: insight.confidence,
        createdAt: insight.createdAt
      }));

      return res.json({
        success: true,
        insights: formattedInsights,
        totalInsights: insights.length
      });

    } catch (error) {
      logger.error('Get insights error:', error);
      return res.status(500).json({ error: 'Failed to retrieve insights' });
    }
  }

  async generateRecommendations(req: Request, res: Response): Promise<Response> {
    try {
      const { portfolioId } = req.body;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { id: portfolioId, userId }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const analysis = await this.portfolioAnalyzer.analyzePortfolio(portfolio.id);
      const recommendations = await this.portfolioAnalyzer.generateRecommendations(analysis);

      // Store recommendations
      await AIInsight.create({
        portfolioId: portfolio.id,
        insightType: 'recommendations',
        data: JSON.stringify(recommendations),
        confidence: recommendations.confidence,
        createdAt: new Date()
      });

      return res.json({
        success: true,
        recommendations: {
          immediate: recommendations.immediate,
          shortTerm: recommendations.shortTerm,
          longTerm: recommendations.longTerm,
          riskOptimization: recommendations.riskOptimization,
          yieldOptimization: recommendations.yieldOptimization,
          confidence: recommendations.confidence
        }
      });

    } catch (error) {
      logger.error('Generate recommendations error:', error);
      return res.status(500).json({ error: 'Failed to generate recommendations' });
    }
  }
}
