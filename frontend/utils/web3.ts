// FlowBridge Frontend - Web3 Utilities
import { ethers } from 'ethers';
import { SUPPORTED_CHAINS, CHAIN_CONFIG, RPC_URLS } from './constants';

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  try {
    return ethers.utils.isAddress(address);
  } catch {
    return false;
  }
}

// Format address for display
export function formatAddress(address: string, chars: number = 4): string {
  if (!isValidAddress(address)) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Get chain name from chain ID
export function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: 'Ethereum',
    [SUPPORTED_CHAINS.POLYGON]: 'Polygon',
    [SUPPORTED_CHAINS.ARBITRUM]: 'Arbitrum One',
    [SUPPORTED_CHAINS.OPTIMISM]: 'Optimism',
    [SUPPORTED_CHAINS.BASE]: 'Base',
    [SUPPORTED_CHAINS.LINEA]: 'Linea',
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
}

// Check if chain is supported
export function isSupportedChain(chainId: number): boolean {
  return Object.values(SUPPORTED_CHAINS).includes(chainId);
}

// Get provider for specific chain
export function getProvider(chainId: number): ethers.providers.JsonRpcProvider | null {
  const rpcUrl = RPC_URLS[chainId];
  if (!rpcUrl) return null;
  
  try {
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  } catch (error) {
    console.error(`Failed to create provider for chain ${chainId}:`, error);
    return null;
  }
}

// Parse token amount with decimals
export function parseTokenAmount(amount: string, decimals: number): string {
  try {
    return ethers.utils.parseUnits(amount, decimals).toString();
  } catch (error) {
    console.error('Error parsing token amount:', error);
    return '0';
  }
}

// Format token amount from wei
export function formatTokenAmount(amount: string, decimals: number): string {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
}

// Convert to wei
export function toWei(amount: string): string {
  try {
    return ethers.utils.parseEther(amount).toString();
  } catch (error) {
    console.error('Error converting to wei:', error);
    return '0';
  }
}

// Convert from wei
export function fromWei(amount: string): string {
  try {
    return ethers.utils.formatEther(amount);
  } catch (error) {
    console.error('Error converting from wei:', error);
    return '0';
  }
}

// Recover signer address from message and signature
export async function recoverMessageSigner(message: string, signature: string): Promise<string> {
  try {
    return ethers.utils.verifyMessage(message, signature);
  } catch (error) {
    console.error('Error recovering signer:', error);
    throw new Error('Invalid signature');
  }
}

// Get block explorer URL for transaction
export function getBlockExplorerUrl(chainId: number, txHash: string): string {
  const explorers: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: 'https://etherscan.io/tx/',
    [SUPPORTED_CHAINS.POLYGON]: 'https://polygonscan.com/tx/',
    [SUPPORTED_CHAINS.ARBITRUM]: 'https://arbiscan.io/tx/',
    [SUPPORTED_CHAINS.OPTIMISM]: 'https://optimistic.etherscan.io/tx/',
    [SUPPORTED_CHAINS.BASE]: 'https://basescan.org/tx/',
    [SUPPORTED_CHAINS.LINEA]: 'https://lineascan.build/tx/',
  };
  
  const baseUrl = explorers[chainId];
  return baseUrl ? `${baseUrl}${txHash}` : '#';
}

// Get block explorer URL for address
export function getAddressExplorerUrl(chainId: number, address: string): string {
  const explorers: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: 'https://etherscan.io/address/',
    [SUPPORTED_CHAINS.POLYGON]: 'https://polygonscan.com/address/',
    [SUPPORTED_CHAINS.ARBITRUM]: 'https://arbiscan.io/address/',
    [SUPPORTED_CHAINS.OPTIMISM]: 'https://optimistic.etherscan.io/address/',
    [SUPPORTED_CHAINS.BASE]: 'https://basescan.org/address/',
    [SUPPORTED_CHAINS.LINEA]: 'https://lineascan.build/address/',
  };
  
  const baseUrl = explorers[chainId];
  return baseUrl ? `${baseUrl}${address}` : '#';
}

// Calculate gas price with priority fee
export function calculateGasPrice(baseFee: string, priorityFee: string): string {
  try {
    const base = ethers.BigNumber.from(baseFee);
    const priority = ethers.BigNumber.from(priorityFee);
    return base.add(priority).toString();
  } catch (error) {
    console.error('Error calculating gas price:', error);
    return baseFee;
  }
}

// Estimate gas for transaction
export async function estimateGas(
  provider: ethers.providers.Provider,
  transaction: ethers.providers.TransactionRequest
): Promise<ethers.BigNumber> {
  try {
    return await provider.estimateGas(transaction);
  } catch (error) {
    console.error('Error estimating gas:', error);
    // Return a reasonable default
    return ethers.BigNumber.from('21000');
  }
}

// Wait for transaction confirmation
export async function waitForTransaction(
  provider: ethers.providers.Provider,
  txHash: string,
  confirmations: number = 1
): Promise<ethers.providers.TransactionReceipt> {
  try {
    return await provider.waitForTransaction(txHash, confirmations);
  } catch (error) {
    console.error('Error waiting for transaction:', error);
    throw error;
  }
}

// Get current gas prices
export async function getCurrentGasPrices(chainId: number): Promise<{
  slow: string;
  standard: string;
  fast: string;
}> {
  const provider = getProvider(chainId);
  if (!provider) {
    throw new Error('Provider not available for chain');
  }

  try {
    const gasPrice = await provider.getGasPrice();
    const baseFee = gasPrice;
    
    return {
      slow: ethers.utils.formatUnits(baseFee.mul(90).div(100), 'gwei'),
      standard: ethers.utils.formatUnits(baseFee, 'gwei'),
      fast: ethers.utils.formatUnits(baseFee.mul(110).div(100), 'gwei'),
    };
  } catch (error) {
    console.error('Error getting gas prices:', error);
    // Return reasonable defaults
    return {
      slow: '20',
      standard: '25',
      fast: '30',
    };
  }
}

// Validate transaction parameters
export function validateTransaction(tx: ethers.providers.TransactionRequest): string | null {
  if (!tx.to || !isValidAddress(tx.to)) {
    return 'Invalid recipient address';
  }
  
  if (!tx.value || ethers.BigNumber.from(tx.value).lte(0)) {
    return 'Invalid transaction value';
  }
  
  if (tx.gasLimit && ethers.BigNumber.from(tx.gasLimit).lt(21000)) {
    return 'Gas limit too low';
  }
  
  return null;
}

// Create contract instance
export function createContract(
  address: string,
  abi: any[],
  providerOrSigner: ethers.providers.Provider | ethers.Signer
): ethers.Contract {
  if (!isValidAddress(address)) {
    throw new Error('Invalid contract address');
  }
  
  return new ethers.Contract(address, abi, providerOrSigner);
}

// Get network configuration for MetaMask
export function getNetworkConfig(chainId: number): any {
  const config = CHAIN_CONFIG[chainId];
  if (!config) return null;
  
  return {
    chainId: `0x${chainId.toString(16)}`,
    chainName: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: [config.blockExplorerUrl],
  };
}

// Check if transaction is likely to succeed
export async function checkTransactionViability(
  provider: ethers.providers.Provider,
  transaction: ethers.providers.TransactionRequest
): Promise<{ viable: boolean; reason?: string }> {
  try {
    // Validate basic parameters
    const validationError = validateTransaction(transaction);
    if (validationError) {
      return { viable: false, reason: validationError };
    }
    
    // Check if sender has enough balance
    if (transaction.from) {
      const balance = await provider.getBalance(transaction.from);
      const value = ethers.BigNumber.from(transaction.value || 0);
      const gasLimit = ethers.BigNumber.from(transaction.gasLimit || 21000);
      const gasPrice = ethers.BigNumber.from(transaction.gasPrice || 0);
      const totalCost = value.add(gasLimit.mul(gasPrice));
      
      if (balance.lt(totalCost)) {
        return { viable: false, reason: 'Insufficient balance for transaction + gas' };
      }
    }
    
    // Try to estimate gas
    try {
      await estimateGas(provider, transaction);
    } catch (error) {
      return { viable: false, reason: 'Transaction would likely fail' };
    }
    
    return { viable: true };
  } catch (error) {
    console.error('Error checking transaction viability:', error);
    return { viable: false, reason: 'Unable to verify transaction' };
  }
}
