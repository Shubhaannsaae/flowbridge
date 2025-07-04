import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';

export interface PriceData {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface TokenPrice {
  address: string;
  symbol: string;
  price: number;
  chain: string;
  source: string;
}

export interface GasPriceData {
  chain: string;
  slow: string;
  standard: string;
  fast: string;
  instant: string;
  baseFee?: string;
  priorityFee?: string;
}

export class PriceFeeds {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private priceCache: Map<string, { data: PriceData; expires: number }>;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  // Price feed APIs
  private readonly APIs = {
    coingecko: 'https://api.coingecko.com/api/v3',
    chainlink: 'https://api.chain.link/v1',
    defillama: 'https://coins.llama.fi'
  };

  // Chainlink price feed addresses (Ethereum mainnet)
  private readonly CHAINLINK_FEEDS = {
    'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D'
  };

  constructor() {
    this.providers = new Map();
    this.priceCache = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const networks = {
      ethereum: process.env.ETHEREUM_RPC_URL!,
      polygon: process.env.POLYGON_RPC_URL!,
      arbitrum: process.env.ARBITRUM_RPC_URL!,
      optimism: process.env.OPTIMISM_RPC_URL!,
      base: process.env.BASE_RPC_URL!
    };

    for (const [network, rpcUrl] of Object.entries(networks)) {
      this.providers.set(network, new ethers.providers.JsonRpcProvider(rpcUrl));
    }
  }

  async getTokenPrice(symbol: string): Promise<PriceData> {
    try {
      const cacheKey = symbol.toLowerCase();
      const cached = this.priceCache.get(cacheKey);
      
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      // Try CoinGecko first
      let priceData = await this.fetchFromCoinGecko(symbol);
      
      // Fallback to DeFiLlama if CoinGecko fails
      if (!priceData) {
        priceData = await this.fetchFromDeFiLlama(symbol);
      }

      // Fallback to Chainlink for major pairs
      if (!priceData && this.CHAINLINK_FEEDS[`${symbol.toUpperCase()}/USD`]) {
        priceData = await this.fetchFromChainlink(symbol);
      }

      if (!priceData) {
        throw new Error(`Unable to fetch price for ${symbol}`);
      }

      // Cache the result
      this.priceCache.set(cacheKey, {
        data: priceData,
        expires: Date.now() + this.CACHE_DURATION
      });

      return priceData;

    } catch (error) {
      logger.error(`Error getting token price for ${symbol}:`, error);
      throw new Error(`Failed to get price for ${symbol}`);
    }
  }

  async getMultipleTokenPrices(symbols: string[]): Promise<PriceData[]> {
    try {
      const promises = symbols.map(symbol => this.getTokenPrice(symbol));
      const results = await Promise.allSettled(promises);
      
      return results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<PriceData>).value);

    } catch (error) {
      logger.error('Error getting multiple token prices:', error);
      return [];
    }
  }

  async getTokenPriceByAddress(address: string, chain: string = 'ethereum'): Promise<TokenPrice | null> {
    try {
      // Use DeFiLlama for token address lookups
      const response = await axios.get(
        `${this.APIs.defillama}/prices/current/${chain}:${address}`,
        { timeout: 10000 }
      );

      const data = response.data;
      const key = `${chain}:${address}`;
      
      if (data.coins && data.coins[key]) {
        const tokenData = data.coins[key];
        return {
          address,
          symbol: tokenData.symbol || 'UNKNOWN',
          price: tokenData.price,
          chain,
          source: 'defillama'
        };
      }

      return null;

    } catch (error) {
      logger.error(`Error getting token price by address ${address}:`, error);
      return null;
    }
  }

  async getCurrentGasPrice(chain: string = 'ethereum'): Promise<number> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`Provider not available for ${chain}`);
      }

      const gasPrice = await provider.getGasPrice();
      return parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));

    } catch (error) {
      logger.error(`Error getting gas price for ${chain}:`, error);
      return 20; // Default fallback
    }
  }

  async getDetailedGasPrices(chain: string = 'ethereum'): Promise<GasPriceData> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`Provider not available for ${chain}`);
      }

      const feeData = await provider.getFeeData();
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 network
        const baseFee = feeData.maxFeePerGas.sub(feeData.maxPriorityFeePerGas);
        const priorityFee = feeData.maxPriorityFeePerGas;
        
        return {
          chain,
          slow: ethers.utils.formatUnits(baseFee.add(priorityFee.div(2)), 'gwei'),
          standard: ethers.utils.formatUnits(baseFee.add(priorityFee), 'gwei'),
          fast: ethers.utils.formatUnits(baseFee.add(priorityFee.mul(2)), 'gwei'),
          instant: ethers.utils.formatUnits(baseFee.add(priorityFee.mul(3)), 'gwei'),
          baseFee: ethers.utils.formatUnits(baseFee, 'gwei'),
          priorityFee: ethers.utils.formatUnits(priorityFee, 'gwei')
        };
      } else {
        // Legacy network
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from('20000000000'); // 20 gwei default
        
        return {
          chain,
          slow: ethers.utils.formatUnits(gasPrice.mul(90).div(100), 'gwei'), // 90%
          standard: ethers.utils.formatUnits(gasPrice, 'gwei'),
          fast: ethers.utils.formatUnits(gasPrice.mul(120).div(100), 'gwei'), // 120%
          instant: ethers.utils.formatUnits(gasPrice.mul(150).div(100), 'gwei') // 150%
        };
      }

    } catch (error) {
      logger.error(`Error getting detailed gas prices for ${chain}:`, error);
      return {
        chain,
        slow: '10',
        standard: '20',
        fast: '30',
        instant: '40'
      };
    }
  }

  async getCurrentMarketData(): Promise<{
    totalMarketCap: number;
    btcDominance: number;
    ethDominance: number;
    defiTvl: number;
    fearGreedIndex: number;
  }> {
    try {
      const [marketData, defiData] = await Promise.all([
        this.fetchGlobalMarketData(),
        this.fetchDeFiTVL()
      ]);

      return {
        totalMarketCap: marketData.totalMarketCap,
        btcDominance: marketData.btcDominance,
        ethDominance: marketData.ethDominance,
        defiTvl: defiData,
        fearGreedIndex: marketData.fearGreedIndex
      };

    } catch (error) {
      logger.error('Error getting current market data:', error);
      throw new Error('Failed to get market data');
    }
  }

  private async fetchFromCoinGecko(symbol: string): Promise<PriceData | null> {
    try {
      const response = await axios.get(
        `${this.APIs.coingecko}/simple/price`,
        {
          params: {
            ids: this.getCoinGeckoId(symbol),
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_24hr_vol: true,
            include_market_cap: true
          },
          timeout: 10000
        }
      );

      const coinId = this.getCoinGeckoId(symbol);
      const data = response.data[coinId];
      
      if (data) {
        return {
          symbol: symbol.toUpperCase(),
          price: data.usd,
          priceChange24h: data.usd_24h_change || 0,
          volume24h: data.usd_24h_vol || 0,
          marketCap: data.usd_market_cap || 0,
          lastUpdated: new Date()
        };
      }

      return null;

    } catch (error) {
      logger.warn(`CoinGecko API error for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchFromDeFiLlama(symbol: string): Promise<PriceData | null> {
    try {
      const response = await axios.get(
        `${this.APIs.defillama}/prices/current/coingecko:${this.getCoinGeckoId(symbol)}`,
        { timeout: 10000 }
      );

      const key = `coingecko:${this.getCoinGeckoId(symbol)}`;
      const data = response.data.coins[key];
      
      if (data) {
        return {
          symbol: symbol.toUpperCase(),
          price: data.price,
          priceChange24h: 0, // DeFiLlama doesn't provide this
          volume24h: 0,
          marketCap: 0,
          lastUpdated: new Date()
        };
      }

      return null;

    } catch (error) {
      logger.warn(`DeFiLlama API error for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchFromChainlink(symbol: string): Promise<PriceData | null> {
    try {
      const feedAddress = this.CHAINLINK_FEEDS[`${symbol.toUpperCase()}/USD`];
      if (!feedAddress) return null;

      const provider = this.providers.get('ethereum');
      if (!provider) return null;

      const aggregator = new ethers.Contract(
        feedAddress,
        [
          'function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)',
          'function decimals() external view returns (uint8)'
        ],
        provider
      );

      const [roundData, decimals] = await Promise.all([
        aggregator.latestRoundData(),
        aggregator.decimals()
      ]);

      const price = parseFloat(ethers.utils.formatUnits(roundData[1], decimals));

      return {
        symbol: symbol.toUpperCase(),
        price,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        lastUpdated: new Date()
      };

    } catch (error) {
      logger.warn(`Chainlink feed error for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchGlobalMarketData(): Promise<{
    totalMarketCap: number;
    btcDominance: number;
    ethDominance: number;
    fearGreedIndex: number;
  }> {
    try {
      const response = await axios.get(
        `${this.APIs.coingecko}/global`,
        { timeout: 10000 }
      );

      const data = response.data.data;
      
      return {
        totalMarketCap: data.total_market_cap.usd,
        btcDominance: data.market_cap_percentage.btc,
        ethDominance: data.market_cap_percentage.eth,
        fearGreedIndex: 50 // Would need separate API for this
      };

    } catch (error) {
      logger.error('Error fetching global market data:', error);
      return {
        totalMarketCap: 0,
        btcDominance: 0,
        ethDominance: 0,
        fearGreedIndex: 50
      };
    }
  }

  private async fetchDeFiTVL(): Promise<number> {
    try {
      const response = await axios.get(
        'https://api.llama.fi/tvl',
        { timeout: 10000 }
      );

      return response.data;

    } catch (error) {
      logger.error('Error fetching DeFi TVL:', error);
      return 0;
    }
  }

  private getCoinGeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'WETH': 'weth',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'OP': 'optimism',
      'ARB': 'arbitrum'
    };

    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }
}
