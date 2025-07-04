// FlowBridge Frontend - Yield Strategy Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useYieldData } from '../../../hooks/useYieldData';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../../ui/Modal';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { portfolioAPI, yieldAPI } from '../../../utils/api';
import { formatUSDValue, formatPercentage, formatTokenAmount } from '../../../utils/formatters';
import { parseTokenAmount } from '../../../utils/web3';
import { cn } from '../../../utils/formatters';
import type { YieldStrategy, Protocol } from '../../../types';

interface YieldStrategyProps {
  portfolioId?: string;
  className?: string;
}

interface CreateStrategyForm {
  protocolId: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  allocationPercentage: string;
  strategyType: 'single_asset' | 'lp_token' | 'vault' | 'lending' | 'staking';
}

const YieldStrategy: React.FC<YieldStrategyProps> = ({ 
  portfolioId, 
  className 
}) => {
  const { account, chainId, provider } = useMetaMask();
  const { 
    strategies, 
    protocols, 
    strategiesLoading, 
    protocolsLoading,
    fetchStrategies,
    optimizeYield 
  } = useYieldData(portfolioId);
  
  const { success: showSuccess, error: showError } = useToastNotification();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<YieldStrategy | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const [createForm, setCreateForm] = useState<CreateStrategyForm>({
    protocolId: '',
    tokenAddress: '',
    tokenSymbol: '',
    amount: '',
    allocationPercentage: '',
    strategyType: 'vault',
  });

  // Available tokens based on current chain
  const availableTokens = [
    { address: '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c', symbol: 'USDC', name: 'USD Coin' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin' },
  ];

  // Handle create strategy
  const handleCreateStrategy = async () => {
    if (!account || !provider || !portfolioId) {
      showError('Wallet not connected', 'Please connect your wallet to create a strategy');
      return;
    }

    if (!createForm.protocolId || !createForm.tokenAddress || !createForm.amount) {
      showError('Missing information', 'Please fill in all required fields');
      return;
    }

    setIsCreating(true);

    try {
      // Get protocol details
      const selectedProtocol = protocols.find(p => p.id === createForm.protocolId);
      if (!selectedProtocol) {
        throw new Error('Selected protocol not found');
      }

      // Create strategy data
      const strategyData = {
        portfolioId,
        protocolId: createForm.protocolId,
        strategyName: `${selectedProtocol.name} ${createForm.tokenSymbol} Strategy`,
        strategyType: createForm.strategyType,
        tokenAddress: createForm.tokenAddress,
        tokenSymbol: createForm.tokenSymbol,
        chainId: chainId!,
        allocationPercentage: parseFloat(createForm.allocationPercentage),
        deployedAmount: parseTokenAmount(createForm.amount, 18),
        currentApy: selectedProtocol.apyCurrent,
        riskScore: selectedProtocol.riskScore,
      };

      // Submit to API
      const response = await yieldAPI.createStrategy(strategyData);

      if (response.success) {
        showSuccess('Strategy Created', `Successfully created ${strategyData.strategyName}`);
        setShowCreateModal(false);
        setCreateForm({
          protocolId: '',
          tokenAddress: '',
          tokenSymbol: '',
          amount: '',
          allocationPercentage: '',
          strategyType: 'vault',
        });
        fetchStrategies(portfolioId);
      } else {
        throw new Error('Failed to create strategy');
      }
    } catch (error: any) {
      showError('Strategy Creation Failed', error.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle optimize portfolio
  const handleOptimize = async () => {
    if (!portfolioId) return;

    setOptimizing(true);

    try {
      const totalDeposited = strategies.reduce(
        (sum, strategy) => sum + parseFloat(strategy.deployedAmount),
        0
      );

      const optimization = await optimizeYield(portfolioId, {
        totalAmount: totalDeposited.toString(),
        userRiskTolerance: 5, // Would come from user settings
        forceRebalance: false,
      });

      showSuccess(
        'Portfolio Optimized', 
        `Expected APY improvement: ${formatPercentage(parseFloat(optimization.expectedAPY))}`
      );
    } catch (error: any) {
      showError('Optimization Failed', error.message);
    } finally {
      setOptimizing(false);
    }
  };

  // Handle strategy action (harvest, withdraw, etc.)
  const handleStrategyAction = async (strategy: YieldStrategy, action: 'harvest' | 'withdraw' | 'compound') => {
    if (!provider || !account) return;

    try {
      const response = await yieldAPI.executeStrategyAction({
        strategyId: strategy.id,
        action,
        chainId: strategy.chainId,
      });

      if (response.success) {
        showSuccess(
          'Action Executed',
          `Successfully executed ${action} for ${strategy.strategyName}`
        );
        fetchStrategies(portfolioId);
      }
    } catch (error: any) {
      showError('Action Failed', error.message);
    }
  };

  const activeStrategies = strategies.filter(s => s.isActive);
  const totalValue = activeStrategies.reduce((sum, s) => sum + parseFloat(s.currentValue), 0);
  const averageAPY = activeStrategies.length > 0 
    ? activeStrategies.reduce((sum, s) => {
        const weight = parseFloat(s.currentValue) / totalValue;
        return sum + (parseFloat(s.currentApy) * weight);
      }, 0)
    : 0;

  if (strategiesLoading && protocols.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <Skeleton width="200px" height="24px" />
          </CardHeader>
          <CardContent>
            <Skeleton lines={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Yield Strategies</h1>
          <p className="text-muted-foreground">
            Manage and optimize your yield farming strategies
          </p>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            variant="outline"
            onClick={handleOptimize}
            loading={optimizing}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          >
            Optimize Portfolio
          </Button>
          
          <Button 
            onClick={() => setShowCreateModal(true)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          >
            Create Strategy
          </Button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{activeStrategies.length}</div>
              <div className="text-sm text-muted-foreground">Active Strategies</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatUSDValue(totalValue)}</div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(averageAPY)}
              </div>
              <div className="text-sm text-muted-foreground">Average APY</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategies List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          {strategiesLoading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} lines={3} />
              ))}
            </div>
          ) : activeStrategies.length > 0 ? (
            <div className="space-y-4">
              {activeStrategies.map((strategy) => (
                <div 
                  key={strategy.id}
                  className="p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold">
                          {strategy.protocolName.charAt(0)}
                        </span>
                      </div>
                      
                      <div>
                        <div className="font-medium">{strategy.strategyName}</div>
                        <div className="text-sm text-muted-foreground">
                          {strategy.protocolName} • {strategy.tokenSymbol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPercentage(parseFloat(strategy.allocationPercentage))} allocation
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        {formatUSDValue(strategy.currentValue)}
                      </div>
                      <div className="text-sm text-green-600">
                        {formatPercentage(parseFloat(strategy.currentApy))} APY
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Yield: {formatUSDValue(strategy.yieldEarned)}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStrategyAction(strategy, 'harvest')}
                      >
                        Harvest
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStrategy(strategy)}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-medium mb-2">No Active Strategies</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first yield strategy to start earning
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                Create Strategy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Strategy Modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal} size="lg">
        <ModalHeader>
          <ModalTitle>Create New Yield Strategy</ModalTitle>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-6">
            {/* Protocol Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Protocol</label>
              <select
                value={createForm.protocolId}
                onChange={(e) => setCreateForm(prev => ({ ...prev, protocolId: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">Select a protocol</option>
                {protocols.filter(p => p.integrationStatus === 'active').map(protocol => (
                  <option key={protocol.id} value={protocol.id}>
                    {protocol.name} - {formatPercentage(parseFloat(protocol.apyCurrent))} APY
                  </option>
                ))}
              </select>
            </div>

            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Token</label>
              <select
                value={createForm.tokenAddress}
                onChange={(e) => {
                  const selectedToken = availableTokens.find(t => t.address === e.target.value);
                  setCreateForm(prev => ({ 
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

            {/* Strategy Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Strategy Type</label>
              <select
                value={createForm.strategyType}
                onChange={(e) => setCreateForm(prev => ({ ...prev, strategyType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="vault">Vault Strategy</option>
                <option value="lending">Lending</option>
                <option value="single_asset">Single Asset</option>
                <option value="lp_token">LP Token</option>
                <option value="staking">Staking</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <input
                type="number"
                value={createForm.amount}
                onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            {/* Allocation Percentage */}
            <div>
              <label className="block text-sm font-medium mb-2">Portfolio Allocation (%)</label>
              <input
                type="number"
                value={createForm.allocationPercentage}
                onChange={(e) => setCreateForm(prev => ({ ...prev, allocationPercentage: e.target.value }))}
                placeholder="10"
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateStrategy}
                loading={isCreating}
              >
                Create Strategy
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default YieldStrategy;
