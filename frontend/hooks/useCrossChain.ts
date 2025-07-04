// FlowBridge Frontend - Cross-Chain Operations Hook
import { useState, useEffect, useCallback } from 'react';
import { LiFi, ConfigUpdate } from '@lifi/sdk';
import { useMetaMask } from './useMetaMask';
import { bridgeAPI } from '../utils/api';
import { SUPPORTED_CHAINS } from '../utils/constants';

interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  iconUrl?: string;
  isTestnet: boolean;
}

interface BridgeRoute {
  id: string;
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  minReceived: string;
  estimatedTime: number;
  fee: string;
  gasEstimate: bigint;
  bridgeProvider: string;
  steps: any[];
}

interface BridgeQuote {
  route: BridgeRoute;
  bridgeProvider: string;
  estimatedTime: number;
  fee: string;
  minReceived: string;
  gasEstimate: bigint;
  confidence: number;
}

interface CrossChainRequest {
  sourceChain: number;
  destinationChain: number;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  recipient: string;
  deadline: number;
}

interface BridgeStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sourceTransactionHash?: string;
  destinationTransactionHash?: string;
  progress: number;
  estimatedCompletionTime: number;
  errorMessage?: string;
}

interface UseCrossChainReturn {
  // Network management
  supportedChains: NetworkConfig[];
  currentChain: NetworkConfig | null;
  
  // Bridge operations
  getQuote: (request: CrossChainRequest) => Promise<BridgeQuote[]>;
  getBestQuote: (quotes: BridgeQuote[]) => BridgeQuote;
  initiateBridge: (route: BridgeRoute, options: any) => Promise<string>;
  trackBridgeStatus: (transactionId: string) => Promise<BridgeStatusResponse>;
  
  // Validation
  validateBridgeRequest: (request: CrossChainRequest) => string | null;
  estimateBridgeTime: (fromChain: number, toChain: number) => number;
  
  // Loading states
  quotesLoading: boolean;
  bridgeLoading: boolean;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

// Initialize LiFi SDK
const lifi = new LiFi({
  integrator: 'flowbridge',
  apiUrl: 'https://li.quest/v1',
  rpcUrls: {
    [SUPPORTED_CHAINS.ETHEREUM]: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/' + process.env.NEXT_PUBLIC_INFURA_KEY,
    [SUPPORTED_CHAINS.POLYGON]: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/' + process.env.NEXT_PUBLIC_INFURA_KEY,
    [SUPPORTED_CHAINS.ARBITRUM]: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arbitrum-mainnet.infura.io/v3/' + process.env.NEXT_PUBLIC_INFURA_KEY,
    [SUPPORTED_CHAINS.OPTIMISM]: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL || 'https://optimism-mainnet.infura.io/v3/' + process.env.NEXT_PUBLIC_INFURA_KEY,
  },
});

export function useCrossChain(): UseCrossChainReturn {
  const { chainId, provider, isConnected } = useMetaMask();
  
  const [supportedChains, setSupportedChains] = useState<NetworkConfig[]>([]);
  const [currentChain, setCurrentChain] = useState<NetworkConfig | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load supported chains from LiFi
  useEffect(() => {
    const loadChains = async () => {
      try {
        const chains = await lifi.getChains();
        const formattedChains: NetworkConfig[] = chains.map(chain => ({
          chainId: chain.id,
          name: chain.name,
          symbol: chain.nativeCurrency.symbol,
          rpcUrl: chain.metamask.rpcUrls[0],
          blockExplorerUrl: chain.metamask.blockExplorerUrls[0],
          iconUrl: chain.logoURI,
          isTestnet: chain.id > 1000, // Simple testnet detection
        }));
        
        setSupportedChains(formattedChains);
      } catch (err) {
        console.error('Failed to load chains:', err);
      }
    };

    loadChains();
  }, []);

  // Update current chain when wallet chain changes
  useEffect(() => {
    if (chainId && supportedChains.length > 0) {
      const chain = supportedChains.find(c => c.chainId === chainId);
      setCurrentChain(chain || null);
    }
  }, [chainId, supportedChains]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Validate bridge request
  const validateBridgeRequest = useCallback((request: CrossChainRequest): string | null => {
    if (request.sourceChain === request.destinationChain) {
      return 'Source and destination chains must be different';
    }

    if (!supportedChains.find(c => c.chainId === request.sourceChain)) {
      return 'Source chain not supported';
    }

    if (!supportedChains.find(c => c.chainId === request.destinationChain)) {
      return 'Destination chain not supported';
    }

    if (!request.sourceToken || !request.destinationToken) {
      return 'Source and destination tokens are required';
    }

    if (!request.amount || parseFloat(request.amount) <= 0) {
      return 'Amount must be greater than 0';
    }

    if (!request.recipient || request.recipient.length !== 42) {
      return 'Valid recipient address is required';
    }

    if (request.deadline <= Date.now()) {
      return 'Deadline must be in the future';
    }

    return null;
  }, [supportedChains]);

  // Get bridge quotes using LiFi
  const getQuote = useCallback(async (request: CrossChainRequest): Promise<BridgeQuote[]> => {
    const validationError = validateBridgeRequest(request);
    if (validationError) {
      throw new Error(validationError);
    }

    setQuotesLoading(true);
    setError(null);

    try {
      const routeRequest = {
        fromChainId: request.sourceChain,
        toChainId: request.destinationChain,
        fromTokenAddress: request.sourceToken,
        toTokenAddress: request.destinationToken,
        fromAmount: request.amount,
        fromAddress: request.recipient,
        toAddress: request.recipient,
        options: {
          slippage: 0.005, // 0.5%
          maxPriceImpact: 0.4, // 40%
          allowSwitchChain: false,
        },
      };

      const routesResponse = await lifi.getRoutes(routeRequest);
      
      if (!routesResponse.routes || routesResponse.routes.length === 0) {
        throw new Error('No bridge routes found for this token pair');
      }

      const quotes: BridgeQuote[] = routesResponse.routes.map(route => ({
        route: {
          id: route.id,
          fromChain: route.fromChainId,
          toChain: route.toChainId,
          fromToken: route.fromToken.address,
          toToken: route.toToken.address,
          fromAmount: route.fromAmount,
          toAmount: route.toAmount,
          minReceived: route.toAmountMin,
          estimatedTime: Math.ceil(route.steps.reduce((total, step) => total + (step.estimate.executionDuration || 0), 0) / 60),
          fee: route.gasCostUSD || '0',
          gasEstimate: BigInt(route.steps.reduce((total, step) => total + parseInt(step.estimate.gasCosts?.[0]?.estimate || '0'), 0)),
          bridgeProvider: route.steps[0].toolDetails.name,
          steps: route.steps,
        },
        bridgeProvider: route.steps[0].toolDetails.name,
        estimatedTime: Math.ceil(route.steps.reduce((total, step) => total + (step.estimate.executionDuration || 0), 0) / 60),
        fee: route.gasCostUSD || '0',
        minReceived: route.toAmountMin,
        gasEstimate: BigInt(route.steps.reduce((total, step) => total + parseInt(step.estimate.gasCosts?.[0]?.estimate || '0'), 0)),
        confidence: 0.9 - (parseFloat(route.gasCostUSD || '0') / 100), // Simple confidence calculation
      }));

      return quotes;
    } catch (err: any) {
      console.error('Error getting bridge quotes:', err);
      setError(err.message || 'Failed to get bridge quotes');
      throw err;
    } finally {
      setQuotesLoading(false);
    }
  }, [validateBridgeRequest]);

  // Get best quote from available options
  const getBestQuote = useCallback((quotes: BridgeQuote[]): BridgeQuote => {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }

    // Score quotes based on multiple factors
    const scoredQuotes = quotes.map(quote => {
      const feeScore = 1 / (parseFloat(quote.fee) + 1); // Lower fee is better
      const timeScore = 1 / (quote.estimatedTime + 1); // Faster is better
      const confidenceScore = quote.confidence; // Higher confidence is better
      const totalScore = (feeScore * 0.4) + (timeScore * 0.3) + (confidenceScore * 0.3);
      
      return { quote, score: totalScore };
    });

    // Sort by score and return the best
    scoredQuotes.sort((a, b) => b.score - a.score);
    return scoredQuotes[0].quote;
  }, []);

  // Initiate bridge transaction using LiFi
  const initiateBridge = useCallback(async (route: BridgeRoute, options: {
    slippageTolerance: number;
    deadline: number;
  }): Promise<string> => {
    if (!provider || !isConnected) {
      throw new Error('Wallet not connected');
    }

    setBridgeLoading(true);
    setError(null);

    try {
      // Execute the route using LiFi SDK
      const execution = await lifi.executeRoute(provider.getSigner(), route as any, {
        updateCallback: (update) => {
          console.log('Bridge progress:', update);
        },
      });

      return execution.executionData.transactionHash;
    } catch (err: any) {
      console.error('Bridge execution failed:', err);
      setError(err.message || 'Bridge transaction failed');
      throw err;
    } finally {
      setBridgeLoading(false);
    }
  }, [provider, isConnected]);

  // Track bridge transaction status
  const trackBridgeStatus = useCallback(async (transactionId: string): Promise<BridgeStatusResponse> => {
    try {
      const status = await lifi.getStatus({
        bridge: 'lifi', // Default bridge
        txHash: transactionId,
      });

      return {
        id: transactionId,
        status: status.status === 'DONE' ? 'completed' : 
                status.status === 'FAILED' ? 'failed' : 
                status.status === 'PENDING' ? 'pending' : 'processing',
        sourceTransactionHash: status.sending?.txHash,
        destinationTransactionHash: status.receiving?.txHash,
        progress: status.status === 'DONE' ? 100 : 
                 status.status === 'FAILED' ? 0 : 50,
        estimatedCompletionTime: 0, // Would calculate based on remaining time
        errorMessage: status.status === 'FAILED' ? 'Transaction failed' : undefined,
      };
    } catch (err: any) {
      console.error('Error tracking bridge status:', err);
      throw err;
    }
  }, []);

  // Estimate bridge time between chains
  const estimateBridgeTime = useCallback((fromChain: number, toChain: number): number => {
    // Base time estimates (in minutes)
    const baseTime: Record<string, number> = {
      [`${SUPPORTED_CHAINS.ETHEREUM}-${SUPPORTED_CHAINS.POLYGON}`]: 15,
      [`${SUPPORTED_CHAINS.ETHEREUM}-${SUPPORTED_CHAINS.ARBITRUM}`]: 10,
      [`${SUPPORTED_CHAINS.ETHEREUM}-${SUPPORTED_CHAINS.OPTIMISM}`]: 8,
      [`${SUPPORTED_CHAINS.POLYGON}-${SUPPORTED_CHAINS.ARBITRUM}`]: 20,
      [`${SUPPORTED_CHAINS.POLYGON}-${SUPPORTED_CHAINS.OPTIMISM}`]: 18,
      [`${SUPPORTED_CHAINS.ARBITRUM}-${SUPPORTED_CHAINS.OPTIMISM}`]: 12,
    };

    const key = `${fromChain}-${toChain}`;
    const reverseKey = `${toChain}-${fromChain}`;
    
    return baseTime[key] || baseTime[reverseKey] || 25; // Default 25 minutes
  }, []);

  return {
    // Network management
    supportedChains,
    currentChain,
    
    // Bridge operations
    getQuote,
    getBestQuote,
    initiateBridge,
    trackBridgeStatus,
    
    // Validation
    validateBridgeRequest,
    estimateBridgeTime,
    
    // Loading states
    quotesLoading,
    bridgeLoading,
    
    // Error handling
    error,
    clearError,
  };
}

// Hook for cross-chain token data
export function useCrossChainTokens(chainId: number) {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTokens = async () => {
      if (!chainId) return;

      setLoading(true);
      try {
        const tokensResponse = await lifi.getTokens({ chains: [chainId] });
        setTokens(tokensResponse.tokens[chainId] || []);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, [chainId]);

  return { tokens, loading };
}

export default useCrossChain;
