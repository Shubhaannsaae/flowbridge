import { ethers } from 'ethers';
import { ChainId } from '@lifi/sdk';
import { logger } from '../../utils/logger';

export interface ChainInfo {
  chainId: number;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrls?: string[];
  ensAddress?: string;
  multicallAddress?: string;
  isTestnet: boolean;
}

export interface TokenInfo {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

export interface GasPrice {
  chainId: number;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimit: {
    transfer: string;
    approve: string;
    swap: string;
  };
}

export class ChainManager {
  private providers: Map<number, ethers.providers.JsonRpcProvider>;
  private chainConfigs: Map<number, ChainInfo>;
  private supportedTokens: Map<number, TokenInfo[]>;

  constructor() {
    this.providers = new Map();
    this.chainConfigs = new Map();
    this.supportedTokens = new Map();
    this.initializeChains();
  }

  private initializeChains(): void {
    const chains: ChainInfo[] = [
      {
        chainId: 1,
        name: 'Ethereum Mainnet',
        shortName: 'eth',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [process.env.ETHEREUM_RPC_URL!],
        blockExplorerUrls: ['https://etherscan.io'],
        iconUrls: ['https://wallet-asset.matic.network/img/tokens/eth.svg'],
        ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
        multicallAddress: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
        isTestnet: false
      },
      {
        chainId: 137,
        name: 'Polygon Mainnet',
        shortName: 'matic',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18
        },
        rpcUrls: [process.env.POLYGON_RPC_URL!],
        blockExplorerUrls: ['https://polygonscan.com'],
        iconUrls: ['https://wallet-asset.matic.network/img/tokens/matic.svg'],
        multicallAddress: '0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507',
        isTestnet: false
      },
      {
        chainId: 42161,
        name: 'Arbitrum One',
        shortName: 'arb1',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [process.env.ARBITRUM_RPC_URL!],
        blockExplorerUrls: ['https://arbiscan.io'],
        iconUrls: ['https://bridge.arbitrum.io/logo.png'],
        multicallAddress: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
        isTestnet: false
      },
      {
        chainId: 10,
        name: 'Optimism',
        shortName: 'oeth',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [process.env.OPTIMISM_RPC_URL!],
        blockExplorerUrls: ['https://optimistic.etherscan.io'],
        iconUrls: ['https://optimism.io/images/metamask_icon.svg'],
        multicallAddress: '0x2DC0E2aa608532Da689e89e237dF582B783E552C',
        isTestnet: false
      },
      {
        chainId: 8453,
        name: 'Base',
        shortName: 'base',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [process.env.BASE_RPC_URL!],
        blockExplorerUrls: ['https://basescan.org'],
        iconUrls: ['https://base.org/favicon.ico'],
        multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
        isTestnet: false
      },
      {
        chainId: 43114,
        name: 'Avalanche C-Chain',
        shortName: 'avax',
        nativeCurrency: {
          name: 'Avalanche',
          symbol: 'AVAX',
          decimals: 18
        },
        rpcUrls: [process.env.AVALANCHE_RPC_URL!],
        blockExplorerUrls: ['https://snowtrace.io'],
        iconUrls: ['https://wallet-asset.matic.network/img/tokens/avax.svg'],
        multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
        isTestnet: false
      }
    ];

    // Initialize providers and store chain configs
    for (const chain of chains) {
      this.chainConfigs.set(chain.chainId, chain);
      if (chain.rpcUrls[0]) {
        this.providers.set(chain.chainId, new ethers.providers.JsonRpcProvider(chain.rpcUrls[0]));
      }
    }

    this.initializeTokens();
  }

  private initializeTokens(): void {
    // Common tokens across chains
    const tokens: Record<number, TokenInfo[]> = {
      1: [ // Ethereum
        {
          chainId: 1,
          address: '0xA0b86a33E6417c68c1CA1E32BcE04EF3D9C77E4E',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
          coingeckoId: 'usd-coin'
        },
        {
          chainId: 1,
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
          coingeckoId: 'tether'
        },
        {
          chainId: 1,
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          name: 'Dai Stablecoin',
          symbol: 'DAI',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/9956/large/dai-multi-collateral-mcd.png',
          coingeckoId: 'dai'
        }
      ],
      137: [ // Polygon
        {
          chainId: 137,
          address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
          coingeckoId: 'usd-coin'
        },
        {
          chainId: 137,
          address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
          coingeckoId: 'tether'
        }
      ],
      42161: [ // Arbitrum
        {
          chainId: 42161,
          address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
          coingeckoId: 'usd-coin'
        },
        {
          chainId: 42161,
          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
          coingeckoId: 'tether'
        }
      ],
      10: [ // Optimism
        {
          chainId: 10,
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
          coingeckoId: 'usd-coin'
        },
        {
          chainId: 10,
          address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
          name: 'Tether USD',
          symbol: 'USDT',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
          coingeckoId: 'tether'
        }
      ],
      8453: [ // Base
        {
          chainId: 8453,
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
          coingeckoId: 'usd-coin'
        }
      ],
      43114: [ // Avalanche
        {
          chainId: 43114,
          address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
          name: 'USD Coin',
          symbol: 'USDC',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
          coingeckoId: 'usd-coin'
        }
      ]
    };

    for (const [chainId, tokenList] of Object.entries(tokens)) {
      this.supportedTokens.set(parseInt(chainId), tokenList);
    }
  }

  async getProvider(chainId: number): Promise<ethers.providers.JsonRpcProvider> {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain ID: ${chainId}`);
    }
    return provider;
  }

  getChainInfo(chainId: number): ChainInfo | null {
    return this.chainConfigs.get(chainId) || null;
  }

  getAllSupportedChains(): ChainInfo[] {
    return Array.from(this.chainConfigs.values());
  }

  getSupportedTokens(chainId: number): TokenInfo[] {
    return this.supportedTokens.get(chainId) || [];
  }

  findTokenBySymbol(chainId: number, symbol: string): TokenInfo | null {
    const tokens = this.supportedTokens.get(chainId) || [];
    return tokens.find(token => token.symbol.toLowerCase() === symbol.toLowerCase()) || null;
  }

  findTokenByAddress(chainId: number, address: string): TokenInfo | null {
    const tokens = this.supportedTokens.get(chainId) || [];
    return tokens.find(token => token.address.toLowerCase() === address.toLowerCase()) || null;
  }

  async getCurrentGasPrice(chainId: number): Promise<GasPrice> {
    try {
      const provider = await this.getProvider(chainId);
      const feeData = await provider.getFeeData();

      const gasPrice: GasPrice = {
        chainId,
        gasPrice: feeData.gasPrice?.toString() || '0',
        gasLimit: {
          transfer: '21000',
          approve: '50000',
          swap: '200000'
        }
      };

      // Add EIP-1559 data if available
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        gasPrice.maxFeePerGas = feeData.maxFeePerGas.toString();
        gasPrice.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas.toString();
      }

      return gasPrice;

    } catch (error) {
      logger.error(`Error getting gas price for chain ${chainId}:`, error);
      
      // Return default values
      return {
        chainId,
        gasPrice: '20000000000', // 20 gwei
        gasLimit: {
          transfer: '21000',
          approve: '50000',
          swap: '200000'
        }
      };
    }
  }

  async getBlockNumber(chainId: number): Promise<number> {
    try {
      const provider = await this.getProvider(chainId);
      return await provider.getBlockNumber();
    } catch (error) {
      logger.error(`Error getting block number for chain ${chainId}:`, error);
      return 0;
    }
  }

  async getTokenBalance(
    chainId: number,
    tokenAddress: string,
    walletAddress: string
  ): Promise<string> {
    try {
      const provider = await this.getProvider(chainId);
      
      // Handle native token balance
      if (tokenAddress === ethers.constants.AddressZero || tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        const balance = await provider.getBalance(walletAddress);
        return ethers.utils.formatEther(balance);
      }

      // Handle ERC20 token balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function balanceOf(address account) external view returns (uint256)',
          'function decimals() external view returns (uint8)'
        ],
        provider
      );

      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals()
      ]);

      return ethers.utils.formatUnits(balance, decimals);

    } catch (error) {
      logger.error(`Error getting token balance for ${tokenAddress} on chain ${chainId}:`, error);
      return '0';
    }
  }

  async getMultipleTokenBalances(
    chainId: number,
    tokenAddresses: string[],
    walletAddress: string
  ): Promise<Array<{ address: string; balance: string; symbol: string }>> {
    try {
      const balances = await Promise.all(
        tokenAddresses.map(async (address) => {
          const balance = await this.getTokenBalance(chainId, address, walletAddress);
          const tokenInfo = this.findTokenByAddress(chainId, address);
          
          return {
            address,
            balance,
            symbol: tokenInfo?.symbol || 'UNKNOWN'
          };
        })
      );

      return balances;

    } catch (error) {
      logger.error(`Error getting multiple token balances on chain ${chainId}:`, error);
      return [];
    }
  }

  async waitForTransaction(
    chainId: number,
    txHash: string,
    confirmations: number = 1
  ): Promise<ethers.ContractReceipt> {
    try {
      const provider = await this.getProvider(chainId);
      return await provider.waitForTransaction(txHash, confirmations);
    } catch (error) {
      logger.error(`Error waiting for transaction ${txHash} on chain ${chainId}:`, error);
      throw error;
    }
  }

  async estimateGas(
    chainId: number,
    transaction: ethers.providers.TransactionRequest
  ): Promise<ethers.BigNumber> {
    try {
      const provider = await this.getProvider(chainId);
      return await provider.estimateGas(transaction);
    } catch (error) {
      logger.error(`Error estimating gas for transaction on chain ${chainId}:`, error);
      throw error;
    }
  }

  isChainSupported(chainId: number): boolean {
    return this.chainConfigs.has(chainId);
  }

  getChainIdByName(chainName: string): number | null {
    for (const [chainId, config] of this.chainConfigs) {
      if (config.name.toLowerCase().includes(chainName.toLowerCase()) ||
          config.shortName.toLowerCase() === chainName.toLowerCase()) {
        return chainId;
      }
    }
    return null;
  }

  async addCustomToken(chainId: number, tokenInfo: TokenInfo): Promise<void> {
    try {
      // Validate token by fetching its details
      const provider = await this.getProvider(chainId);
      const tokenContract = new ethers.Contract(
        tokenInfo.address,
        [
          'function name() external view returns (string)',
          'function symbol() external view returns (string)',
          'function decimals() external view returns (uint8)'
        ],
        provider
      );

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      const validatedToken: TokenInfo = {
        ...tokenInfo,
        name: name,
        symbol: symbol,
        decimals: decimals,
        chainId: chainId
      };

      // Add to supported tokens
      const existingTokens = this.supportedTokens.get(chainId) || [];
      const updatedTokens = [...existingTokens, validatedToken];
      this.supportedTokens.set(chainId, updatedTokens);

      logger.info(`Custom token added: ${symbol} (${tokenInfo.address}) on chain ${chainId}`);

    } catch (error) {
      logger.error(`Error adding custom token ${tokenInfo.address} on chain ${chainId}:`, error);
      throw new Error(`Failed to add custom token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getNetworkStats(chainId: number): Promise<{
    blockNumber: number;
    gasPrice: GasPrice;
    avgBlockTime: number;
    chainId: number;
    chainName: string;
  }> {
    try {
      const provider = await this.getProvider(chainId);
      const chainInfo = this.getChainInfo(chainId);
      
      const [blockNumber, gasPrice] = await Promise.all([
        provider.getBlockNumber(),
        this.getCurrentGasPrice(chainId)
      ]);

      // Get average block time (simplified)
      const avgBlockTime = this.getAverageBlockTime(chainId);

      return {
        blockNumber,
        gasPrice,
        avgBlockTime,
        chainId,
        chainName: chainInfo?.name || 'Unknown'
      };

    } catch (error) {
      logger.error(`Error getting network stats for chain ${chainId}:`, error);
      throw error;
    }
  }

  private getAverageBlockTime(chainId: number): number {
    // Average block times in seconds for major chains
    const blockTimes: Record<number, number> = {
      1: 12,    // Ethereum
      137: 2,   // Polygon
      42161: 1, // Arbitrum
      10: 2,    // Optimism
      8453: 2,  // Base
      43114: 2  // Avalanche
    };

    return blockTimes[chainId] || 12;
  }
}
