import { HistoricalData } from './HistoricalData';
import { PriceFeeds } from './PriceFeeds';
import { logger } from '../../utils/logger';

export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number; // 0-100
  factors: {
    priceAction: number;
    volume: number;
    volatility: number;
    correlation: number;
    momentum: number;
  };
  confidence: number;
}

export interface DeFiMetrics {
  totalTVL: number;
  tvlChange24h: number;
  protocolDistribution: Record<string, number>;
  chainDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  dominanceIndex: number;
}

export interface MarketConditions {
  volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  trendDirection: 'uptrend' | 'downtrend' | 'sideways';
  marketPhase: 'accumulation' | 'markup' | 'distribution' | 'markdown';
  riskLevel: number; // 0-10
  opportunityScore: number; // 0-100
}

export interface RiskMetrics {
  overallRisk: number;
  marketRisk: number;
  liquidityRisk: number;
  correlationRisk: number;
  volatilityRisk: number;
  concentrationRisk: number;
}

export interface MacroEconomicFactors {
  usdStrength: number;
  stockMarketCorrelation: number;
  riskOnOffSentiment: 'risk_on' | 'risk_off' | 'neutral';
  institutionalFlow: number;
  regulatoryRisk: number;
}

export class MarketAnalytics {
  private historicalData: HistoricalData;
  private priceFeeds: PriceFeeds;
  private analyticsCache: Map<string, { data: any; expires: number }>;
  private readonly CACHE_DURATION = 600000; // 10 minutes

  constructor() {
    this.historicalData = new HistoricalData();
    this.priceFeeds = new PriceFeeds();
    this.analyticsCache = new Map();
  }

  async analyzeMarketSentiment(): Promise<MarketSentiment> {
    try {
      const cacheKey = 'market_sentiment';
      const cached = this.analyticsCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      // Get market data for analysis
      const [btcPrices, ethPrices, marketData] = await Promise.all([
        this.historicalData.getHistoricalPrices('BTC', 30),
        this.historicalData.getHistoricalPrices('ETH', 30),
        this.priceFeeds.getCurrentMarketData()
      ]);

      // Calculate sentiment factors
      const priceAction = this.calculatePriceActionScore(btcPrices, ethPrices);
      const volume = this.calculateVolumeScore(btcPrices, ethPrices);
      const volatility = await this.calculateVolatilityScore();
      const correlation = await this.calculateCorrelationScore();
      const momentum = this.calculateMomentumScore(btcPrices, ethPrices);

      const factors = {
        priceAction,
        volume,
        volatility,
        correlation,
        momentum
      };

      // Calculate overall sentiment score
      const score = this.calculateOverallSentimentScore(factors);
      const overall = this.determineSentimentLabel(score);
      const confidence = this.calculateSentimentConfidence(factors);

      const sentiment: MarketSentiment = {
        overall,
        score,
        factors,
        confidence
      };

      this.analyticsCache.set(cacheKey, {
        data: sentiment,
        expires: Date.now() + this.CACHE_DURATION
      });

      return sentiment;

    } catch (error) {
      logger.error('Error analyzing market sentiment:', error);
      return {
        overall: 'neutral',
        score: 50,
        factors: {
          priceAction: 50,
          volume: 50,
          volatility: 50,
          correlation: 50,
          momentum: 50
        },
        confidence: 0.5
      };
    }
  }

  async getCurrentMarketConditions(): Promise<MarketConditions> {
    try {
      const cacheKey = 'market_conditions';
      const cached = this.analyticsCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      const [btcPrices, volatility, sentiment] = await Promise.all([
        this.historicalData.getHistoricalPrices('BTC', 90),
        this.historicalData.calculateVolatility('BTC', 30),
        this.analyzeMarketSentiment()
      ]);

      const volatilityRegime = this.classifyVolatilityRegime(volatility);
      const trendDirection = this.analyzeTrendDirection(btcPrices);
      const marketPhase = this.identifyMarketPhase(btcPrices, sentiment);
      const riskLevel = this.calculateMarketRiskLevel(volatility, sentiment);
      const opportunityScore = this.calculateOpportunityScore(sentiment, volatilityRegime, trendDirection);

      const conditions: MarketConditions = {
        volatilityRegime,
        trendDirection,
        marketPhase,
        riskLevel,
        opportunityScore
      };

      this.analyticsCache.set(cacheKey, {
        data: conditions,
        expires: Date.now() + this.CACHE_DURATION
      });

      return conditions;

    } catch (error) {
      logger.error('Error getting market conditions:', error);
      return {
        volatilityRegime: 'medium',
        trendDirection: 'sideways',
        marketPhase: 'accumulation',
        riskLevel: 5,
        opportunityScore: 50
      };
    }
  }

  async calculateMarketRisk(): Promise<RiskMetrics> {
    try {
      const [volatility, correlations, marketData, sentiment] = await Promise.all([
        this.historicalData.calculateVolatility('BTC', 30),
        this.historicalData.getCorrelationMatrix(['BTC', 'ETH', 'USDC'], 30),
        this.priceFeeds.getCurrentMarketData(),
        this.analyzeMarketSentiment()
      ]);

      const marketRisk = this.calculateMarketRiskComponent(volatility, sentiment);
      const liquidityRisk = this.calculateLiquidityRisk(marketData);
      const correlationRisk = this.calculateCorrelationRisk(correlations);
      const volatilityRisk = this.normalizeVolatilityToRisk(volatility);
      const concentrationRisk = this.calculateConcentrationRisk(marketData);

      const overallRisk = this.calculateOverallRisk({
        marketRisk,
        liquidityRisk,
        correlationRisk,
        volatilityRisk,
        concentrationRisk
      });

      return {
        overallRisk,
        marketRisk,
        liquidityRisk,
        correlationRisk,
        volatilityRisk,
        concentrationRisk
      };

    } catch (error) {
      logger.error('Error calculating market risk:', error);
      return {
        overallRisk: 5,
        marketRisk: 5,
        liquidityRisk: 5,
        correlationRisk: 5,
        volatilityRisk: 5,
        concentrationRisk: 5
      };
    }
  }

  async getDeFiMetrics(): Promise<DeFiMetrics> {
    try {
      const cacheKey = 'defi_metrics';
      const cached = this.analyticsCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      // Fetch DeFi data (would use real APIs in production)
      const metrics = await this.fetchDeFiMetricsData();

      this.analyticsCache.set(cacheKey, {
        data: metrics,
        expires: Date.now() + this.CACHE_DURATION
      });

      return metrics;

    } catch (error) {
      logger.error('Error getting DeFi metrics:', error);
      return {
        totalTVL: 50000000000, // $50B
        tvlChange24h: 1.5,
        protocolDistribution: {
          'Aave': 15,
          'Uniswap': 12,
          'Compound': 10,
          'Curve': 8,
          'Others': 55
        },
        chainDistribution: {
          'Ethereum': 60,
          'Polygon': 15,
          'Arbitrum': 10,
          'Optimism': 8,
          'Others': 7
        },
        categoryDistribution: {
          'Lending': 35,
          'DEX': 30,
          'Yield': 20,
          'Derivatives': 10,
          'Others': 5
        },
        dominanceIndex: 65
      };
    }
  }

  async getBenchmarkReturns(): Promise<Record<string, number>> {
    try {
      const [btcPrices, ethPrices] = await Promise.all([
        this.historicalData.getHistoricalPrices('BTC', 365),
        this.historicalData.getHistoricalPrices('ETH', 365)
      ]);

      const btcReturn = this.calculateAnnualizedReturn(btcPrices);
      const ethReturn = this.calculateAnnualizedReturn(ethPrices);

      return {
        BTC: btcReturn,
        ETH: ethReturn,
        DeFiIndex: (btcReturn + ethReturn) / 2 + 5, // Simplified DeFi index
        StablecoinYield: 4.5, // Typical stablecoin yield
        TradFi: 2.5, // Traditional finance benchmark
        SP500: 8.0 // S&P 500 historical average
      };

    } catch (error) {
      logger.error('Error getting benchmark returns:', error);
      return {
        BTC: 15,
        ETH: 20,
        DeFiIndex: 12,
        StablecoinYield: 4.5,
        TradFi: 2.5,
        SP500: 8.0
      };
    }
  }

  async getMacroEconomicFactors(): Promise<MacroEconomicFactors> {
    try {
      // In production, this would fetch real macro data
      return {
        usdStrength: 50 + Math.random() * 20 - 10, // 40-60 range
        stockMarketCorrelation: 0.3 + Math.random() * 0.4, // 0.3-0.7 range
        riskOnOffSentiment: 'neutral',
        institutionalFlow: Math.random() * 2 - 1, // -1 to 1
        regulatoryRisk: 3 + Math.random() * 4 // 3-7 range
      };

    } catch (error) {
      logger.error('Error getting macro economic factors:', error);
      return {
        usdStrength: 50,
        stockMarketCorrelation: 0.5,
        riskOnOffSentiment: 'neutral',
        institutionalFlow: 0,
        regulatoryRisk: 5
      };
    }
  }

  async getMarketTrendData(): Promise<any> {
    try {
      const trendData = await this.historicalData.getMarketTrendHistory(90);
      
      return {
        marketCapTrend: this.calculateTrend(trendData.map(d => d.marketCap)),
        volumeTrend: this.calculateTrend(trendData.map(d => d.volume)),
        defiTvlTrend: this.calculateTrend(trendData.map(d => d.defiTvl)),
        dominanceTrends: {
          btc: this.calculateTrend(trendData.map(d => d.btcDominance)),
          eth: this.calculateTrend(trendData.map(d => d.ethDominance))
        }
      };

    } catch (error) {
      logger.error('Error getting market trend data:', error);
      return {};
    }
  }

  private calculatePriceActionScore(btcPrices: any[], ethPrices: any[]): number {
    if (btcPrices.length < 7 || ethPrices.length < 7) return 50;

    const btcChange = ((btcPrices[btcPrices.length - 1].price - btcPrices[btcPrices.length - 7].price) / btcPrices[btcPrices.length - 7].price) * 100;
    const ethChange = ((ethPrices[ethPrices.length - 1].price - ethPrices[ethPrices.length - 7].price) / ethPrices[ethPrices.length - 7].price) * 100;

    const avgChange = (btcChange + ethChange) / 2;
    return Math.max(0, Math.min(100, 50 + avgChange * 2));
  }

  private calculateVolumeScore(btcPrices: any[], ethPrices: any[]): number {
    if (btcPrices.length < 7 || ethPrices.length < 7) return 50;

    const recentVolume = (btcPrices.slice(-3).reduce((sum: number, p: any) => sum + p.volume, 0) + 
                        ethPrices.slice(-3).reduce((sum: number, p: any) => sum + p.volume, 0)) / 6;
    
    const pastVolume = (btcPrices.slice(-10, -7).reduce((sum: number, p: any) => sum + p.volume, 0) + 
                      ethPrices.slice(-10, -7).reduce((sum: number, p: any) => sum + p.volume, 0)) / 6;

    if (pastVolume === 0) return 50;
    
    const volumeChange = ((recentVolume - pastVolume) / pastVolume) * 100;
    return Math.max(0, Math.min(100, 50 + volumeChange));
  }

  private async calculateVolatilityScore(): Promise<number> {
    const volatility = await this.historicalData.calculateVolatility('BTC', 30);
    // Higher volatility = lower score (more bearish)
    return Math.max(0, Math.min(100, 100 - volatility));
  }

  private async calculateCorrelationScore(): Promise<number> {
    const correlations = await this.historicalData.getCorrelationMatrix(['BTC', 'ETH'], 30);
    const btcEthCorr = correlations['BTC']?.['ETH'] || 0.5;
    
    // Moderate correlation is healthier
    const idealCorr = 0.7;
    const deviation = Math.abs(btcEthCorr - idealCorr);
    return Math.max(0, Math.min(100, 100 - deviation * 100));
  }

  private calculateMomentumScore(btcPrices: any[], ethPrices: any[]): number {
    if (btcPrices.length < 20 || ethPrices.length < 20) return 50;

    const btcMomentum = this.calculatePriceMomentum(btcPrices);
    const ethMomentum = this.calculatePriceMomentum(ethPrices);

    const avgMomentum = (btcMomentum + ethMomentum) / 2;
    return Math.max(0, Math.min(100, 50 + avgMomentum * 50));
  }

  private calculatePriceMomentum(prices: any[]): number {
    const short = this.calculateMovingAverage(prices.slice(-10));
    const long = this.calculateMovingAverage(prices.slice(-20));
    
    return (short - long) / long;
  }

  private calculateMovingAverage(prices: any[]): number {
    return prices.reduce((sum: number, p: any) => sum + p.price, 0) / prices.length;
  }

  private calculateOverallSentimentScore(factors: any): number {
    const weights = {
      priceAction: 0.3,
      volume: 0.2,
      volatility: 0.2,
      correlation: 0.15,
      momentum: 0.15
    };

    return Object.entries(factors).reduce((score, [key, value]) => {
      return score + (value as number) * weights[key as keyof typeof weights];
    }, 0);
  }

  private determineSentimentLabel(score: number): 'bullish' | 'bearish' | 'neutral' {
    if (score > 65) return 'bullish';
    if (score < 35) return 'bearish';
    return 'neutral';
  }

  private calculateSentimentConfidence(factors: any): number {
    const values = Object.values(factors) as number[];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Lower variance = higher confidence
    return Math.max(0.1, Math.min(1, 1 - Math.sqrt(variance) / 50));
  }

  private classifyVolatilityRegime(volatility: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (volatility < 20) return 'low';
    if (volatility < 40) return 'medium';
    if (volatility < 80) return 'high';
    return 'extreme';
  }

  private analyzeTrendDirection(prices: any[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (prices.length < 20) return 'sideways';

    const short = this.calculateMovingAverage(prices.slice(-10));
    const long = this.calculateMovingAverage(prices.slice(-20));
    const diff = (short - long) / long * 100;

    if (diff > 2) return 'uptrend';
    if (diff < -2) return 'downtrend';
    return 'sideways';
  }

  private identifyMarketPhase(prices: any[], sentiment: MarketSentiment): 'accumulation' | 'markup' | 'distribution' | 'markdown' {
    const trend = this.analyzeTrendDirection(prices);
    
    if (trend === 'uptrend' && sentiment.overall === 'bullish') return 'markup';
    if (trend === 'downtrend' && sentiment.overall === 'bearish') return 'markdown';
    if (trend === 'sideways' && sentiment.overall === 'neutral') return 'accumulation';
    return 'distribution';
  }

  private calculateMarketRiskLevel(volatility: number, sentiment: MarketSentiment): number {
    const volatilityRisk = Math.min(10, volatility / 10);
    const sentimentRisk = sentiment.overall === 'bearish' ? 8 : (sentiment.overall === 'neutral' ? 5 : 3);
    
    return Math.round((volatilityRisk + sentimentRisk) / 2);
  }

  private calculateOpportunityScore(sentiment: MarketSentiment, volatility: string, trend: string): number {
    let score = sentiment.score;
    
    // Adjust for volatility
    if (volatility === 'low') score += 10;
    if (volatility === 'extreme') score -= 20;
    
    // Adjust for trend
    if (trend === 'uptrend') score += 15;
    if (trend === 'downtrend') score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateMarketRiskComponent(volatility: number, sentiment: MarketSentiment): number {
    return Math.min(10, (volatility / 10 + (100 - sentiment.score) / 10) / 2);
  }

  private calculateLiquidityRisk(marketData: any): number {
    // Simplified liquidity risk based on market conditions
    return marketData.totalMarketCap > 1000000000000 ? 3 : 7; // $1T threshold
  }

  private calculateCorrelationRisk(correlations: Record<string, Record<string, number>>): number {
    const btcEthCorr = correlations['BTC']?.['ETH'] || 0.5;
    // High correlation = higher risk
    return Math.min(10, btcEthCorr * 10);
  }

  private normalizeVolatilityToRisk(volatility: number): number {
    return Math.min(10, volatility / 10);
  }

  private calculateConcentrationRisk(marketData: any): number {
    // Based on BTC dominance - higher dominance = higher concentration risk
    return Math.min(10, marketData.btcDominance / 10);
  }

  private calculateOverallRisk(risks: Record<string, number>): number {
    const weights = {
      marketRisk: 0.25,
      liquidityRisk: 0.15,
      correlationRisk: 0.2,
      volatilityRisk: 0.25,
      concentrationRisk: 0.15
    };

    return Object.entries(risks).reduce((total, [key, value]) => {
      return total + value * weights[key as keyof typeof weights];
    }, 0);
  }

  private async fetchDeFiMetricsData(): Promise<DeFiMetrics> {
    // In production, this would fetch real DeFi data from APIs
    return {
      totalTVL: 60000000000, // $60B
      tvlChange24h: 2.3,
      protocolDistribution: {
        'Aave': 18,
        'Uniswap': 15,
        'Compound': 12,
        'Curve': 10,
        'Yearn': 8,
        'Others': 37
      },
      chainDistribution: {
        'Ethereum': 65,
        'Polygon': 12,
        'Arbitrum': 8,
        'Optimism': 6,
        'Base': 4,
        'Others': 5
      },
      categoryDistribution: {
        'Lending': 40,
        'DEX': 35,
        'Yield': 15,
        'Derivatives': 7,
        'Others': 3
      },
      dominanceIndex: 70
    };
  }

  private calculateAnnualizedReturn(prices: any[]): number {
    if (prices.length < 2) return 0;
    
    const startPrice = prices[0].price;
    const endPrice = prices[prices.length - 1].price;
    const totalReturn = (endPrice - startPrice) / startPrice;
    
    return totalReturn * 100; // Convert to percentage
  }

  private calculateTrend(values: number[]): { direction: string; strength: number; change: number } {
    if (values.length < 2) {
      return { direction: 'neutral', strength: 0, change: 0 };
    }

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    const strength = Math.abs(change);
    
    let direction = 'neutral';
    if (change > 1) direction = 'increasing';
    else if (change < -1) direction = 'decreasing';
    
    return { direction, strength, change };
  }
}
