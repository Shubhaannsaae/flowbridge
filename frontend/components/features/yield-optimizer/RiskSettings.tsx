// FlowBridge Frontend - Risk Settings Component
import React, { useState, useEffect } from 'react';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useToastNotification } from '../../ui/Toast';
import { authAPI, riskAPI } from '../../../utils/api';
import { formatPercentage } from '../../../utils/formatters';
import { RISK_LEVELS } from '../../../utils/constants';
import { cn } from '../../../utils/formatters';

interface RiskSettingsProps {
  portfolioId?: string;
  className?: string;
}

interface RiskProfile {
  riskTolerance: number;
  maxAllocationPerProtocol: number;
  maxAllocationPerCategory: number;
  allowedProtocolCategories: string[];
  minLiquidityThreshold: number;
  autoRebalanceEnabled: boolean;
  rebalanceThreshold: number;
  stopLossEnabled: boolean;
  stopLossThreshold: number;
  allowHighRiskProtocols: boolean;
  emergencyExitEnabled: boolean;
}

interface RiskMetrics {
  currentRiskScore: number;
  portfolioVolatility: number;
  concentrationRisk: number;
  liquidityRisk: number;
  protocolRiskDistribution: Record<string, number>;
  recommendations: string[];
}

const RiskSettings: React.FC<RiskSettingsProps> = ({ 
  portfolioId, 
  className 
}) => {
  const { account } = useMetaMask();
  const { success: showSuccess, error: showError } = useToastNotification();

  const [riskProfile, setRiskProfile] = useState<RiskProfile>({
    riskTolerance: 5,
    maxAllocationPerProtocol: 25,
    maxAllocationPerCategory: 50,
    allowedProtocolCategories: ['lending', 'dex', 'yield_farming'],
    minLiquidityThreshold: 10,
    autoRebalanceEnabled: true,
    rebalanceThreshold: 5.0,
    stopLossEnabled: false,
    stopLossThreshold: 20,
    allowHighRiskProtocols: false,
    emergencyExitEnabled: true,
  });

  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current risk profile
  useEffect(() => {
    const loadRiskProfile = async () => {
      if (!account) return;

      try {
        const response = await riskAPI.getRiskProfile(account);
        if (response.success && response.data) {
          setRiskProfile(response.data);
        }

        if (portfolioId) {
          const metricsResponse = await riskAPI.assessPortfolio(portfolioId);
          if (metricsResponse.success && metricsResponse.data) {
            setRiskMetrics(metricsResponse.data);
          }
        }
      } catch (error: any) {
        showError('Failed to load risk settings', error.message);
      } finally {
        setLoading(false);
      }
    };

    loadRiskProfile();
  }, [account, portfolioId]);

  // Save risk profile
  const handleSave = async () => {
    if (!account) return;

    setSaving(true);

    try {
      const response = await riskAPI.updateRiskProfile(account, riskProfile);
      
      if (response.success) {
        showSuccess('Risk Settings Updated', 'Your risk preferences have been saved');
      } else {
        throw new Error('Failed to update risk settings');
      }
    } catch (error: any) {
      showError('Save Failed', error.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle risk tolerance change
  const handleRiskToleranceChange = (newTolerance: number) => {
    setRiskProfile(prev => ({
      ...prev,
      riskTolerance: newTolerance,
      // Auto-adjust related settings based on risk tolerance
      maxAllocationPerProtocol: newTolerance <= 3 ? 20 : newTolerance >= 7 ? 40 : 25,
      allowHighRiskProtocols: newTolerance >= 7,
      stopLossEnabled: newTolerance <= 4,
    }));
  };

  const riskLevels = Object.values(RISK_LEVELS);
  const currentRiskLevel = riskLevels.find(level => level.value === riskProfile.riskTolerance);

  const protocolCategories = [
    { id: 'lending', name: 'Lending', description: 'Deposit assets to earn interest' },
    { id: 'dex', name: 'DEX', description: 'Provide liquidity to decentralized exchanges' },
    { id: 'yield_farming', name: 'Yield Farming', description: 'Stake tokens in farming protocols' },
    { id: 'liquidity_mining', name: 'Liquidity Mining', description: 'Earn rewards for providing liquidity' },
    { id: 'derivatives', name: 'Derivatives', description: 'Trade derivative instruments' },
    { id: 'insurance', name: 'Insurance', description: 'Provide coverage for DeFi protocols' },
  ];

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Risk Management</h1>
        <p className="text-muted-foreground">
          Configure your risk tolerance and portfolio protection settings
        </p>
      </div>

      {/* Current Risk Assessment */}
      {riskMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Current Portfolio Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold" style={{ color: currentRiskLevel?.color }}>
                  {riskMetrics.currentRiskScore}/100
                </div>
                <div className="text-sm text-muted-foreground">Overall Risk</div>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">
                  {formatPercentage(riskMetrics.portfolioVolatility)}
                </div>
                <div className="text-sm text-muted-foreground">Volatility</div>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">
                  {formatPercentage(riskMetrics.concentrationRisk)}
                </div>
                <div className="text-sm text-muted-foreground">Concentration Risk</div>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">
                  {formatPercentage(riskMetrics.liquidityRisk)}
                </div>
                <div className="text-sm text-muted-foreground">Liquidity Risk</div>
              </div>
            </div>

            {riskMetrics.recommendations.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-3">Risk Recommendations</h4>
                <div className="space-y-2">
                  {riskMetrics.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-2 text-sm">
                      <svg className="h-4 w-4 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk Tolerance */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Tolerance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium">Current Level: {currentRiskLevel?.label}</span>
                <span 
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ 
                    backgroundColor: `${currentRiskLevel?.color}20`,
                    color: currentRiskLevel?.color 
                  }}
                >
                  {riskProfile.riskTolerance}/10
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {riskLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => handleRiskToleranceChange(level.value)}
                    className={cn(
                      'p-4 rounded-lg border text-left transition-all',
                      riskProfile.riskTolerance === level.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{level.label}</div>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: level.color }}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Risk Level {level.value}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocation Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Allocation Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Max Allocation per Protocol (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={riskProfile.maxAllocationPerProtocol}
                onChange={(e) => setRiskProfile(prev => ({
                  ...prev,
                  maxAllocationPerProtocol: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Allocation per Category (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={riskProfile.maxAllocationPerCategory}
                onChange={(e) => setRiskProfile(prev => ({
                  ...prev,
                  maxAllocationPerCategory: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Minimum Liquidity Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={riskProfile.minLiquidityThreshold}
                onChange={(e) => setRiskProfile(prev => ({
                  ...prev,
                  minLiquidityThreshold: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Rebalance Threshold (%)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                step="0.5"
                value={riskProfile.rebalanceThreshold}
                onChange={(e) => setRiskProfile(prev => ({
                  ...prev,
                  rebalanceThreshold: parseFloat(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Protocol Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Allowed Protocol Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {protocolCategories.map((category) => (
              <div 
                key={category.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div>
                  <div className="font-medium">{category.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {category.description}
                  </div>
                </div>
                <button
                  onClick={() => setRiskProfile(prev => ({
                    ...prev,
                    allowedProtocolCategories: prev.allowedProtocolCategories.includes(category.id)
                      ? prev.allowedProtocolCategories.filter(id => id !== category.id)
                      : [...prev.allowedProtocolCategories, category.id]
                  }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    riskProfile.allowedProtocolCategories.includes(category.id)
                      ? 'bg-primary' 
                      : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      riskProfile.allowedProtocolCategories.includes(category.id)
                        ? 'translate-x-6' 
                        : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Risk Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                key: 'autoRebalanceEnabled',
                label: 'Auto Rebalancing',
                description: 'Automatically rebalance portfolio when thresholds are exceeded',
              },
              {
                key: 'stopLossEnabled',
                label: 'Stop Loss Protection',
                description: 'Automatically exit positions when losses exceed threshold',
              },
              {
                key: 'allowHighRiskProtocols',
                label: 'Allow High Risk Protocols',
                description: 'Enable investing in protocols with risk scores above 70',
              },
              {
                key: 'emergencyExitEnabled',
                label: 'Emergency Exit',
                description: 'Enable emergency liquidation in extreme market conditions',
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
                  onClick={() => setRiskProfile(prev => ({
                    ...prev,
                    [setting.key]: !prev[setting.key as keyof RiskProfile]
                  }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    riskProfile[setting.key as keyof RiskProfile]
                      ? 'bg-primary' 
                      : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      riskProfile[setting.key as keyof RiskProfile]
                        ? 'translate-x-6' 
                        : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            ))}

            {riskProfile.stopLossEnabled && (
              <div className="ml-4 p-4 bg-muted/50 rounded-lg">
                <label className="block text-sm font-medium mb-2">
                  Stop Loss Threshold (%)
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={riskProfile.stopLossThreshold}
                  onChange={(e) => setRiskProfile(prev => ({
                    ...prev,
                    stopLossThreshold: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Save Risk Settings
        </Button>
      </div>
    </div>
  );
};

export default RiskSettings;
