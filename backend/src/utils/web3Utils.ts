import { ethers } from 'ethers';
import { logger } from './logger';

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL!,
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL!,
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: process.env.ARBITRUM_RPC_URL!,
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: process.env.OPTIMISM_RPC_URL!,
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL!,
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  }
};

export function isValidEthereumAddress(address: string): boolean {
  return ethers.utils.isAddress(address);
}

export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function normalizeAddress(address: string): string {
  if (!isValidEthereumAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return ethers.utils.getAddress(address);
}

export function parseEther(value: string): ethers.BigNumber {
  try {
    return ethers.utils.parseEther(value);
  } catch (error) {
    throw new Error(`Invalid ether value: ${value}`);
  }
}

export function formatEther(value: ethers.BigNumber | string): string {
  try {
    return ethers.utils.formatEther(value);
  } catch (error) {
    throw new Error(`Invalid BigNumber value: ${value}`);
  }
}

export function parseUnits(value: string, decimals: number): ethers.BigNumber {
  try {
    return ethers.utils.parseUnits(value, decimals);
  } catch (error) {
    throw new Error(`Invalid units value: ${value} with decimals: ${decimals}`);
  }
}

export function formatUnits(value: ethers.BigNumber | string, decimals: number): string {
  try {
    return ethers.utils.formatUnits(value, decimals);
  } catch (error) {
    throw new Error(`Invalid units value: ${value} with decimals: ${decimals}`);
  }
}

export function getProvider(network: string): ethers.providers.JsonRpcProvider {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  return new ethers.providers.JsonRpcProvider(config.rpcUrl);
}

export async function getBalance(
  address: string, 
  provider: ethers.providers.Provider
): Promise<string> {
  try {
    if (!isValidEthereumAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }
    
    const balance = await provider.getBalance(address);
    return formatEther(balance);
  } catch (error) {
    logger.error(`Error getting balance for ${address}:`, error);
    throw new Error(`Failed to get balance for address: ${address}`);
  }
}

export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  provider: ethers.providers.Provider
): Promise<{ balance: string; decimals: number; symbol: string }> {
  try {
    if (!isValidEthereumAddress(tokenAddress) || !isValidEthereumAddress(walletAddress)) {
      throw new Error('Invalid token or wallet address');
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ],
      provider
    );

    const [balance, decimals, symbol] = await Promise.all([
      tokenContract.balanceOf(walletAddress),
      tokenContract.decimals(),
      tokenContract.symbol()
    ]);

    return {
      balance: formatUnits(balance, decimals),
      decimals,
      symbol
    };
  } catch (error) {
    logger.error(`Error getting token balance:`, error);
    throw new Error(`Failed to get token balance`);
  }
}

export async function estimateGas(
  transaction: ethers.providers.TransactionRequest,
  provider: ethers.providers.Provider
): Promise<ethers.BigNumber> {
  try {
    return await provider.estimateGas(transaction);
  } catch (error) {
    logger.error('Error estimating gas:', error);
    throw new Error('Failed to estimate gas');
  }
}

export async function getTransactionReceipt(
  txHash: string,
  provider: ethers.providers.Provider
): Promise<ethers.providers.TransactionReceipt | null> {
  try {
    if (!isValidTransactionHash(txHash)) {
      throw new Error(`Invalid transaction hash: ${txHash}`);
    }
    
    return await provider.getTransactionReceipt(txHash);
  } catch (error) {
    logger.error(`Error getting transaction receipt for ${txHash}:`, error);
    throw new Error(`Failed to get transaction receipt`);
  }
}

export async function waitForTransaction(
  txHash: string,
  provider: ethers.providers.Provider,
  confirmations: number = 1,
  timeout?: number
): Promise<ethers.providers.TransactionReceipt> {
  try {
    if (!isValidTransactionHash(txHash)) {
      throw new Error(`Invalid transaction hash: ${txHash}`);
    }
    
    return await provider.waitForTransaction(txHash, confirmations, timeout);
  } catch (error) {
    logger.error(`Error waiting for transaction ${txHash}:`, error);
    throw new Error(`Failed to wait for transaction`);
  }
}

export function calculateContractAddress(deployerAddress: string, nonce: number): string {
  try {
    if (!isValidEthereumAddress(deployerAddress)) {
      throw new Error(`Invalid deployer address: ${deployerAddress}`);
    }
    
    return ethers.utils.getContractAddress({ from: deployerAddress, nonce });
  } catch (error) {
    throw new Error(`Failed to calculate contract address`);
  }
}

export function keccak256(data: string | ethers.utils.Bytes): string {
  try {
    return ethers.utils.keccak256(data);
  } catch (error) {
    throw new Error('Failed to calculate keccak256 hash');
  }
}

export function solidityPack(types: string[], values: any[]): string {
  try {
    return ethers.utils.solidityPack(types, values);
  } catch (error) {
    throw new Error('Failed to pack solidity values');
  }
}

export function verifyMessage(message: string, signature: string): string {
  try {
    return ethers.utils.verifyMessage(message, signature);
  } catch (error) {
    throw new Error('Failed to verify message signature');
  }
}

export function getChainIdFromNetwork(network: string): number {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return config.chainId;
}

export function getNetworkFromChainId(chainId: number): string {
  const network = Object.entries(NETWORKS).find(([_, config]) => config.chainId === chainId);
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return network[0];
}

export async function getCurrentBlockNumber(provider: ethers.providers.Provider): Promise<number> {
  try {
    return await provider.getBlockNumber();
  } catch (error) {
    logger.error('Error getting current block number:', error);
    throw new Error('Failed to get current block number');
  }
}

export async function getBlock(
  blockHashOrNumber: string | number,
  provider: ethers.providers.Provider
): Promise<ethers.providers.Block> {
  try {
    return await provider.getBlock(blockHashOrNumber);
  } catch (error) {
    logger.error(`Error getting block ${blockHashOrNumber}:`, error);
    throw new Error('Failed to get block');
  }
}
