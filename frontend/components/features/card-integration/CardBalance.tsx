// FlowBridge Frontend - Card Balance Component
import React, { useState, useEffect } from 'react';
import { useCardIntegration } from '../../../hooks/useCardIntegration';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../../ui/Modal';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { formatUSDValue, formatTokenAmount } from '../../../utils/formatters';
import { parseTokenAmount } from '../../../utils/web3';
import { cn } from '../../../utils/formatters';
import type { CardBalance as CardBalanceType } from '../../../types';

interface CardBalanceProps {
  className?: string;
}

interface TopUpForm {
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  sourceType: 'portfolio' | 'external_wallet';
}

const CardBalance: React.FC<CardBalanceProps> = ({ className }) => {
  const { 
    balances, 
    balancesLoading, 
    isCardLinked, 
    linkLoading,
    refreshBalances,
    topUpCard,
    linkCard,
    unlinkCard,
    getBalanceByToken,
    canSpend,
    getRemainingDailyLimit,
    getRemainingMonthlyLimit 
  } = useCardIntegration();
  
  const { account, chainId } = useMetaMask();
  const { success: showSuccess, error: showError } = useToastNotification();

  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [topUpForm, setTopUpForm] = useState<TopUpForm>({
    tokenAddress: '',
    tokenSymbol: '',
    amount: '',
    sourceType: 'portfolio',
  });
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Available tokens for top-up
  const availableTokens = [
    { address: '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c', symbol: 'USDC', name: 'USD Coin' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD' },
  ];

  // Handle card linking
  const handleLinkCard = async () => {
    if (!account) {
      showError('Wallet not connected', 'Please connect your wallet first');
      return;
    }

    try {
      await linkCard();
      setShowLinkModal(false);
      showSuccess('Card Linked', 'MetaMask Card has been successfully linked to your account');
    } catch (error: any) {
      showError('Link Failed', error.message);
    }
  };

  // Handle card unlinking
  const handleUnlinkCard = async () => {
    try {
      await unlinkCard();
      showSuccess('Card Unlinked', 'MetaMask Card has been unlinked from your account');
    } catch (error: any) {
      showError('Unlink Failed', error.message);
    }
  };

  // Handle top up
  const handleTopUp = async () => {
    if (!topUpForm.tokenAddress || !topUpForm.amount) {
      showError('Missing information', 'Please select a token and enter an amount');
      return;
    }

    const amount = parseFloat(topUpForm.amount);
    if (amount <= 0) {
      showError('Invalid amount', 'Amount must be greater than 0');
      return;
    }

    setTopUpLoading(true);

    try {
      const topUpId = await topUpCard(
        topUpForm.tokenAddress,
        parseTokenAmount(topUpForm.amount, 18),
        topUpForm.sourceType
      );

      showSuccess(
        'Top-up Initiated',
        `Card top-up has been initiated. Transaction ID: ${topUpId}`
      );

      setShowTopUpModal(false);
      setTopUpForm({
        tokenAddress: '',
        tokenSymbol: '',
        amount: '',
        sourceType: 'portfolio',
      });
    } catch (error: any) {
      showError('Top-up Failed', error.message);
    } finally {
      setTopUpLoading(false);
    }
  };

  // Auto-refresh balances
  useEffect(() => {
    if (isCardLinked) {
      const interval = setInterval(() => {
        refreshBalances();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isCardLinked, refreshBalances]);

  // Card not linked state
  if (!isCardLinked) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-12">
          <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          
          <h3 className="text-xl font-semibold mb-2">MetaMask Card Not Linked</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Link your MetaMask Card to view balances, manage spending, and top up directly from your yield earnings.
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={() => setShowLinkModal(true)}
              loading={linkLoading}
              size="lg"
              variant="gradient"
            >
              Link MetaMask Card
            </Button>
            
            <div className="text-sm text-muted-foreground">
              Don't have a MetaMask Card?{' '}
              <a 
                href="https://card.metamask.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get yours here
              </a>
            </div>
          </div>
        </CardContent>

        {/* Link Card Modal */}
        <Modal open={showLinkModal} onOpenChange={setShowLinkModal}>
          <ModalHeader>
            <ModalTitle>Link MetaMask Card</ModalTitle>
          </ModalHeader>
          <ModalContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                To link your MetaMask Card, you'll need to verify your identity and 
                connect your card to this wallet address.
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">What happens next:</p>
                    <ul className="text-blue-800 space-y-1">
                      <li>• You'll be redirected to MetaMask Card portal</li>
                      <li>• Complete identity verification if required</li>
                      <li>• Authorize connection to this wallet</li>
                      <li>• Return to FlowBridge to manage your card</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowLinkModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLinkCard} loading={linkLoading}>
                  Continue to Link Card
                </Button>
              </div>
            </div>
          </ModalContent>
        </Modal>
      </Card>
    );
  }

  // Loading state
  if (balancesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Skeleton variant="circular" width="40px" height="40px" />
                  <Skeleton width="100px" height="20px" />
                </div>
                <Skeleton width="80px" height="20px" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCardValue = balances.reduce((sum, balance) => 
    sum + parseFloat(balance.totalBalance), 0
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>MetaMask Card Balance</span>
          </CardTitle>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshBalances}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
            
            <Button 
              size="sm"
              onClick={() => setShowTopUpModal(true)}
            >
              Top Up
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Total Balance Summary */}
        <div className="mb-6 p-6 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-900 mb-2">
              {formatUSDValue(totalCardValue)}
            </div>
            <div className="text-orange-700">Total Card Balance</div>
          </div>
        </div>

        {/* Individual Token Balances */}
        <div className="space-y-4">
          {balances.length > 0 ? (
            balances.map((balance) => (
              <div 
                key={balance.tokenAddress}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {balance.tokenSymbol.charAt(0)}
                    </span>
                  </div>
                  
                  <div>
                    <div className="font-medium">{balance.tokenSymbol}</div>
                    <div className="text-sm text-muted-foreground">
                      Available: {formatTokenAmount(balance.availableBalance)} {balance.tokenSymbol}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium">
                    {formatUSDValue(balance.totalBalance)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTokenAmount(balance.totalBalance)} {balance.tokenSymbol}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="font-medium mb-2">No Card Balance</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Top up your card to start spending your yield earnings
              </p>
              <Button onClick={() => setShowTopUpModal(true)}>
                Top Up Now
              </Button>
            </div>
          )}
        </div>

        {/* Card Management */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Card Management</div>
              <div className="text-sm text-muted-foreground">
                Manage your MetaMask Card connection
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleUnlinkCard}
            >
              Unlink Card
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Top Up Modal */}
      <Modal open={showTopUpModal} onOpenChange={setShowTopUpModal} size="lg">
        <ModalHeader>
          <ModalTitle>Top Up MetaMask Card</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-6">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Source</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTopUpForm(prev => ({ ...prev, sourceType: 'portfolio' }))}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    topUpForm.sourceType === 'portfolio'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium">Portfolio</div>
                  <div className="text-sm text-muted-foreground">
                    Use funds from your yield portfolio
                  </div>
                </button>
                
                <button
                  onClick={() => setTopUpForm(prev => ({ ...prev, sourceType: 'external_wallet' }))}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    topUpForm.sourceType === 'external_wallet'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium">External Wallet</div>
                  <div className="text-sm text-muted-foreground">
                    Transfer from connected wallet
                  </div>
                </button>
              </div>
            </div>

            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Token</label>
              <select
                value={topUpForm.tokenAddress}
                onChange={(e) => {
                  const selectedToken = availableTokens.find(t => t.address === e.target.value);
                  setTopUpForm(prev => ({ 
                    ...prev, 
                    tokenAddress: e.target.value,
                    tokenSymbol: selectedToken?.symbol || ''
                  }));
                }}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">Select a token</option>
                {availableTokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <input
                type="number"
                value={topUpForm.amount}
                onChange={(e) => setTopUpForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
              {topUpForm.tokenSymbol && (
                <div className="text-sm text-muted-foreground mt-1">
                  Current balance: {getBalanceByToken(topUpForm.tokenAddress)?.availableBalance || '0'} {topUpForm.tokenSymbol}
                </div>
              )}
            </div>

            {/* Spending Limits Info */}
            {topUpForm.tokenAddress && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Spending Limits</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Daily Remaining:</span>
                    <span className="ml-2 font-medium">
                      {formatUSDValue(getRemainingDailyLimit(topUpForm.tokenAddress))}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly Remaining:</span>
                    <span className="ml-2 font-medium">
                      {formatUSDValue(getRemainingMonthlyLimit(topUpForm.tokenAddress))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowTopUpModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTopUp}
                loading={topUpLoading}
                disabled={!topUpForm.tokenAddress || !topUpForm.amount}
              >
                Top Up Card
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </Card>
  );
};

export default CardBalance;
