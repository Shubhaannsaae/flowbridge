// FlowBridge Frontend - Cross-Chain Status Component
import React, { useState, useEffect } from 'react';
import { useCrossChain } from '../../../hooks/useCrossChain';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { 
  formatUSDValue, 
  formatDateTime, 
  formatRelativeTime,
  getBlockExplorerUrl 
} from '../../../utils/formatters';
import { getChainName } from '../../../utils/web3';
import { cn } from '../../../utils/formatters';
import type { BridgeStatusResponse } from '../../../types';

interface CrossChainStatusProps {
  transactionId?: string;
  className?: string;
}

interface BridgeTransaction {
  id: string;
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  amount: string;
  bridgeProvider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  sourceTransactionHash: string;
  destinationTransactionHash?: string;
  createdAt: string;
  completedAt?: string;
  estimatedCompletionTime: number;
  progress: number;
  errorMessage?: string;
}

const CrossChainStatus: React.FC<CrossChainStatusProps> = ({ 
  transactionId, 
  className 
}) => {
  const { account } = useMetaMask();
  const { trackBridgeStatus } = useCrossChain();

  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<BridgeTransaction | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  // Load bridge transactions
  useEffect(() => {
    const loadTransactions = async () => {
      if (!account) return;

      try {
        // In a real implementation, this would fetch from your API
        const mockTransactions: BridgeTransaction[] = [
          {
            id: 'bridge_001',
            fromChain: 1,
            toChain: 137,
            fromToken: 'USDC',
            toToken: 'USDC',
            amount: '1000.00',
            bridgeProvider: 'LI.FI',
            status: 'completed',
            sourceTransactionHash: '0x1234567890abcdef',
            destinationTransactionHash: '0xfedcba0987654321',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            completedAt: new Date(Date.now() - 3000000).toISOString(),
            estimatedCompletionTime: 15,
            progress: 100,
          },
          {
            id: 'bridge_002',
            fromChain: 137,
            toChain: 42161,
            fromToken: 'WETH',
            toToken: 'WETH',
            amount: '0.5',
            bridgeProvider: 'Stargate',
            status: 'processing',
            sourceTransactionHash: '0xabcdef1234567890',
            createdAt: new Date(Date.now() - 900000).toISOString(),
            estimatedCompletionTime: 20,
            progress: 60,
          },
          {
            id: 'bridge_003',
            fromChain: 1,
            toChain: 10,
            fromToken: 'DAI',
            toToken: 'DAI',
            amount: '500.00',
            bridgeProvider: 'Across',
            status: 'failed',
            sourceTransactionHash: '0x567890abcdef1234',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            estimatedCompletionTime: 10,
            progress: 25,
            errorMessage: 'Insufficient liquidity on destination chain',
          },
        ];

        setTransactions(mockTransactions);

        // If transactionId is provided, find and select that transaction
        if (transactionId) {
          const transaction = mockTransactions.find(tx => tx.id === transactionId);
          if (transaction) {
            setSelectedTransaction(transaction);
            await handleTrackStatus(transaction.id);
          }
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [account, transactionId]);

  // Track bridge status
  const handleTrackStatus = async (txId: string) => {
    setStatusLoading(true);

    try {
      await trackBridgeStatus(txId);
      // The hook will update the bridge status internally
    } catch (error) {
      console.error('Failed to track bridge status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      processing: 'text-blue-600 bg-blue-100',
      completed: 'text-green-600 bg-green-100',
      failed: 'text-red-600 bg-red-100',
      refunded: 'text-purple-600 bg-purple-100',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'processing':
        return <LoadingSpinner size="sm" variant="primary" />;
      case 'completed':
        return (
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'refunded':
        return (
          <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Calculate progress percentage
  const getProgressPercentage = (transaction: BridgeTransaction) => {
    if (transaction.status === 'completed') return 100;
    if (transaction.status === 'failed') return 0;
    
    const elapsed = Date.now() - new Date(transaction.createdAt).getTime();
    const estimated = transaction.estimatedCompletionTime * 60 * 1000; // Convert to ms
    const calculated = Math.min((elapsed / estimated) * 100, 95); // Cap at 95% until completed
    
    return Math.max(transaction.progress || calculated, 0);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton lines={3} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Cross-Chain Status</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track your cross-chain bridge transactions
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {transactions.length > 0 ? (
          <>
            {/* Transaction List */}
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const progress = getProgressPercentage(transaction);
                
                return (
                  <div 
                    key={transaction.id}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md',
                      selectedTransaction?.id === transaction.id && 'border-primary bg-primary/5'
                    )}
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(transaction.status)}
                        <div>
                          <div className="font-medium">
                            {formatUSDValue(transaction.amount)} {transaction.fromToken}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getChainName(transaction.fromChain)} → {getChainName(transaction.toChain)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={cn(
                          'text-xs px-2 py-1 rounded-full font-medium',
                          getStatusColor(transaction.status)
                        )}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatRelativeTime(transaction.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {(transaction.status === 'pending' || transaction.status === 'processing') && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {transaction.status === 'failed' && transaction.errorMessage && (
                      <div className="mt-2 text-sm text-red-600">
                        {transaction.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Transaction Details */}
            {selectedTransaction && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Transaction Details</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrackStatus(selectedTransaction.id)}
                      loading={statusLoading}
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Bridge Route */}
                    <div className="flex items-center justify-center space-x-4 p-4 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <div className="font-medium">{getChainName(selectedTransaction.fromChain)}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatUSDValue(selectedTransaction.amount)} {selectedTransaction.fromToken}
                        </div>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center">
                        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                      
                      <div className="text-center">
                        <div className="font-medium">{getChainName(selectedTransaction.toChain)}</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedTransaction.toToken}
                        </div>
                      </div>
                    </div>

                    {/* Transaction Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Bridge Provider</div>
                        <div className="font-medium">{selectedTransaction.bridgeProvider}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className={cn(
                          'font-medium',
                          selectedTransaction.status === 'completed' && 'text-green-600',
                          selectedTransaction.status === 'processing' && 'text-blue-600',
                          selectedTransaction.status === 'pending' && 'text-yellow-600',
                          selectedTransaction.status === 'failed' && 'text-red-600'
                        )}>
                          {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Created At</div>
                        <div className="font-medium">{formatDateTime(selectedTransaction.createdAt)}</div>
                      </div>

                      {selectedTransaction.completedAt && (
                        <div>
                          <div className="text-sm text-muted-foreground">Completed At</div>
                          <div className="font-medium">{formatDateTime(selectedTransaction.completedAt)}</div>
                        </div>
                      )}

                      <div>
                        <div className="text-sm text-muted-foreground">Estimated Time</div>
                        <div className="font-medium">{selectedTransaction.estimatedCompletionTime} minutes</div>
                      </div>

                      <div>
                        <div className="text-sm text-muted-foreground">Progress</div>
                        <div className="font-medium">{getProgressPercentage(selectedTransaction).toFixed(0)}%</div>
                      </div>
                    </div>

                    {/* Transaction Hashes */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Source Transaction</div>
                        <div className="flex items-center space-x-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                            {selectedTransaction.sourceTransactionHash}
                          </code>
                          <a
                            href={getBlockExplorerUrl(selectedTransaction.fromChain, selectedTransaction.sourceTransactionHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            View
                          </a>
                        </div>
                      </div>

                      {selectedTransaction.destinationTransactionHash && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Destination Transaction</div>
                          <div className="flex items-center space-x-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                              {selectedTransaction.destinationTransactionHash}
                            </code>
                            <a
                              href={getBlockExplorerUrl(selectedTransaction.toChain, selectedTransaction.destinationTransactionHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              View
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Error Details */}
                    {selectedTransaction.status === 'failed' && selectedTransaction.errorMessage && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-red-900 mb-1">Error Details</div>
                        <div className="text-sm text-red-700">{selectedTransaction.errorMessage}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">No Bridge Transactions</h3>
            <p className="text-sm text-muted-foreground">
              Your cross-chain bridge transactions will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrossChainStatus;
