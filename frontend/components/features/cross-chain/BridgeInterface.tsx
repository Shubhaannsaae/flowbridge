// FlowBridge Frontend - Bridge Interface Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useCrossChain, useCrossChainTokens } from '../../../hooks/useCrossChain';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import ChainSelector from './ChainSelector';
import { formatUSDValue, formatTokenAmount } from '../../../utils/formatters';
import { parseTokenAmount, isValidAddress } from '../../../utils/web3';
import { SUPPORTED_CHAINS } from '../../../utils/constants';
import { cn } from '../../../utils/formatters';
import type { BridgeQuote, CrossChainRequest } from '../../../types';

interface BridgeInterfaceProps {
  className?: string;
}

interface BridgeForm {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  amount: string;
  recipient: string;
}

const BridgeInterface: React.FC<BridgeInterfaceProps> = ({ className }) => {
  const { account, chainId, provider } = useMetaMask();
  const { 
    getQuote, 
    initiateBridge, 
    getBestQuote,
    validateBridgeRequest,
    estimateBridgeTime 
  } = useCrossChain();
  
  const { success: showSuccess, error: showError } = useToastNotification();

  const [bridgeForm, setBridgeForm] = useState<BridgeForm>({
    fromChain: chainId || SUPPORTED_CHAINS.ETHEREUM,
    toChain: SUPPORTED_CHAINS.POLYGON,
    fromToken: '',
    toToken: '',
    amount: '',
    recipient: '',
  });

  const [quotes, setQuotes] = useState<BridgeQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<BridgeQuote | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get available tokens for selected chains
  const { tokens: fromTokens, loading: fromTokensLoading } = useCrossChainTokens(bridgeForm.fromChain);
  const { tokens: toTokens, loading: toTokensLoading } = useCrossChainTokens(bridgeForm.toChain);

  // Default token list if API tokens not available
  const defaultTokens = [
    { address: '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  ];

  const availableFromTokens = fromTokens.length > 0 ? fromTokens : defaultTokens;
  const availableToTokens = toTokens.length > 0 ? toTokens : defaultTokens;

  // Update form when wallet chain changes
  useEffect(() => {
    if (chainId && chainId !== bridgeForm.fromChain) {
      setBridgeForm(prev => ({ ...prev, fromChain: chainId }));
    }
  }, [chainId]);

  // Set recipient to current account by default
  useEffect(() => {
    if (account && !bridgeForm.recipient) {
      setBridgeForm(prev => ({ ...prev, recipient: account }));
    }
  }, [account, bridgeForm.recipient]);

  // Get bridge quotes
  const handleGetQuotes = async () => {
    const validationError = validateBridgeRequest({
      sourceChain: bridgeForm.fromChain,
      destinationChain: bridgeForm.toChain,
      sourceToken: bridgeForm.fromToken,
      destinationToken: bridgeForm.toToken,
      amount: parseTokenAmount(bridgeForm.amount, 18),
      recipient: bridgeForm.recipient,
      deadline: Date.now() + 1800000, // 30 minutes
    });

    if (validationError) {
      showError('Invalid Bridge Request', validationError);
      return;
    }

    setQuotesLoading(true);
    setQuotes([]);
    setSelectedQuote(null);

    try {
      const bridgeQuotes = await getQuote({
        sourceChain: bridgeForm.fromChain,
        destinationChain: bridgeForm.toChain,
        sourceToken: bridgeForm.fromToken,
        destinationToken: bridgeForm.toToken,
        amount: parseTokenAmount(bridgeForm.amount, 18),
        recipient: bridgeForm.recipient,
        deadline: Date.now() + 1800000,
      });

      setQuotes(bridgeQuotes);
      
      if (bridgeQuotes.length > 0) {
        const bestQuote = getBestQuote(bridgeQuotes);
        setSelectedQuote(bestQuote);
        showSuccess('Quotes Retrieved', `Found ${bridgeQuotes.length} bridge routes`);
      } else {
        showError('No Routes Found', 'No bridge routes available for this token pair');
      }
    } catch (error: any) {
      showError('Quote Failed', error.message);
    } finally {
      setQuotesLoading(false);
    }
  };

  // Execute bridge transaction
  const handleBridge = async () => {
    if (!selectedQuote || !provider || !account) {
      showError('Missing Requirements', 'Please select a quote and connect your wallet');
      return;
    }

    setBridging(true);

    try {
      const transactionId = await initiateBridge(selectedQuote.route, {
        slippageTolerance: 0.5, // 0.5%
        deadline: Date.now() + 1800000, // 30 minutes
      });

      showSuccess(
        'Bridge Initiated',
        `Bridge transaction initiated. Transaction ID: ${transactionId}`
      );

      // Reset form
      setBridgeForm(prev => ({
        ...prev,
        amount: '',
        fromToken: '',
        toToken: '',
      }));
      setQuotes([]);
      setSelectedQuote(null);

    } catch (error: any) {
      showError('Bridge Failed', error.message);
    } finally {
      setBridging(false);
    }
  };

  // Swap from and to chains
  const handleSwapChains = () => {
    setBridgeForm(prev => ({
      ...prev,
      fromChain: prev.toChain,
      toChain: prev.fromChain,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
    }));
    setQuotes([]);
    setSelectedQuote(null);
  };

  // Get estimated bridge time
  const getEstimatedTime = () => {
    if (selectedQuote) {
      return selectedQuote.estimatedTime;
    }
    return estimateBridgeTime(bridgeForm.fromChain, bridgeForm.toChain);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Cross-Chain Bridge</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Transfer assets between different blockchain networks using LI.FI
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Chain Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">From Network</label>
            <ChainSelector
              selectedChain={bridgeForm.fromChain}
              onChainSelect={(chainId) => setBridgeForm(prev => ({ ...prev, fromChain: chainId }))}
              excludeChains={[bridgeForm.toChain]}
              title=""
              description=""
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium mb-2">To Network</label>
            <ChainSelector
              selectedChain={bridgeForm.toChain}
              onChainSelect={(chainId) => setBridgeForm(prev => ({ ...prev, toChain: chainId }))}
              excludeChains={[bridgeForm.fromChain]}
              title=""
              description=""
            />
            
            {/* Swap Button */}
            <button
              onClick={handleSwapChains}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 p-2 bg-background border border-border rounded-full hover:bg-accent transition-colors lg:block hidden"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Token and Amount Selection */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* From Token */}
            <div>
              <label className="block text-sm font-medium mb-2">From Token</label>
              {fromTokensLoading ? (
                <Skeleton height="40px" />
              ) : (
                <select
                  value={bridgeForm.fromToken}
                  onChange={(e) => setBridgeForm(prev => ({ ...prev, fromToken: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Select token</option>
                  {availableFromTokens.map(token => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* To Token */}
            <div>
              <label className="block text-sm font-medium mb-2">To Token</label>
              {toTokensLoading ? (
                <Skeleton height="40px" />
              ) : (
                <select
                  value={bridgeForm.toToken}
                  onChange={(e) => setBridgeForm(prev => ({ ...prev, toToken: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Select token</option>
                  {availableToTokens.map(token => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="number"
              value={bridgeForm.amount}
              onChange={(e) => setBridgeForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              min="0"
              step="0.000001"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          {/* Advanced Options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg 
                className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-90')} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Advanced Options</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 border border-border rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Recipient Address</label>
                  <input
                    type="text"
                    value={bridgeForm.recipient}
                    onChange={(e) => setBridgeForm(prev => ({ ...prev, recipient: e.target.value }))}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use your connected wallet address
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Get Quotes Button */}
        <Button
          onClick={handleGetQuotes}
          loading={quotesLoading}
          disabled={!bridgeForm.fromChain || !bridgeForm.toChain || !bridgeForm.fromToken || !bridgeForm.toToken || !bridgeForm.amount}
          className="w-full"
          size="lg"
        >
          Get Bridge Quotes
        </Button>

        {/* Bridge Quotes */}
        {quotes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quotes.map((quote, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedQuote(quote)}
                    className={cn(
                      'w-full p-4 rounded-lg border text-left transition-all',
                      selectedQuote === quote
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{quote.bridgeProvider}</div>
                      <div className="flex items-center space-x-2">
                        {selectedQuote === quote && (
                          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span className="text-sm font-medium">{formatUSDValue(quote.fee)} fee</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Estimated Time:</span>
                        <span className="ml-1 font-medium">{quote.estimatedTime} min</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min Received:</span>
                        <span className="ml-1 font-medium">{formatTokenAmount(quote.minReceived)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gas:</span>
                        <span className="ml-1 font-medium">{formatUSDValue(quote.gasEstimate.toString())}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedQuote && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-3">Bridge Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Bridge Provider:</span>
                      <span className="font-medium">{selectedQuote.bridgeProvider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Time:</span>
                      <span className="font-medium">{getEstimatedTime()} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bridge Fee:</span>
                      <span className="font-medium">{formatUSDValue(selectedQuote.fee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gas Estimate:</span>
                      <span className="font-medium">{formatUSDValue(selectedQuote.gasEstimate.toString())}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>You will receive (min):</span>
                      <span className="font-medium text-green-600">
                        {formatTokenAmount(selectedQuote.minReceived)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleBridge}
                loading={bridging}
                disabled={!selectedQuote}
                className="w-full mt-4"
                size="lg"
                variant="gradient"
              >
                Execute Bridge
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bridge Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Bridge transactions are irreversible once initiated</p>
          <p>• Fees are paid in the source chain's native token</p>
          <p>• Cross-chain transfers may take several minutes to complete</p>
          <p>• Always verify the recipient address before proceeding</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BridgeInterface;
