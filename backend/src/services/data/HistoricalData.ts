import { PriceFeeds } from './PriceFeeds';
import { logger } from '../../utils/logger';

export interface HistoricalPrice {
  timestamp: Date;
  price: number;
  volume: number;
}

export interface PortfolioHistoryEntry {
  date: string;
  totalValue: number;
  yieldEarned: number;
  apy: number;
  strategies: Array<{
    protocol: string;
    value: number;
    yield: number;
  }>;
}

export interface ProtocolYieldHistory {
  protocol: string;
  date: string;
  apy: number;
  tvl: number;
  utilization: number;
}

export interface MarketTrendData {
  timestamp: Date;
  marketCap: number;
  volume: number;
  defiTvl: number;
  btcDominance: number;
  ethDominance: number;
}

export class HistoricalData {
  private priceFeeds: PriceFeeds;
  private dataCache: Map<string, { data: any; expires: number }>;
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor() {
    this.priceFeeds = new PriceFeeds();
    this.dataCache = new Map();
  }

  async getHistoricalPrices(
    symbol: string,
    days: number,
    interval: 'hourly' | 'daily' = 'daily'
  ): Promise<HistoricalPrice[]> {
    try {
      const cacheKey = `prices_${symbol}_${days}_${interval}`;
      const cached = this.dataCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      const historicalData = await this.fetchHistoricalPrices(symbol, days, interval);
      
      this.dataCache.set(cacheKey, {
        data: historicalData,
        expires: Date.now() + this.CACHE_DURATION
      });

      return historicalData;

    } catch (error) {
      logger.error(`Error getting historical prices for ${symbol}:`, error);
      return [];
    }
  }

  async getPortfolioHistory(portfolioId: string, days: number): Promise<PortfolioHistoryEntry[]> {
    try {
      // This would typically fetch from database
      // For now, generate sample data based on current market conditions
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      const history: PortfolioHistoryEntry[] = [];
      let currentValue = 10000; // Starting value
      let totalYield = 0;

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        
        // Simulate daily yield (0.01% to 0.05% daily)
        const dailyYield = currentValue * (0.0001 + Math.random() * 0.0004);
        totalYield += dailyYield;
        currentValue += dailyYield;
        
        // Add some volatility
        const volatility = (Math.random() - 0.5) * 0.02; // ±1%
        currentValue *= (1 + volatility);

        // Calculate APY
        const timeElapsed = (date.getTime() - startDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
        const apy = timeElapsed > 0 ? (totalYield / 10000) / timeElapsed * 100 : 0;

        history.push({
          date: date.toISOString().split('T')[0],
          totalValue: currentValue,
          yieldEarned: totalYield,
          apy,
          strategies: [
            {
              protocol: 'Aave USDC',
              value: currentValue * 0.4,
              yield: totalYield * 0.3
            },
            {
              protocol: 'Compound USDC',
              value: currentValue * 0.3,
              yield: totalYield * 0.25
            },
            {
              protocol: 'Yearn USDC',
              value: currentValue * 0.3,
              yield: totalYield * 0.45
            }
          ]
        });
      }

      return history;

    } catch (error) {
      logger.error(`Error getting portfolio history for ${portfolioId}:`, error);
      return [];
    }
  }

  async getProtocolYieldHistory(protocol: string, days: number): Promise<ProtocolYieldHistory[]> {
    try {
      const cacheKey = `protocol_${protocol}_${days}`;
      const cached = this.dataCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      const history = await this.fetchProtocolYieldHistory(protocol, days);
      
      this.dataCache.set(cacheKey, {
        data: history,
        expires: Date.now() + this.CACHE_DURATION
      });

      return history;

    } catch (error) {
      logger.error(`Error getting protocol yield history for ${protocol}:`, error);
      return [];
    }
  }

  async getMarketTrendHistory(days: number): Promise<MarketTrendData[]> {
    try {
      const cacheKey = `market_trends_${days}`;
      const cached = this.dataCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      const trendData = await this.fetchMarketTrendHistory(days);
      
      this.dataCache.set(cacheKey, {
        data: trendData,
        expires: Date.now() + this.CACHE_DURATION
      });

      return trendData;

    } catch (error) {
      logger.error('Error getting market trend history:', error);
      return [];
    }
  }

  async calculateVolatility(symbol: string, days: number): Promise<number> {
    try {
      const prices = await this.getHistoricalPrices(symbol, days);
      
      if (prices.length < 2) {
        return 0;
      }

      // Calculate daily returns
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const dailyReturn = (prices[i].price - prices[i - 1].price) / prices[i - 1].price;
        returns.push(dailyReturn);
      }

      // Calculate standard deviation of returns
      const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
      
      return Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility in %

    } catch (error) {
      logger.error(`Error calculating volatility for ${symbol}:`, error);
      return 0;
    }
  }

  async getCorrelationMatrix(symbols: string[], days: number): Promise<Record<string, Record<string, number>>> {
    try {
      const allPrices = await Promise.all(
        symbols.map(symbol => this.getHistoricalPrices(symbol, days))
      );

      const correlationMatrix: Record<string, Record<string, number>> = {};

      for (let i = 0; i < symbols.length; i++) {
        correlationMatrix[symbols[i]] = {};
        
        for (let j = 0; j < symbols.length; j++) {
          if (i === j) {
            correlationMatrix[symbols[i]][symbols[j]] = 1;
          } else {
            const correlation = this.calculateCorrelation(allPrices[i], allPrices[j]);
            correlationMatrix[symbols[i]][symbols[j]] = correlation;
          }
        }
      }

      return correlationMatrix;

    } catch (error) {
      logger.error('Error calculating correlation matrix:', error);
      return {};
    }
  }

  private async fetchHistoricalPrices(
    symbol: string,
    days: number,
    interval: 'hourly' | 'daily'
  ): Promise<HistoricalPrice[]> {
    try {
      // Use CoinGecko for historical data
      const coinId = this.getCoinGeckoId(symbol);
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.prices || !Array.isArray(data.prices)) {
        return [];
      }

      return data.prices.map((entry: [number, number], index: number) => ({
        timestamp: new Date(entry[0]),
        price: entry[1],
        volume: data.total_volumes && data.total_volumes[index] ? data.total_volumes[index][1] : 0
      }));

    } catch (error) {
      logger.error(`Error fetching historical prices for ${symbol}:`, error);
      return [];
    }
  }

  private async fetchProtocolYieldHistory(protocol: string, days: number): Promise<ProtocolYieldHistory[]> {
    try {
      // Generate simulated historical yield data
      const history: ProtocolYieldHistory[] = [];
      const endDate = new Date();
      
      let baseAPY = this.getProtocolBaseAPY(protocol);
      let baseTVL = this.getProtocolBaseTVL(protocol);

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
        
        // Add some realistic variation
        const apyVariation = (Math.random() - 0.5) * 0.4; // ±20% variation
        const tvlVariation = (Math.random() - 0.5) * 0.1; // ±5% variation
        
        baseAPY *= (1 + apyVariation);
        baseTVL *= (1 + tvlVariation);
        
        // Keep within reasonable bounds
        baseAPY = Math.max(0.5, Math.min(baseAPY, 20));
        baseTVL = Math.max(baseTVL * 0.5, baseTVL);

        history.push({
          protocol,
          date: date.toISOString().split('T')[0],
          apy: baseAPY,
          tvl: baseTVL,
          utilization: 0.6 + Math.random() * 0.3 // 60-90% utilization
        });
      }

      return history;

    } catch (error) {
      logger.error(`Error fetching protocol yield history for ${protocol}:`, error);
      return [];
    }
  }

  private async fetchMarketTrendHistory(days: number): Promise<MarketTrendData[]> {
    try {
      const trends: MarketTrendData[] = [];
      const endDate = new Date();
      
      // Get current market data as baseline
      const currentMarket = await this.priceFeeds.getCurrentMarketData();
      
      let marketCap = currentMarket.totalMarketCap;
      let defiTvl = currentMarket.defiTvl;
      let btcDominance = currentMarket.btcDominance;
      let ethDominance = currentMarket.ethDominance;

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
        
        // Add historical variation
        const marketVariation = (Math.random() - 0.5) * 0.05; // ±2.5%
        const tvlVariation = (Math.random() - 0.5) * 0.03; // ±1.5%
        const dominanceVariation = (Math.random() - 0.5) * 0.02; // ±1%
        
        marketCap *= (1 + marketVariation);
        defiTvl *= (1 + tvlVariation);
        btcDominance += dominanceVariation;
        ethDominance += dominanceVariation * 0.5;

        // Keep dominance within bounds
        btcDominance = Math.max(35, Math.min(btcDominance, 55));
        ethDominance = Math.max(15, Math.min(ethDominance, 25));

        trends.push({
          timestamp: date,
          marketCap,
          volume: marketCap * (0.05 + Math.random() * 0.05), // 5-10% of market cap
          defiTvl,
          btcDominance,
          ethDominance
        });
      }

      return trends;

    } catch (error) {
      logger.error('Error fetching market trend history:', error);
      return [];
    }
  }

  private calculateCorrelation(pricesA: HistoricalPrice[], pricesB: HistoricalPrice[]): number {
    if (pricesA.length !== pricesB.length || pricesA.length === 0) {
      return 0;
    }

    const returnsA = this.calculateReturns(pricesA);
    const returnsB = this.calculateReturns(pricesB);

    if (returnsA.length !== returnsB.length || returnsA.length === 0) {
      return 0;
    }

    const meanA = returnsA.reduce((sum, ret) => sum + ret, 0) / returnsA.length;
    const meanB = returnsB.reduce((sum, ret) => sum + ret, 0) / returnsB.length;

    let numerator = 0;
    let denominatorA = 0;
    let denominatorB = 0;

    for (let i = 0; i < returnsA.length; i++) {
      const diffA = returnsA[i] - meanA;
      const diffB = returnsB[i] - meanB;
      
      numerator += diffA * diffB;
      denominatorA += diffA * diffA;
      denominatorB += diffB * diffB;
    }

    const denominator = Math.sqrt(denominatorA * denominatorB);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateReturns(prices: HistoricalPrice[]): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i].price - prices[i - 1].price) / prices[i - 1].price;
      returns.push(dailyReturn);
    }

    return returns;
  }

  private getCoinGeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'OP': 'optimism',
      'ARB': 'arbitrum'
    };

    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  private getProtocolBaseAPY(protocol: string): number {
    const baseAPYs: Record<string, number> = {
      'Aave': 3.5,
      'Compound': 3.2,
      'Yearn': 6.8,
      'Curve': 4.5,
      'Convex': 5.2,
      'Uniswap': 8.5
    };

    for (const [name, apy] of Object.entries(baseAPYs)) {
      if (protocol.toLowerCase().includes(name.toLowerCase())) {
        return apy;
      }
    }

    return 4.0; // Default APY
  }

  private getProtocolBaseTVL(protocol: string): number {
    const baseTVLs: Record<string, number> = {
      'Aave': 10000000000, // $10B
      'Compound': 5000000000, // $5B
      'Yearn': 1000000000, // $1B
      'Curve': 3000000000, // $3B
      'Convex': 2000000000, // $2B
      'Uniswap': 4000000000 // $4B
    };

    for (const [name, tvl] of Object.entries(baseTVLs)) {
      if (protocol.toLowerCase().includes(name.toLowerCase())) {
        return tvl;
      }
    }

    return 100000000; // Default $100M TVL
  }
}
