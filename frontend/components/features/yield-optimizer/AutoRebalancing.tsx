// FlowBridge Frontend - Auto Rebalancing Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useYieldData } from '../../../hooks/useYieldData';
import { useAIOptimizer } from '../../../hooks/useAIOptimizer';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../../ui/Modal';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { portfolioAPI, aiAPI } from '../../../utils/api';
import { 
  formatPercentage, 
  formatUSDValue, 
  formatDateTime,
  formatRelativeTime 
} from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { OptimizationSuggestion, YieldStrategy } from '../../../types';

interface AutoRebalancingProps {
  portfolioId: string;
  className?: string;
}

interface RebalanceSettings {
  enabled: boolean;
  threshold: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  maxSlippage: number;
  minGasPrice: number;
  maxGasPrice: number;
  emergencyStop: boolean;
  notifications: boolean;
}

interface RebalanceHistory {
  id: string;
  executedAt: string;
  triggerReason: string;
  oldAllocation: Record<string, string>;
  newAllocation: Record<string, string>;
  gasCost: string;
  status: 'completed' | 'failed' | 'pending';
  apyImprovement: string;
}

const AutoRebalancing: React.FC<AutoRebalancingProps> = ({ 
  portfolioId, 
  className 
}) => {
  const { account, provider } = useMetaMask();
  const { strategies, refreshData } = useYieldData(portfolioId);
  const { getOptimizationSuggestions } = useAIOptimizer(portfolioId);
  const { success: showSuccess, error: showError } = useToastNotification();

  const [settings, setSettings] = useState<RebalanceSettings>({
    enabled: false,
    threshold: 5.0,
    frequency: 'weekly',
    maxSlippage: 1.0,
    minGasPrice: 20,
    maxGasPrice: 100,
    emergencyStop: true,
    notifications: true,
  });

  const [rebalanceHistory, setRebalanceHistory] = useState<RebalanceHistory[]>([]);
  const [currentSuggestion, setCurrentSuggestion] = useState<OptimizationSuggestion | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  // Load settings and history
  useEffect(() => {
    const loadData = async () => {
      if (!portfolioId) return;

      try {
        const [settingsResponse, historyResponse, suggestionsResponse] = await Promise.all([
          portfolioAPI.getRebalanceSettings(portfolioId),
          portfolioAPI.getRebalanceHistory(portfolioId),
          getOptimizationSuggestions(),
        ]);

        if (settingsResponse.success && settingsResponse.data) {
          setSettings(settingsResponse.data);
        }

        if (historyResponse.success && historyResponse.data) {
          setRebalanceHistory(historyResponse.data);
        }

        if (suggestionsResponse.length > 0) {
          const activeSuggestion = suggestionsResponse.find(s => 
            s.optimizationType === 'rebalance' && s.status === 'pending'
          );
          setCurrentSuggestion(activeSuggestion || null);
        }
      } catch (error: any) {
        showError('Failed to load rebalancing data', error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [portfolioId]);

  // Save settings
  const handleSaveSettings = async () => {
    if (!portfolioId) return;

    try {
      const response = await portfolioAPI.updateRebalanceSettings(portfolioId, settings);
      
      if (response.success) {
        showSuccess('Settings Updated', 'Auto-rebalancing settings have been saved');
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error: any) {
      showError('Save Failed', error.message);
    }
  };

  // Execute manual rebalance
  const handleManualRebalance = async () => {
    if (!portfolioId || !provider || !currentSuggestion) return;

    setExecuting(true);

    try {
      const response = await portfolioAPI.rebalance(portfolioId, {
        newAllocations: currentSuggestion.suggestedAllocation,
        slippageTolerance: settings.maxSlippage,
        gasPrice: settings.maxGasPrice.toString(),
      });

      if (response.success) {
        showSuccess(
          'Rebalance Executed',
          `Portfolio rebalanced successfully. Transaction: ${response.data.transactionHashes[0]}`
        );
        setShowConfirmModal(false);
        setCurrentSuggestion(null);
        refreshData();
        
        // Reload history
        const historyResponse = await portfolioAPI.getRebalanceHistory(portfolioId);
        if (historyResponse.success) {
          setRebalanceHistory(historyResponse.data);
        }
      } else {
        throw new Error('Rebalance execution failed');
      }
    } catch (error: any) {
      showError('Rebalance Failed', error.message);
    } finally {
      setExecuting(false);
    }
  };

  // Calculate current allocation
  const getCurrentAllocation = () => {
    const totalValue = strategies.reduce((sum, s) => sum + parseFloat(s.currentValue), 0);
    
    return strategies.reduce((acc, strategy) => {
      const percentage = totalValue > 0 
        ? (parseFloat(strategy.currentValue) / totalValue) * 100 
        : 0;
      acc[strategy.protocolName] = percentage.toFixed(2);
      return acc;
    }, {} as Record<string, string>);
  };

  const currentAllocation = getCurrentAllocation();

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <Skeleton width="300px" height="24px" />
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
          <h1 className="text-3xl font-bold">Auto Rebalancing</h1>
          <p className="text-muted-foreground">
            Automatically optimize your portfolio allocation based on AI recommendations
          </p>
        </div>
        
        {currentSuggestion && (
          <Button 
            onClick={() => setShowConfirmModal(true)}
            variant="gradient"
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            Rebalance Now
          </Button>
        )}
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Auto Rebalancing</div>
                <div className="text-2xl font-bold">
                  {settings.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              <div className={cn(
                'h-3 w-3 rounded-full',
                settings.enabled ? 'bg-green-500' : 'bg-gray-400'
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatPercentage(settings.threshold)}
              </div>
              <div className="text-sm text-muted-foreground">Rebalance Threshold</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{rebalanceHistory.length}</div>
              <div className="text-sm text-muted-foreground">Total Rebalances</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Suggestion */}
      {currentSuggestion && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>AI Optimization Recommendation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Current Allocation</h4>
                  <div className="space-y-2">
                    {Object.entries(currentAllocation).map(([protocol, percentage]) => (
                      <div key={protocol} className="flex justify-between">
                        <span className="text-sm">{protocol}</span>
                        <span className="text-sm font-medium">
                          {formatPercentage(parseFloat(percentage))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Suggested Allocation</h4>
                  <div className="space-y-2">
                    {Object.entries(currentSuggestion.suggestedAllocation).map(([protocol, percentage]) => (
                      <div key={protocol} className="flex justify-between">
                        <span className="text-sm">{protocol}</span>
                        <span className="text-sm font-medium text-green-600">
                          {formatPercentage(parseFloat(percentage))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                {currentSuggestion.expectedApyImprovement && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      +{formatPercentage(parseFloat(currentSuggestion.expectedApyImprovement))}
                    </div>
                    <div className="text-sm text-muted-foreground">APY Improvement</div>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-lg font-bold">
                    {formatUSDValue(currentSuggestion.estimatedGasCost)}
                  </div>
                  <div className="text-sm text-muted-foreground">Est. Gas Cost</div>
                </div>

                <div className="text-center">
                  <div className="text-lg font-bold">
                    {currentSuggestion.implementationComplexity}
                  </div>
                  <div className="text-sm text-muted-foreground">Complexity</div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h5 className="font-medium mb-2">Reasoning</h5>
                <p className="text-sm text-muted-foreground">
                  {currentSuggestion.reasoning}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Rebalancing Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <div className="font-medium">Enable Auto Rebalancing</div>
                <div className="text-sm text-muted-foreground">
                  Automatically rebalance when thresholds are met
                </div>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.enabled ? 'bg-primary' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.enabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Threshold and Frequency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rebalance Threshold (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={settings.threshold}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    threshold: parseFloat(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Trigger rebalance when allocation deviates by this percentage
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Check Frequency
                </label>
                <select
                  value={settings.frequency}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    frequency: e.target.value as any
                  }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Gas Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Slippage (%)
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={settings.maxSlippage}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    maxSlippage: parseFloat(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Min Gas Price (gwei)
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={settings.minGasPrice}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    minGasPrice: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Gas Price (gwei)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={settings.maxGasPrice}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    maxGasPrice: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>
            </div>

            {/* Additional Settings */}
            <div className="space-y-4">
              {[
                {
                  key: 'emergencyStop',
                  label: 'Emergency Stop',
                  description: 'Pause rebalancing during extreme market volatility',
                },
                {
                  key: 'notifications',
                  label: 'Notifications',
                  description: 'Receive notifications when rebalancing occurs',
                },
              ].map((setting) => (
                <div 
                  key={setting.key}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <div className="font-medium">{setting.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {setting.description}
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      [setting.key]: !prev[setting.key as keyof RebalanceSettings]
                    }))}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      settings[setting.key as keyof RebalanceSettings]
                        ? 'bg-primary' 
                        : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        settings[setting.key as keyof RebalanceSettings]
                          ? 'translate-x-6' 
                          : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rebalance History */}
      <Card>
        <CardHeader>
          <CardTitle>Rebalance History</CardTitle>
        </CardHeader>
        <CardContent>
          {rebalanceHistory.length > 0 ? (
            <div className="space-y-4">
              {rebalanceHistory.slice(0, 10).map((record) => (
                <div 
                  key={record.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <div className="font-medium">
                      {formatDateTime(record.executedAt)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {record.triggerReason}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={cn(
                      'text-sm font-medium',
                      record.status === 'completed' && 'text-green-600',
                      record.status === 'failed' && 'text-red-600',
                      record.status === 'pending' && 'text-yellow-600'
                    )}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Gas: {formatUSDValue(record.gasCost)}
                      {record.apyImprovement && ` • +${formatPercentage(parseFloat(record.apyImprovement))} APY`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-medium mb-2">No Rebalance History</h3>
              <p className="text-sm text-muted-foreground">
                Rebalance history will appear here once you start using auto-rebalancing
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Modal open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <ModalHeader>
          <ModalTitle>Confirm Portfolio Rebalance</ModalTitle>
        </ModalHeader>
        <ModalContent>
          {currentSuggestion && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                This will rebalance your portfolio according to the AI recommendation. 
                The transaction cannot be undone.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Expected APY Improvement:</span>
                    <span className="text-green-600 ml-2">
                      +{formatPercentage(parseFloat(currentSuggestion.expectedApyImprovement || '0'))}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Estimated Gas Cost:</span>
                    <span className="ml-2">{formatUSDValue(currentSuggestion.estimatedGasCost)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleManualRebalance}
                  loading={executing}
                >
                  Confirm Rebalance
                </Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default AutoRebalancing;
