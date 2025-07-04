// FlowBridge Frontend - Transaction History Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { portfolioAPI } from '../../../utils/api';
import { 
  formatUSDValue, 
  formatDateTime, 
  formatRelativeTime,
  formatTransactionStatus,
  getBlockExplorerUrl 
} from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { Transaction, PaginationParams } from '../../../types';

interface TransactionHistoryProps {
  portfolioId?: string;
  className?: string;
  limit?: number;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ 
  portfolioId, 
  className,
  limit = 50
}) => {
  const { account, chainId } = useMetaMask();
  const { error: showError } = useToastNotification();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 1,
    limit,
    totalPages: 1,
    totalItems: 0,
  });
  
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    timeRange: '30d',
  });

  // Fetch transaction history
  const fetchTransactions = async (page = 1) => {
    if (!account && !portfolioId) return;

    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        types: filters.type !== 'all' ? [filters.type] : undefined,
        status: filters.status !== 'all' ? [filters.status] : undefined,
        startDate: getStartDate(filters.timeRange),
      };

      const response = portfolioId 
        ? await portfolioAPI.getTransactions(portfolioId, params)
        : await portfolioAPI.getTransactions(account!, params);

      if (response.success && response.data) {
        setTransactions(response.data.transactions || []);
        setPagination(response.data.pagination || pagination);
      }
    } catch (error: any) {
      showError('Failed to load transactions', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get start date based on time range
  const getStartDate = (range: string): string => {
    const now = new Date();
    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    }[range] || 30;
    
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return startDate.toISOString();
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Get transaction icon
  const getTransactionIcon = (type: string) => {
    const icons = {
      deposit: (
        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      withdraw: (
        <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
        </svg>
      ),
      rebalance: (
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      bridge: (
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      card_topup: (
        <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      card_spend: (
        <svg className="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    };

    return icons[type as keyof typeof icons] || (
      <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    );
  };

  // Format transaction type
  const formatTransactionType = (type: string): string => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  useEffect(() => {
    fetchTransactions();
  }, [account, portfolioId, filters]);

  useEffect(() => {
    fetchTransactions(pagination.page);
  }, [pagination.page]);

  const filterOptions = {
    type: [
      { value: 'all', label: 'All Types' },
      { value: 'deposit', label: 'Deposits' },
      { value: 'withdraw', label: 'Withdrawals' },
      { value: 'rebalance', label: 'Rebalancing' },
      { value: 'bridge', label: 'Bridge' },
      { value: 'card_topup', label: 'Card Top-up' },
      { value: 'card_spend', label: 'Card Spending' },
    ],
    status: [
      { value: 'all', label: 'All Status' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'pending', label: 'Pending' },
      { value: 'failed', label: 'Failed' },
    ],
    timeRange: [
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: 'Last 30 days' },
      { value: '90d', label: 'Last 90 days' },
      { value: '1y', label: 'Last year' },
    ],
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transaction History</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchTransactions(1)}
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mt-4">
          {Object.entries(filterOptions).map(([key, options]) => (
            <select
              key={key}
              value={filters[key as keyof typeof filters]}
              onChange={(e) => handleFilterChange(key, e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm bg-background"
            >
              {options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                <Skeleton variant="circular" width="40px" height="40px" />
                <div className="flex-1">
                  <Skeleton width="60%" height="20px" />
                  <Skeleton width="40%" height="16px" />
                </div>
                <Skeleton width="80px" height="20px" />
              </div>
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <>
            <div className="space-y-2">
              {transactions.map((transaction) => {
                const statusFormatted = formatTransactionStatus(transaction.status);
                
                return (
                  <div 
                    key={transaction.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      
                      <div>
                        <div className="font-medium">
                          {formatTransactionType(transaction.type)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.tokenSymbol} • {formatRelativeTime(transaction.submittedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        {formatUSDValue(transaction.amount)} {transaction.tokenSymbol}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          statusFormatted.color
                        )}>
                          {statusFormatted.label}
                        </span>
                        {transaction.transactionHash && (
                          <a
                            href={getBlockExplorerUrl(transaction.chainId, transaction.transactionHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.totalItems)} of{' '}
                  {pagination.totalItems} transactions
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">No Transactions Found</h3>
            <p className="text-sm text-muted-foreground">
              {filters.type !== 'all' || filters.status !== 'all'
                ? 'Try adjusting your filters to see more results'
                : 'Start using FlowBridge to see your transaction history here'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
