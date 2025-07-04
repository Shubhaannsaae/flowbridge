// FlowBridge Frontend - Liquidity Manager Component
import React, { useState, useEffect } from 'react';
import { useCardIntegration } from '../../../hooks/useCardIntegration';
import { useYieldData } from '../../../hooks/useYieldData';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../../ui/Modal';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { portfolioAPI } from '../../../utils/api';
import { formatUSDValue, formatPercentage, formatTokenAmount } from '../../../utils/formatters';
import { parseTokenAmount } from '../../../utils/web3';
import { cn } from '../../../utils/formatters';
import type { SpendingLimit, YieldStrategy } from '../../../types';

interface LiquidityManagerProps {
  portfolioId?: string;
  className?: string;
}

interface LiquiditySettings {
  autoTopupEnabled: boolean;
  autoTopupThreshold: string;
  autoTopupAmount: string;
  preferredTokens: string[];
  maxLiquidityPercentage: number;
  emergencyReserve: string;
  rebalanceThreshold: number;
}

interface LiquidityFlow {
  id: string;
  type: 'auto_topup' | 'manual_topup' | 'yield_withdrawal' | 'emergency_reserve';
  amount: string;
  tokenSymbol: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  triggerReason?: string;
}

const LiquidityManager: React.FC<LiquidityManagerProps> = ({ 
  portfolioId, 
  className 
}) => {
  const { 
    balances, 
    spendingLimits,
    setSpendingLimits: updateSpendingLimits,
    refreshBalances 
  } = useCardIntegration();
  
  const { strategies, strategiesLoading } = useYieldData(portfolioId);
  const { account } = useMetaMask();
  const { success: showSuccess, error: showError } = useToastNotification();

  const [liquiditySettings, setLiquiditySettings] = useState<LiquiditySettings>({
    autoTopupEnabled: false,
    autoTopupThreshold: '100',
    autoTopupAmount: '500',
    preferredTokens: ['USDC', 'DAI'],
    maxLiquidityPercentage: 15,
    emergencyReserve: '1000',
    rebalanceThreshold: 5,
  });

  const [liquidityFlows, setLiquidityFlows] = useState<LiquidityFlow[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New spending limit form
  const [newLimit, setNewLimit] = useState<Partial<SpendingLimit>>({
    limitType: 'daily',
    limitAmount: '',
    limitCurrency: 'USD',
    isActive: true,
  });

  // Load liquidity settings and flows
  useEffect(() => {
    const loadLiquidityData = async () => {
      if (!account) return;

      try {
        const [settingsResponse, flowsResponse] = await Promise.all([
          portfolioAPI.getLiquiditySettings(account),
          portfolioAPI.getLiquidityFlows(account),
        ]);

        if (settingsResponse.success && settingsResponse.data) {
          setLiquiditySettings(settingsResponse.data);
        }

        if (flowsResponse.success && flowsResponse.data) {
          setLiquidityFlows(flowsResponse.data);
        }
      } catch (error: any) {
        showError('Failed to load liquidity data', error.message);
      } finally {
        setLoading(false);
      }
    };

    loadLiquidityData();
  }, [account]);

  // Calculate liquidity metrics
  const calculateLiquidityMetrics = () => {
    const totalCardBalance = balances.reduce((sum, balance) => 
      sum + parseFloat(balance.totalBalance), 0
    );

    const totalPortfolioValue = strategies.reduce((sum, strategy) => 
      sum + parseFloat(strategy.currentValue), 0
    );

    const liquidityPercentage = totalPortfolioValue > 0 
      ? (totalCardBalance / totalPortfolioValue) * 100 
      : 0;

    const availableForWithdrawal = strategies.reduce((sum, strategy) => {
      // Assume 80% of strategy value is available for immediate withdrawal
      return sum + (parseFloat(strategy.currentValue) * 0.8);
    }, 0);

    const emergencyReserveTarget = parseFloat(liquiditySettings.emergencyReserve);
    const emergencyReserveGap = Math.max(0, emergencyReserveTarget - totalCardBalance);

    return {
      totalCardBalance,
      totalPortfolioValue,
      liquidityPercentage,
      availableForWithdrawal,
      emergencyReserveTarget,
      emergencyReserveGap,
      isLowLiquidity: totalCardBalance < parseFloat(liquiditySettings.autoTopupThreshold),
      isOverAllocated: liquidityPercentage > liquiditySettings.maxLiquidityPercentage,
    };
  };

  // Save liquidity settings
  const handleSaveSettings = async () => {
    if (!account) return;

    setSaving(true);

    try {
      const response = await portfolioAPI.updateLiquiditySettings(account, liquiditySettings);
      
      if (response.success) {
        showSuccess('Settings Updated', 'Liquidity management settings have been saved');
        setShowSettingsModal(false);
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error: any) {
      showError('Save Failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  // Execute emergency withdrawal
  const handleEmergencyWithdrawal = async (amount: string) => {
    if (!portfolioId) return;

    try {
      const response = await portfolioAPI.emergencyWithdrawal(portfolioId, {
        amount: parseTokenAmount(amount, 18),
        destination: 'card',
        reason: 'liquidity_management',
      });

      if (response.success) {
        showSuccess(
          'Emergency Withdrawal Initiated',
          `Withdrawing ${formatUSDValue(amount)} to card balance`
        );
        refreshBalances();
      } else {
        throw new Error('Emergency withdrawal failed');
      }
    } catch (error: any) {
      showError('Withdrawal Failed', error.message);
    }
  };

  // Add spending limit
  const handleAddSpendingLimit = async () => {
    if (!newLimit.limitAmount || !account) return;

    try {
      const updatedLimits = [...spendingLimits, newLimit as SpendingLimit];
      await updateSpendingLimits(updatedLimits);
      
      setNewLimit({
        limitType: 'daily',
        limitAmount: '',
        limitCurrency: 'USD',
        isActive: true,
      });
      
      showSuccess('Spending Limit Added', 'New spending limit has been set');
    } catch (error: any) {
      showError('Failed to add spending limit', error.message);
    }
  };

  // Remove spending limit
  const handleRemoveSpendingLimit = async (index: number) => {
    try {
      const updatedLimits = spendingLimits.filter((_, i) => i !== index);
      await updateSpendingLimits(updatedLimits);
      showSuccess('Spending Limit Removed', 'Spending limit has been removed');
    } catch (error: any) {
      showError('Failed to remove spending limit', error.message);
    }
  };

  const metrics = calculateLiquidityMetrics();

  if (loading || strategiesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton lines={2} />
                </Card>
              ))}
            </div>
            <Skeleton lines={4} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <span>Liquidity Management</span>
          </CardTitle>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowLimitsModal(true)}
            >
              Spending Limits
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSettingsModal(true)}
            >
              Settings
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Liquidity Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatUSDValue(metrics.totalCardBalance)}
                </div>
                <div className="text-sm text-muted-foreground">Card Balance</div>
                <div className={cn(
                  'text-xs mt-1',
                  metrics.isLowLiquidity ? 'text-red-600' : 'text-green-600'
                )}>
                  {metrics.isLowLiquidity ? 'Low Liquidity' : 'Healthy'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatPercentage(metrics.liquidityPercentage)}
                </div>
                <div className="text-sm text-muted-foreground">Liquidity Ratio</div>
                <div className={cn(
                  'text-xs mt-1',
                  metrics.isOverAllocated ? 'text-orange-600' : 'text-green-600'
                )}>
                  Target: {formatPercentage(liquiditySettings.maxLiquidityPercentage)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatUSDValue(metrics.availableForWithdrawal)}
                </div>
                <div className="text-sm text-muted-foreground">Available to Withdraw</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatUSDValue(metrics.emergencyReserveGap)}
                </div>
                <div className="text-sm text-muted-foreground">Reserve Gap</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liquidity Alerts */}
        {(metrics.isLowLiquidity || metrics.isOverAllocated || metrics.emergencyReserveGap > 0) && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.296 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>Liquidity Alerts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.isLowLiquidity && (
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <div className="font-medium text-red-900">Low Card Balance</div>
                      <div className="text-sm text-red-700">
                        Balance below threshold of {formatUSDValue(liquiditySettings.autoTopupThreshold)}
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => handleEmergencyWithdrawal(liquiditySettings.autoTopupAmount)}
                    >
                      Auto Top-up
                    </Button>
                  </div>
                )}

                {metrics.isOverAllocated && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div>
                      <div className="font-medium text-orange-900">Over-allocated to Liquidity</div>
                      <div className="text-sm text-orange-700">
                        Consider moving excess funds back to yield strategies
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Rebalance
                    </Button>
                  </div>
                )}

                {metrics.emergencyReserveGap > 0 && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <div className="font-medium text-yellow-900">Emergency Reserve Gap</div>
                      <div className="text-sm text-yellow-700">
                        Need {formatUSDValue(metrics.emergencyReserveGap)} more for emergency reserve
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEmergencyWithdrawal(metrics.emergencyReserveGap.toString())}
                    >
                      Fill Gap
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liquidity Flow History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Liquidity Flows</CardTitle>
          </CardHeader>
          <CardContent>
            {liquidityFlows.length > 0 ? (
              <div className="space-y-3">
                {liquidityFlows.slice(0, 10).map((flow) => (
                  <div 
                    key={flow.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center',
                        flow.type === 'auto_topup' && 'bg-blue-100',
                        flow.type === 'manual_topup' && 'bg-green-100',
                        flow.type === 'yield_withdrawal' && 'bg-purple-100',
                        flow.type === 'emergency_reserve' && 'bg-red-100'
                      )}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </div>
                      
                      <div>
                        <div className="font-medium">
                          {flow.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {flow.triggerReason || 'Manual execution'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        {formatUSDValue(flow.amount)} {flow.tokenSymbol}
                      </div>
                      <div className={cn(
                        'text-xs',
                        flow.status === 'completed' && 'text-green-600',
                        flow.status === 'pending' && 'text-yellow-600',
                        flow.status === 'failed' && 'text-red-600'
                      )}>
                        {flow.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="font-medium mb-2">No Liquidity Flows</h3>
                <p className="text-sm text-muted-foreground">
                  Liquidity management activity will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Modal */}
        <Modal open={showSettingsModal} onOpenChange={setShowSettingsModal} size="lg">
          <ModalHeader>
            <ModalTitle>Liquidity Management Settings</ModalTitle>
          </ModalHeader>
          <ModalContent>
            <div className="space-y-6">
              {/* Auto Top-up Settings */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium">Auto Top-up</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically maintain card balance above threshold
                    </div>
                  </div>
                  <button
                    onClick={() => setLiquiditySettings(prev => ({ 
                      ...prev, 
                      autoTopupEnabled: !prev.autoTopupEnabled 
                    }))}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      liquiditySettings.autoTopupEnabled ? 'bg-primary' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        liquiditySettings.autoTopupEnabled ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                {liquiditySettings.autoTopupEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Threshold ($)
                      </label>
                      <input
                        type="number"
                        value={liquiditySettings.autoTopupThreshold}
                        onChange={(e) => setLiquiditySettings(prev => ({
                          ...prev,
                          autoTopupThreshold: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Top-up Amount ($)
                      </label>
                      <input
                        type="number"
                        value={liquiditySettings.autoTopupAmount}
                        onChange={(e) => setLiquiditySettings(prev => ({
                          ...prev,
                          autoTopupAmount: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Liquidity Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Max Liquidity Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={liquiditySettings.maxLiquidityPercentage}
                    onChange={(e) => setLiquiditySettings(prev => ({
                      ...prev,
                      maxLiquidityPercentage: parseInt(e.target.value)
                    }))}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Emergency Reserve ($)
                  </label>
                  <input
                    type="number"
                    value={liquiditySettings.emergencyReserve}
                    onChange={(e) => setLiquiditySettings(prev => ({
                      ...prev,
                      emergencyReserve: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowSettingsModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings} loading={saving}>
                  Save Settings
                </Button>
              </div>
            </div>
          </ModalContent>
        </Modal>

        {/* Spending Limits Modal */}
        <Modal open={showLimitsModal} onOpenChange={setShowLimitsModal} size="lg">
          <ModalHeader>
            <ModalTitle>Spending Limits</ModalTitle>
          </ModalHeader>
          <ModalContent>
            <div className="space-y-6">
              {/* Current Limits */}
              <div>
                <h4 className="font-medium mb-3">Current Limits</h4>
                <div className="space-y-2">
                  {spendingLimits.map((limit, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">
                          {limit.limitType.charAt(0).toUpperCase() + limit.limitType.slice(1)} Limit
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatUSDValue(limit.limitAmount)} {limit.limitCurrency}
                          {limit.merchantCategory && ` • ${limit.merchantCategory}`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveSpendingLimit(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Limit */}
              <div>
                <h4 className="font-medium mb-3">Add New Limit</h4>
                <div className="grid grid-cols-3 gap-4">
                  <select
                    value={newLimit.limitType}
                    onChange={(e) => setNewLimit(prev => ({ ...prev, limitType: e.target.value as any }))}
                    className="px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="per_transaction">Per Transaction</option>
                  </select>
                  
                  <input
                    type="number"
                    placeholder="Amount"
                    value={newLimit.limitAmount}
                    onChange={(e) => setNewLimit(prev => ({ ...prev, limitAmount: e.target.value }))}
                    className="px-3 py-2 border border-input rounded-md bg-background"
                  />
                  
                  <Button onClick={handleAddSpendingLimit}>
                    Add Limit
                  </Button>
                </div>
              </div>
            </div>
          </ModalContent>
        </Modal>
      </CardContent>
    </Card>
  );
};

export default LiquidityManager;
