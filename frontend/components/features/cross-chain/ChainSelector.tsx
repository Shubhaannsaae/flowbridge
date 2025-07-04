// FlowBridge Frontend - Chain Selector Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useCrossChain } from '../../../hooks/useCrossChain';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { SUPPORTED_CHAINS, CHAIN_CONFIG } from '../../../utils/constants';
import { getChainName, isSupportedChain } from '../../../utils/web3';
import { cn } from '../../../utils/formatters';
import type { NetworkConfig } from '../../../types';

interface ChainSelectorProps {
  selectedChain?: number;
  onChainSelect?: (chainId: number) => void;
  excludeChains?: number[];
  title?: string;
  description?: string;
  className?: string;
}

const ChainSelector: React.FC<ChainSelectorProps> = ({
  selectedChain,
  onChainSelect,
  excludeChains = [],
  title = "Select Network",
  description = "Choose a blockchain network",
  className,
}) => {
  const { chainId, switchChain } = useMetaMask();
  const { supportedChains } = useCrossChain();
  const { success: showSuccess, error: showError } = useToastNotification();

  const [switching, setSwitching] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | undefined>(selectedChain);

  // Default supported chains if not loaded from API
  const defaultChains: NetworkConfig[] = [
    {
      chainId: SUPPORTED_CHAINS.ETHEREUM,
      name: 'Ethereum',
      symbol: 'ETH',
      rpcUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.ETHEREUM].rpcUrl,
      blockExplorerUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.ETHEREUM].blockExplorerUrl,
      iconUrl: '/images/chains/ethereum.svg',
      isTestnet: false,
    },
    {
      chainId: SUPPORTED_CHAINS.POLYGON,
      name: 'Polygon',
      symbol: 'MATIC',
      rpcUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.POLYGON].rpcUrl,
      blockExplorerUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.POLYGON].blockExplorerUrl,
      iconUrl: '/images/chains/polygon.svg',
      isTestnet: false,
    },
    {
      chainId: SUPPORTED_CHAINS.ARBITRUM,
      name: 'Arbitrum One',
      symbol: 'ETH',
      rpcUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.ARBITRUM].rpcUrl,
      blockExplorerUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.ARBITRUM].blockExplorerUrl,
      iconUrl: '/images/chains/arbitrum.svg',
      isTestnet: false,
    },
    {
      chainId: SUPPORTED_CHAINS.OPTIMISM,
      name: 'Optimism',
      symbol: 'ETH',
      rpcUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.OPTIMISM].rpcUrl,
      blockExplorerUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.OPTIMISM].blockExplorerUrl,
      iconUrl: '/images/chains/optimism.svg',
      isTestnet: false,
    },
    {
      chainId: SUPPORTED_CHAINS.BASE,
      name: 'Base',
      symbol: 'ETH',
      rpcUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.BASE].rpcUrl,
      blockExplorerUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.BASE].blockExplorerUrl,
      iconUrl: '/images/chains/base.svg',
      isTestnet: false,
    },
    {
      chainId: SUPPORTED_CHAINS.LINEA,
      name: 'Linea',
      symbol: 'ETH',
      rpcUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.LINEA].rpcUrl,
      blockExplorerUrl: CHAIN_CONFIG[SUPPORTED_CHAINS.LINEA].blockExplorerUrl,
      iconUrl: '/images/chains/linea.svg',
      isTestnet: false,
    },
  ];

  // Use supported chains from API or fallback to default
  const availableChains = supportedChains.length > 0 ? supportedChains : defaultChains;
  
  // Filter out excluded chains
  const filteredChains = availableChains.filter(
    chain => !excludeChains.includes(chain.chainId) && isSupportedChain(chain.chainId)
  );

  // Handle chain selection
  const handleChainSelect = async (targetChainId: number) => {
    if (targetChainId === selectedChainId) return;

    setSelectedChainId(targetChainId);
    onChainSelect?.(targetChainId);

    // If this is the wallet's current chain and it needs switching
    if (chainId !== targetChainId) {
      setSwitching(true);
      try {
        await switchChain(targetChainId);
        showSuccess('Network Switched', `Switched to ${getChainName(targetChainId)}`);
      } catch (error: any) {
        showError('Network Switch Failed', error.message);
        // Revert selection if switch failed
        setSelectedChainId(chainId);
        onChainSelect?.(chainId || SUPPORTED_CHAINS.ETHEREUM);
      } finally {
        setSwitching(false);
      }
    }
  };

  // Get chain icon
  const getChainIcon = (chain: NetworkConfig) => {
    const icons: Record<number, string> = {
      [SUPPORTED_CHAINS.ETHEREUM]: '⟠',
      [SUPPORTED_CHAINS.POLYGON]: '⬟',
      [SUPPORTED_CHAINS.ARBITRUM]: '🔵',
      [SUPPORTED_CHAINS.OPTIMISM]: '🔴',
      [SUPPORTED_CHAINS.BASE]: '🔷',
      [SUPPORTED_CHAINS.LINEA]: '📐',
    };
    
    return icons[chain.chainId] || '🌐';
  };

  // Get chain status
  const getChainStatus = (targetChainId: number) => {
    if (targetChainId === chainId) return 'current';
    if (targetChainId === selectedChainId) return 'selected';
    return 'available';
  };

  // Update selected chain when prop changes
  useEffect(() => {
    if (selectedChain !== undefined) {
      setSelectedChainId(selectedChain);
    }
  }, [selectedChain]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span>{title}</span>
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>

      <CardContent>
        {switching && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <LoadingSpinner size="lg" variant="primary" />
              <p className="text-sm text-muted-foreground mt-2">Switching network...</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredChains.map((chain) => {
            const status = getChainStatus(chain.chainId);
            const isSelected = chain.chainId === selectedChainId;
            const isCurrent = chain.chainId === chainId;

            return (
              <button
                key={chain.chainId}
                onClick={() => handleChainSelect(chain.chainId)}
                disabled={switching}
                className={cn(
                  'relative p-4 rounded-lg border text-left transition-all hover:shadow-md',
                  isSelected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                  isCurrent && !isSelected && 'border-green-300 bg-green-50',
                  !isSelected && !isCurrent && 'border-border hover:border-primary/50',
                  switching && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{getChainIcon(chain)}</div>
                  
                  <div className="flex-1">
                    <div className="font-medium">{chain.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {chain.symbol} • {chain.isTestnet ? 'Testnet' : 'Mainnet'}
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex flex-col items-end space-y-1">
                    {isCurrent && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Current
                      </span>
                    )}
                    {isSelected && !isCurrent && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Selected
                      </span>
                    )}
                    {isSelected && (
                      <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Network Stats */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block">Gas Price</span>
                    <span className="text-foreground">~20 gwei</span>
                  </div>
                  <div>
                    <span className="block">Block Time</span>
                    <span className="text-foreground">
                      {chain.chainId === SUPPORTED_CHAINS.ETHEREUM ? '~12s' : '~2s'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        {selectedChainId && selectedChainId !== chainId && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-blue-900">Switch to {getChainName(selectedChainId)}</div>
                <div className="text-sm text-blue-700">
                  Your wallet is currently on {getChainName(chainId || SUPPORTED_CHAINS.ETHEREUM)}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleChainSelect(selectedChainId)}
                loading={switching}
              >
                Switch Network
              </Button>
            </div>
          </div>
        )}

        {/* Network Info */}
        {selectedChainId && (
          <div className="mt-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Selected Network:</span>
              <span className="font-medium text-foreground">
                {getChainName(selectedChainId)}
              </span>
            </div>
            
            {selectedChainId === chainId && (
              <div className="flex items-center justify-between mt-1">
                <span>Status:</span>
                <span className="text-green-600 font-medium">✓ Connected</span>
              </div>
            )}
          </div>
        )}

        {/* Unsupported Network Warning */}
        {chainId && !isSupportedChain(chainId) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.296 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <div className="font-medium text-red-900">Unsupported Network</div>
                <div className="text-sm text-red-700">
                  Please switch to a supported network to continue.
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChainSelector;
