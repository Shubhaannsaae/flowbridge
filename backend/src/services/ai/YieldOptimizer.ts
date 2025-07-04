import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProtocolScanner } from '../defi/ProtocolScanner';
import { RiskAssessment } from './RiskAssessment';
import { PriceFeeds } from '../data/PriceFeeds';
import { logger } from '../../utils/logger';

export interface OptimizationPreferences {
  riskLevel: number;
  cardLiquidityReserve: number;
  minImprovementThreshold: number;
}

export interface OptimizationResult {
  status: 'success' | 'no_action_needed' | 'error';
  strategy?: YieldStrategy[];
  expectedImprovement?: number;
  confidence?: number;
  reasoning?: string;
  estimatedGasCost?: number;
  timeToExecute?: number;
  reason?: string;
  error?: string;
}

export interface YieldStrategy {
  protocol: string;
  allocation: number;
  expectedAPY: number;
  riskScore: number;
  amount: number;
  chain: string;
}

export class YieldOptimizer {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private protocolScanner: ProtocolScanner;
  private riskAssessment: RiskAssessment;
  private priceFeeds: PriceFeeds;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.protocolScanner = new ProtocolScanner();
    this.riskAssessment = new RiskAssessment();
    this.priceFeeds = new PriceFeeds();
  }

  async optimizePortfolio(
    userAddress: string,
    preferences: OptimizationPreferences
  ): Promise<OptimizationResult> {
    try {
      // Get current portfolio state
      const currentPortfolio = await this.getCurrentPortfolio(userAddress);
      
      // Scan available protocols
      const availableProtocols = await this.protocolScanner.scanAllProtocols();
      
      // Get market data
      const marketData = await this.priceFeeds.getCurrentMarketData();

      // Filter protocols by risk level
      const suitableProtocols = availableProtocols.filter(
        p => p.riskScore <= preferences.riskLevel
      );

      if (suitableProtocols.length === 0) {
        return {
          status: 'no_action_needed',
          reason: 'No suitable protocols found for risk level'
        };
      }

      // Use Gemini AI for optimization
      const optimizationPrompt = this.buildOptimizationPrompt(
        currentPortfolio,
        suitableProtocols,
        marketData,
        preferences
      );

      const result = await this.model.generateContent(optimizationPrompt);
      const aiResponse = result.response.text();
      
      const optimization = this.parseAIResponse(aiResponse);
      
      // Validate optimization with risk assessment
      const riskValidation = await this.riskAssessment.validateStrategy(optimization.strategy);
      
      if (!riskValidation.isValid) {
        return {
          status: 'error',
          error: `Risk validation failed: ${riskValidation.reason}`
        };
      }

      // Calculate gas costs
      const gasCost = await this.estimateGasCosts(optimization.strategy);
      
      // Check if improvement meets threshold
      if (optimization.expectedImprovement < preferences.minImprovementThreshold) {
        return {
          status: 'no_action_needed',
          reason: 'Expected improvement below threshold',
          expectedImprovement: optimization.expectedImprovement
        };
      }

      logger.info(`Portfolio optimization completed for ${userAddress}`);

      return {
        status: 'success',
        strategy: optimization.strategy,
        expectedImprovement: optimization.expectedImprovement,
        confidence: optimization.confidence,
        reasoning: optimization.reasoning,
        estimatedGasCost: gasCost,
        timeToExecute: this.estimateExecutionTime(optimization.strategy)
      };

    } catch (error) {
      logger.error('Portfolio optimization error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown optimization error'
      };
    }
  }

  private buildOptimizationPrompt(
    currentPortfolio: any,
    protocols: any[],
    marketData: any,
    preferences: OptimizationPreferences
  ): string {
    return `
      You are an expert DeFi yield optimization AI. Analyze the following data and provide optimal portfolio allocation.

      Current Portfolio:
      ${JSON.stringify(currentPortfolio, null, 2)}

      Available Protocols:
      ${JSON.stringify(protocols.map(p => ({
        name: p.name,
        apy: p.currentAPY,
        tvl: p.tvl,
        riskScore: p.riskScore,
        chain: p.chain,
        category: p.category
      })), null, 2)}

      Market Data:
      ${JSON.stringify(marketData, null, 2)}

      User Preferences:
      - Risk Level: ${preferences.riskLevel}/10
      - Card Liquidity Reserve: $${preferences.cardLiquidityReserve}
      - Minimum Improvement Threshold: ${preferences.minImprovementThreshold * 100}%

      Requirements:
      1. Maximize risk-adjusted returns
      2. Maintain required liquidity reserve
      3. Diversify across protocols and chains
      4. Consider gas costs and execution complexity
      5. Provide confidence score (0-1)

      Response format (JSON only):
      {
        "strategy": [
          {
            "protocol": "protocol_name",
            "allocation": percentage,
            "expectedAPY": number,
            "riskScore": number,
            "amount": dollar_amount,
            "chain": "chain_name"
          }
        ],
        "expectedImprovement": percentage,
        "confidence": number,
        "reasoning": "explanation"
      }
    `;
  }

  private parseAIResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error parsing AI response:', error);
      throw new Error('Failed to parse AI optimization response');
    }
  }

  private async getCurrentPortfolio(userAddress: string): Promise<any> {
    // This would typically fetch from database
    // For now, return a structure that represents current state
    return {
      totalValue: 0,
      strategies: [],
      lastRebalance: new Date().toISOString()
    };
  }

  private async estimateGasCosts(strategies: YieldStrategy[]): Promise<number> {
    // Estimate gas costs based on number of transactions needed
    const baseGasPerTransaction = 150000; // Conservative estimate
    const transactionCount = strategies.length;
    const gasPrice = await this.priceFeeds.getCurrentGasPrice();
    
    return (baseGasPerTransaction * transactionCount * gasPrice) / 1e9; // Convert to USD
  }

  private estimateExecutionTime(strategies: YieldStrategy[]): number {
    // Estimate execution time based on number of cross-chain operations
    const crossChainOps = strategies.filter(s => s.chain !== 'ethereum').length;
    const baseTime = 30; // 30 seconds base
    const crossChainTime = crossChainOps * 120; // 2 minutes per cross-chain op
    
    return baseTime + crossChainTime;
  }
}
