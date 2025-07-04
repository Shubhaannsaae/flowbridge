import { ethers } from 'ethers';
import { logger } from '../utils/logger';

export interface BlockchainNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  wsUrl?: string;
  blockExplorer: string;
  multicallAddress: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  gasLimit: {
    default: number;
    erc20Transfer: number;
    contractInteraction: number;
  };
}

export const BLOCKCHAIN_NETWORKS: Record<string, BlockchainNetwork> = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL!,
    wsUrl: process.env.ETHEREUM_WS_URL,
    blockExplorer: 'https://etherscan.io',
    multicallAddress: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    gasLimit: {
      default: 21000,
      erc20Transfer: 65000,
      contractInteraction: 200000
    }
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL!,
    wsUrl: process.env.POLYGON_WS_URL,
    blockExplorer: 'https://polygonscan.com',
    multicallAddress: '0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    gasLimit: {
      default: 21000,
      erc20Transfer: 65000,
      contractInteraction: 200000
    }
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL!,
    wsUrl: process.env.ARBITRUM_WS_URL,
    blockExplorer: 'https://arbiscan.io',
    multicallAddress: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    gasLimit: {
      default: 21000,
      erc20Transfer: 65000,
      contractInteraction: 300000
    }
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: process.env.OPTIMISM_RPC_URL!,
    wsUrl: process.env.OPTIMISM_WS_URL,
    blockExplorer: 'https://optimistic.etherscan.io',
    multicallAddress: '0x2DC0E2aa608532Da689e89e237dF582B783E552C',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    gasLimit: {
      default: 21000,
      erc20Transfer: 65000,
      contractInteraction: 200000
    }
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL!,
    wsUrl: process.env.BASE_WS_URL,
    blockExplorer: 'https://basescan.org',
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    gasLimit: {
      default: 21000,
      erc20Transfer: 65000,
      contractInteraction: 200000
    }
  }
};

class BlockchainConfig {
  private providers: Map<string, ethers.providers.JsonRpcProvider> = new Map();
  private wsProviders: Map<string, ethers.providers.WebSocketProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const [network, config] of Object.entries(BLOCKCHAIN_NETWORKS)) {
      try {
        // Initialize HTTP provider
        const provider = new ethers.providers.JsonRpcProvider({
          url: config.rpcUrl,
          timeout: 30000
        });
        this.providers.set(network, provider);

        // Initialize WebSocket provider if URL is provided
        if (config.wsUrl) {
          const wsProvider = new ethers.providers.WebSocketProvider(config.wsUrl);
          this.wsProviders.set(network, wsProvider);
        }

        logger.info(`Initialized providers for ${network} (Chain ID: ${config.chainId})`);
      } catch (error) {
        logger.error(`Failed to initialize provider for ${network}:`, error);
      }
    }
  }

  getProvider(network: string): ethers.providers.JsonRpcProvider {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new Error(`Provider not found for network: ${network}`);
    }
    return provider;
  }

  getWebSocketProvider(network: string): ethers.providers.WebSocketProvider {
    const wsProvider = this.wsProviders.get(network);
    if (!wsProvider) {
      throw new Error(`WebSocket provider not found for network: ${network}`);
    }
    return wsProvider;
  }

  getNetworkConfig(network: string): BlockchainNetwork {
    const config = BLOCKCHAIN_NETWORKS[network];
    if (!config) {
      throw new Error(`Network configuration not found: ${network}`);
    }
    return config;
  }

  getAllNetworks(): string[] {
    return Object.keys(BLOCKCHAIN_NETWORKS);
  }

  getChainId(network: string): number {
    return this.getNetworkConfig(network).chainId;
  }

  getNetworkByChainId(chainId: number): string {
    const network = Object.entries(BLOCKCHAIN_NETWORKS).find(
      ([_, config]) => config.chainId === chainId
    );
    if (!network) {
      throw new Error(`Network not found for chain ID: ${chainId}`);
    }
    return network[0];
  }

  async checkProviderHealth(network: string): Promise<boolean> {
    try {
      const provider = this.getProvider(network);
      await provider.getBlockNumber();
      return true;
    } catch (error) {
      logger.error(`Health check failed for ${network}:`, error);
      return false;
    }
  }

  async checkAllProvidersHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.allSettled(
      this.getAllNetworks().map(async (network) => {
        results[network] = await this.checkProviderHealth(network);
      })
    );

    return results;
  }

  async getGasPrice(network: string): Promise<ethers.BigNumber> {
    const provider = this.getProvider(network);
    return await provider.getGasPrice();
  }

  async getFeeData(network: string): Promise<ethers.providers.FeeData> {
    const provider = this.getProvider(network);
    return await provider.getFeeData();
  }

  async getBlockNumber(network: string): Promise<number> {
    const provider = this.getProvider(network);
    return await provider.getBlockNumber();
  }

  async estimateGas(
    network: string,
    transaction: ethers.providers.TransactionRequest
  ): Promise<ethers.BigNumber> {
    const provider = this.getProvider(network);
    return await provider.estimateGas(transaction);
  }

  async getBalance(network: string, address: string): Promise<ethers.BigNumber> {
    const provider = this.getProvider(network);
    return await provider.getBalance(address);
  }

  async getTransactionReceipt(
    network: string,
    txHash: string
  ): Promise<ethers.providers.TransactionReceipt | null> {
    const provider = this.getProvider(network);
    return await provider.getTransactionReceipt(txHash);
  }

  async waitForTransaction(
    network: string,
    txHash: string,
    confirmations: number = 1,
    timeout?: number
  ): Promise<ethers.providers.TransactionReceipt> {
    const provider = this.getProvider(network);
    return await provider.waitForTransaction(txHash, confirmations, timeout);
  }

  async reconnectProvider(network: string): Promise<void> {
    try {
      const config = this.getNetworkConfig(network);
      
      // Close existing provider if it exists
      const existingProvider = this.providers.get(network);
      if (existingProvider) {
        // @ts-ignore - provider may have removeAllListeners method
        if (typeof existingProvider.removeAllListeners === 'function') {
          existingProvider.removeAllListeners();
        }
      }

      // Create new provider
      const newProvider = new ethers.providers.JsonRpcProvider({
        url: config.rpcUrl,
        timeout: 30000
      });
      
      this.providers.set(network, newProvider);
      
      // Test the connection
      await newProvider.getBlockNumber();
      
      logger.info(`Reconnected provider for ${network}`);
    } catch (error) {
      logger.error(`Failed to reconnect provider for ${network}:`, error);
      throw error;
    }
  }

  cleanup(): void {
    // Close WebSocket connections
    for (const [network, wsProvider] of this.wsProviders) {
      try {
        wsProvider.removeAllListeners();
        // @ts-ignore - WebSocket provider may have destroy method
        if (typeof wsProvider.destroy === 'function') {
          wsProvider.destroy();
        }
        logger.info(`Closed WebSocket provider for ${network}`);
      } catch (error) {
        logger.error(`Error closing WebSocket provider for ${network}:`, error);
      }
    }

    // Clear providers
    this.providers.clear();
    this.wsProviders.clear();
  }
}

// Export singleton instance
export const blockchainConfig = new BlockchainConfig();

// Contract ABIs for common interactions
export const COMMON_ABIS = {
  ERC20: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
  ],
  MULTICALL: [
    'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
    'function blockAndAggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)',
    'function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)',
    'function getBlockNumber() view returns (uint256 blockNumber)',
    'function getCurrentBlockCoinbase() view returns (address coinbase)',
    'function getCurrentBlockDifficulty() view returns (uint256 difficulty)',
    'function getCurrentBlockGasLimit() view returns (uint256 gaslimit)',
    'function getCurrentBlockTimestamp() view returns (uint256 timestamp)',
    'function getEthBalance(address addr) view returns (uint256 balance)',
    'function getLastBlockHash() view returns (bytes32 blockHash)',
    'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    'function tryBlockAndAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)'
  ]
};

export default blockchainConfig;
