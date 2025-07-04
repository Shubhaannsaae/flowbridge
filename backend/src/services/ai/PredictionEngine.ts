import { GoogleGenerativeAI } from '@google/generative-ai';
import { HistoricalData } from '../data/HistoricalData';
import { MarketAnalytics } from '../data/MarketAnalytics';
import { logger } from '../../utils/logger';

export interface YieldPrediction {
  protocol: string;
  currentAPY: number;
  predictedAPY: number;
  confidence: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  factors: PredictionFactor[];
  riskFactors: string[];
  lastUpdated: string;
  timeframe: number;
}

export interface PredictionFactor {
  factor: string;
  impact: number; // -1 to 1
  weight: number; // 0 to 1
  description: string;
}

export class PredictionEngine {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private historicalData: HistoricalData;
  private marketAnalytics: MarketAnalytics;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.historicalData = new HistoricalData();
    this.marketAnalytics = new MarketAnalytics();
  }

  async predictYield(protocol: string, timeframeDays: number): Promise<YieldPrediction> {
    try {
      // Get historical yield data
      const historicalYield = await this.historicalData.getProtocolYieldHistory(
        protocol, 
        90 // Get 90 days of history for better prediction
      );

      // Get current market conditions
      const marketConditions = await this.marketAnalytics.getCurrentMarketConditions();

      // Get protocol-specific metrics
      const protocolMetrics = await this.getProtocolMetrics(protocol);

      // Build prediction prompt
      const predictionPrompt = this.buildPredictionPrompt(
        protocol,
        historicalYield,
        marketConditions,
        protocolMetrics,
        timeframeDays
      );

      const result = await this.model.generateContent(predictionPrompt);
      const aiResponse = result.response.text();
      
      const prediction = this.parsePredictionResponse(aiResponse);

      // Validate prediction reasonableness
      const validatedPrediction = this.validatePrediction(prediction, historicalYield);

      logger.info(`Yield prediction generated for ${protocol}`);

      return {
        ...validatedPrediction,
        protocol,
        lastUpdated: new Date().toISOString(),
        timeframe: timeframeDays
      };

    } catch (error) {
      logger.error('Yield prediction error:', error);
      throw new Error(`Failed to predict yield for ${protocol}`);
    }
  }

  async predictMarketTrends(timeframeDays: number): Promise<any> {
    try {
      const marketData = await this.marketAnalytics.getMarketTrendData();
      const macroFactors = await this.marketAnalytics.getMacroEconomicFactors();

      const trendPrompt = this.buildMarketTrendPrompt(marketData, macroFactors, timeframeDays);

      const result = await this.model.generateContent(trendPrompt);
      const aiResponse = result.response.text();

      return this.parseMarketTrendResponse(aiResponse);

    } catch (error) {
      logger.error('Market trend prediction error:', error);
      throw new Error('Failed to predict market trends');
    }
  }

  private buildPredictionPrompt(
    protocol: string,
    historicalData: any[],
    marketConditions: any,
    protocolMetrics: any,
    timeframeDays: number
  ): string {
    return `
      You are an expert DeFi yield prediction AI. Analyze the following data to predict future yield for ${protocol}.

      Historical Yield Data (90 days):
      ${JSON.stringify(historicalData.slice(-30), null, 2)} // Last 30 days for brevity

      Current Market Conditions:
      ${JSON.stringify(marketConditions, null, 2)}

      Protocol Metrics:
      ${JSON.stringify(protocolMetrics, null, 2)}

      Prediction Timeframe: ${timeframeDays} days

      Consider these factors in your analysis:
      1. Historical yield patterns and seasonality
      2. TVL trends and liquidity changes
      3. Market volatility and correlation
      4. Protocol-specific events and updates
      5. Broader DeFi market trends
      6. Regulatory environment changes

      Response format (JSON only):
      {
        "currentAPY": number,
        "predictedAPY": number,
        "confidence": number_0_to_1,
        "trend": "INCREASING|DECREASING|STABLE",
        "factors": [
          {
            "factor": "factor_name",
            "impact": number_-1_to_1,
            "weight": number_0_to_1,
            "description": "explanation"
          }
        ],
        "riskFactors": ["risk1", "risk2"]
      }
    `;
  }

  private buildMarketTrendPrompt(
    marketData: any,
    macroFactors: any,
    timeframeDays: number
  ): string {
    return `
      Analyze the overall DeFi market trends and predict future conditions.

      Market Data:
      ${JSON.stringify(marketData, null, 2)}

      Macro Economic Factors:
      ${JSON.stringify(macroFactors, null, 2)}

      Prediction Timeframe: ${timeframeDays} days

      Provide comprehensive market trend analysis covering:
      1. Overall yield environment
      2. Risk appetite trends
      3. Capital flow patterns
      4. Protocol category performance
      5. Cross-chain activity trends

      Response format (JSON only):
      {
        "overallTrend": "BULLISH|BEARISH|NEUTRAL",
        "yieldEnvironment": "INCREASING|DECREASING|STABLE",
        "riskAppetite": "HIGH|MEDIUM|LOW",
        "topPerformingCategories": ["category1", "category2"],
        "crossChainTrends": {},
        "confidence": number_0_to_1,
        "keyFactors": ["factor1", "factor2"]
      }
    `;
  }

  private parsePredictionResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error parsing prediction response:', error);
      throw new Error('Failed to parse prediction response');
    }
  }

  private parseMarketTrendResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error parsing market trend response:', error);
      throw new Error('Failed to parse market trend response');
    }
  }

  private validatePrediction(prediction: any, historicalData: any[]): any {
    // Ensure predicted APY is within reasonable bounds
    const recentAPYs = historicalData.slice(-7).map(d => d.apy);
    const avgRecentAPY = recentAPYs.reduce((sum, apy) => sum + apy, 0) / recentAPYs.length;
    
    // Cap prediction at 3x recent average or 50% APY, whichever is lower
    const maxReasonableAPY = Math.min(avgRecentAPY * 3, 50);
    const minReasonableAPY = Math.max(avgRecentAPY * 0.3, 0.1);
    
    const validatedAPY = Math.max(
      minReasonableAPY,
      Math.min(prediction.predictedAPY, maxReasonableAPY)
    );

    // Adjust confidence if prediction was capped
    let adjustedConfidence = prediction.confidence;
    if (validatedAPY !== prediction.predictedAPY) {
      adjustedConfidence *= 0.8; // Reduce confidence for capped predictions
    }

    return {
      ...prediction,
      predictedAPY: validatedAPY,
      confidence: adjustedConfidence
    };
  }

  private async getProtocolMetrics(protocol: string): Promise<any> {
    try {
      // Get protocol-specific metrics
      return {
        tvl: 0,
        volume24h: 0,
        utilizationRate: 0,
        governanceActivity: 0,
        developmentActivity: 0
      };
    } catch (error) {
      logger.error(`Error getting protocol metrics for ${protocol}:`, error);
      return {};
    }
  }
}
