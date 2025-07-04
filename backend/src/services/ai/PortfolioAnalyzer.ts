import { GoogleGenerativeAI } from '@google/generative-ai';
import { YieldStrategy } from '../../models/YieldStrategy';
import { Transaction } from '../../models/Transaction';
import { MarketAnalytics } from '../data/MarketAnalytics';
import { logger } from '../../utils/logger';

export interface PortfolioAnalysis {
  performanceMetrics: PerformanceMetrics;
  riskMetrics: RiskMetrics;
  diversificationAnalysis: DiversificationAnalysis;
  efficiencyMetrics: EfficiencyMetrics;
  benchmarkComparison: BenchmarkComparison;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  winRate: number;
}

export interface RiskMetrics {
  valueAtRisk: number;
  expectedShortfall: number;
  correlationRisk: number;
  concentrationRisk: number;
}

export interface DiversificationAnalysis {
  diversificationRatio: number;
  protocolDiversification: number;
  chainDiversification: number;
  categoryDiversification: number;
}

export interface EfficiencyMetrics {
  gasCostRatio: number;
  rebalancingFrequency: number;
  executionEfficiency: number;
  opportunityCost: number;
}

export interface BenchmarkComparison {
  vsETH: number;
  vsBTC: number;
  vsDeFiIndex: number;
  vsStablecoinYield: number;
}

export interface Recommendations {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  riskOptimization: string[];
  yieldOptimization: string[];
  confidence: number;
}

export class PortfolioAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private marketAnalytics: MarketAnalytics;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.marketAnalytics = new MarketAnalytics();
  }

  async analyzePortfolio(portfolioId: string): Promise<PortfolioAnalysis> {
    try {
      // Get portfolio data
      const strategies = await YieldStrategy.findAll({
        where: { portfolioId }
      });

      const transactions = await Transaction.findAll({
        where: { portfolioId },
        order: [['createdAt', 'DESC']],
        limit: 100
      });

      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(
        strategies,
        transactions
      );

      // Calculate risk metrics
      const riskMetrics = await this.calculateRiskMetrics(strategies);

      // Analyze diversification
      const diversificationAnalysis = this.analyzeDiversification(strategies);

      // Calculate efficiency metrics
      const efficiencyMetrics = await this.calculateEfficiencyMetrics(
        strategies,
        transactions
      );

      // Benchmark comparison
      const benchmarkComparison = await this.compareToBenchmarks(
        performanceMetrics.annualizedReturn
      );

      logger.info(`Portfolio analysis completed for ${portfolioId}`);

      return {
        performanceMetrics,
        riskMetrics,
        diversificationAnalysis,
        efficiencyMetrics,
        benchmarkComparison
      };

    } catch (error) {
      logger.error('Portfolio analysis error:', error);
      throw new Error('Failed to analyze portfolio');
    }
  }

  async generateRecommendations(analysis: PortfolioAnalysis): Promise<Recommendations> {
    try {
      const recommendationPrompt = this.buildRecommendationPrompt(analysis);

      const result = await this.model.generateContent(recommendationPrompt);
      const aiResponse = result.response.text();

      const recommendations = this.parseRecommendationResponse(aiResponse);

      logger.info('Portfolio recommendations generated');

      return recommendations;

    } catch (error) {
      logger.error('Recommendation generation error:', error);
      throw new Error('Failed to generate recommendations');
    }
  }

  private async calculatePerformanceMetrics(
    strategies: any[],
    transactions: any[]
  ): Promise<PerformanceMetrics> {
    if (strategies.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        volatility: 0,
        maxDrawdown: 0,
        winRate: 0
      };
    }

    // Calculate total return
    const totalDeployed = strategies.reduce((sum, s) => sum + parseFloat(s.deployedAmount), 0);
    const currentValue = await this.calculateCurrentValue(strategies);
    const totalReturn = ((currentValue - totalDeployed) / totalDeployed) * 100;

    // Calculate time-weighted return
    const portfolioAge = this.calculatePortfolioAge(transactions);
    const annualizedReturn = this.annualizeReturn(totalReturn, portfolioAge);

    // Calculate volatility from transaction history
    const volatility = this.calculateVolatility(transactions);

    // Calculate Sharpe ratio (assuming 4% risk-free rate)
    const riskFreeRate = 4;
    const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;

    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(transactions);

    // Calculate win rate
    const winRate = this.calculateWinRate(transactions);

    return {
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      volatility,
      maxDrawdown,
      winRate
    };
  }

  private async calculateRiskMetrics(strategies: any[]): Promise<RiskMetrics> {
    // Value at Risk (95% confidence)
    const valueAtRisk = await this.calculateVaR(strategies, 0.95);

    // Expected Shortfall
    const expectedShortfall = await this.calculateExpectedShortfall(strategies, 0.95);

    // Correlation risk
    const correlationRisk = await this.calculateCorrelationRisk(strategies);

    // Concentration risk (Herfindahl-Hirschman Index)
    const concentrationRisk = this.calculateConcentrationRisk(strategies);

    return {
      valueAtRisk,
      expectedShortfall,
      correlationRisk,
      concentrationRisk
    };
  }

  private analyzeDiversification(strategies: any[]): DiversificationAnalysis {
    if (strategies.length === 0) {
      return {
        diversificationRatio: 0,
        protocolDiversification: 0,
        chainDiversification: 0,
        categoryDiversification: 0
      };
    }

    // Protocol diversification
    const protocols = [...new Set(strategies.map(s => s.protocol))];
    const protocolDiversification = protocols.length / strategies.length;

    // Chain diversification (would need chain data)
    const chainDiversification = 0.5; // Placeholder

    // Category diversification (would need category data)
    const categoryDiversification = 0.5; // Placeholder

    // Overall diversification ratio
    const allocations = strategies.map(s => s.allocation / 100);
    const hhi = allocations.reduce((sum, allocation) => sum + allocation * allocation, 0);
    const diversificationRatio = 1 - hhi;

    return {
      diversificationRatio,
      protocolDiversification,
      chainDiversification,
      categoryDiversification
    };
  }

  private async calculateEfficiencyMetrics(
    strategies: any[],
    transactions: any[]
  ): Promise<EfficiencyMetrics> {
    // Gas cost ratio (gas costs / total value)
    const totalGasCosts = transactions
      .filter(tx => tx.type === 'rebalance')
      .reduce((sum, tx) => sum + (parseFloat(tx.gasCost) || 0), 0);
    
    const totalValue = strategies.reduce((sum, s) => sum + parseFloat(s.deployedAmount), 0);
    const gasCostRatio = totalValue > 0 ? (totalGasCosts / totalValue) * 100 : 0;

    // Rebalancing frequency
    const rebalanceTransactions = transactions.filter(tx => tx.type === 'rebalance');
    const portfolioAge = this.calculatePortfolioAge(transactions);
    const rebalancingFrequency = portfolioAge > 0 ? rebalanceTransactions.length / portfolioAge * 365 : 0;

    // Execution efficiency (successful transactions / total transactions)
    const successfulTransactions = transactions.filter(tx => tx.status === 'completed').length;
    const executionEfficiency = transactions.length > 0 ? 
      (successfulTransactions / transactions.length) * 100 : 100;

    // Opportunity cost (missed yield due to delays)
    const opportunityCost = 0; // Would need more complex calculation

    return {
      gasCostRatio,
      rebalancingFrequency,
      executionEfficiency,
      opportunityCost
    };
  }

  private async compareToBenchmarks(annualizedReturn: number): Promise<BenchmarkComparison> {
    const benchmarks = await this.marketAnalytics.getBenchmarkReturns();

    return {
      vsETH: annualizedReturn - (benchmarks.ETH || 0),
      vsBTC: annualizedReturn - (benchmarks.BTC || 0),
      vsDeFiIndex: annualizedReturn - (benchmarks.DeFiIndex || 0),
      vsStablecoinYield: annualizedReturn - (benchmarks.StablecoinYield || 4)
    };
  }

  private buildRecommendationPrompt(analysis: PortfolioAnalysis): string {
    return `
      You are an expert DeFi portfolio advisor. Analyze the portfolio performance and provide actionable recommendations.

      Portfolio Analysis:
      ${JSON.stringify(analysis, null, 2)}

      Provide comprehensive recommendations in the following categories:
      1. Immediate actions (within 24 hours)
      2. Short-term improvements (within 1 month)
      3. Long-term strategy (3-6 months)
      4. Risk optimization opportunities
      5. Yield optimization opportunities

      Consider:
      - Current market conditions
      - Risk-adjusted returns
      - Diversification opportunities
      - Cost efficiency improvements
      - Emerging protocols and opportunities

      Response format (JSON only):
      {
        "immediate": ["action1", "action2"],
        "shortTerm": ["improvement1", "improvement2"],
        "longTerm": ["strategy1", "strategy2"],
        "riskOptimization": ["risk_action1", "risk_action2"],
        "yieldOptimization": ["yield_action1", "yield_action2"],
        "confidence": number_0_to_1
      }
    `;
  }

  private parseRecommendationResponse(response: string): Recommendations {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error parsing recommendation response:', error);
      return {
        immediate: ['Error generating recommendations'],
        shortTerm: [],
        longTerm: [],
        riskOptimization: [],
        yieldOptimization: [],
        confidence: 0
      };
    }
  }

  // Helper calculation methods
  private async calculateCurrentValue(strategies: any[]): Promise<number> {
    // This would calculate current value including accrued yield
    return strategies.reduce((sum, s) => sum + parseFloat(s.deployedAmount), 0);
  }

  private calculatePortfolioAge(transactions: any[]): number {
    if (transactions.length === 0) return 0;
    
    const oldestTransaction = transactions[transactions.length - 1];
    const ageInMs = Date.now() - new Date(oldestTransaction.createdAt).getTime();
    return ageInMs / (1000 * 60 * 60 * 24); // Age in days
  }

  private annualizeReturn(totalReturn: number, daysHeld: number): number {
    if (daysHeld <= 0) return 0;
    return ((1 + totalReturn / 100) ** (365 / daysHeld) - 1) * 100;
  }

  private calculateVolatility(transactions: any[]): number {
    // Calculate volatility from transaction values
    if (transactions.length < 2) return 0;
    
    const values = transactions.map(tx => parseFloat(tx.amount) || 0);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private calculateMaxDrawdown(transactions: any[]): number {
    // Calculate maximum drawdown from transaction history
    let maxDrawdown = 0;
    let peak = 0;
    
    for (const tx of transactions) {
      const value = parseFloat(tx.amount) || 0;
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = ((peak - value) / peak) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    return maxDrawdown;
  }

  private calculateWinRate(transactions: any[]): number {
    const profitableTransactions = transactions.filter(tx => 
      tx.type === 'yield_harvest' && parseFloat(tx.amount) > 0
    ).length;
    
    const totalYieldTransactions = transactions.filter(tx => 
      tx.type === 'yield_harvest'
    ).length;
    
    return totalYieldTransactions > 0 ? 
      (profitableTransactions / totalYieldTransactions) * 100 : 0;
  }

  private async calculateVaR(strategies: any[], confidence: number): Promise<number> {
    // Simplified VaR calculation
    const totalValue = strategies.reduce((sum, s) => sum + parseFloat(s.deployedAmount), 0);
    const avgRiskScore = strategies.reduce((sum, s) => sum + s.riskScore, 0) / strategies.length;
    
    // Estimate VaR based on risk score (simplified)
    return totalValue * (avgRiskScore / 10) * 0.1; // 10% max loss for highest risk
  }

  private async calculateExpectedShortfall(strategies: any[], confidence: number): Promise<number> {
    const var95 = await this.calculateVaR(strategies, confidence);
    return var95 * 1.5; // Expected shortfall typically 1.5x VaR
  }

  private async calculateCorrelationRisk(strategies: any[]): Promise<number> {
    // Simplified correlation risk calculation
    const protocols = [...new Set(strategies.map(s => s.protocol))];
    return protocols.length < 3 ? 0.8 : 0.3; // High correlation if < 3 protocols
  }

  private calculateConcentrationRisk(strategies: any[]): number {
    if (strategies.length === 0) return 0;
    
    const allocations = strategies.map(s => s.allocation / 100);
    const hhi = allocations.reduce((sum, allocation) => sum + allocation * allocation, 0);
    
    return hhi; // Higher HHI = higher concentration risk
  }
}
