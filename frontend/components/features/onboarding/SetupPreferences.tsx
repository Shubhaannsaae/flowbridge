// FlowBridge Frontend - Setup Preferences Component
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { useToastNotification } from '../../ui/Toast';
import { SUPPORTED_CHAINS, RISK_LEVELS } from '../../../utils/constants';
import { authAPI } from '../../../utils/api';
import { cn } from '../../../utils/formatters';

interface UserPreferences {
  riskTolerance: number;
  preferredChains: number[];
  notificationSettings: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  autoRebalance: boolean;
  cardIntegration: boolean;
}

interface SetupPreferencesProps {
  onComplete?: (preferences: UserPreferences) => void;
  className?: string;
}

const SetupPreferences: React.FC<SetupPreferencesProps> = ({ 
  onComplete, 
  className 
}) => {
  const router = useRouter();
  const { success: showSuccess, error: showError } = useToastNotification();
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    riskTolerance: 5,
    preferredChains: [SUPPORTED_CHAINS.ETHEREUM],
    notificationSettings: {
      email: true,
      push: true,
      sms: false,
    },
    autoRebalance: false,
    cardIntegration: false,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: 'Risk Tolerance', description: 'Set your investment risk level' },
    { title: 'Preferred Networks', description: 'Choose your favorite blockchains' },
    { title: 'Notifications', description: 'Configure how you want to be notified' },
    { title: 'Features', description: 'Enable additional features' },
  ];

  const riskLevels = Object.values(RISK_LEVELS);
  
  const supportedChains = [
    { id: SUPPORTED_CHAINS.ETHEREUM, name: 'Ethereum', symbol: 'ETH', icon: '⟠' },
    { id: SUPPORTED_CHAINS.POLYGON, name: 'Polygon', symbol: 'MATIC', icon: '⬟' },
    { id: SUPPORTED_CHAINS.ARBITRUM, name: 'Arbitrum', symbol: 'ETH', icon: '🔵' },
    { id: SUPPORTED_CHAINS.OPTIMISM, name: 'Optimism', symbol: 'ETH', icon: '🔴' },
    { id: SUPPORTED_CHAINS.BASE, name: 'Base', symbol: 'ETH', icon: '🔷' },
    { id: SUPPORTED_CHAINS.LINEA, name: 'Linea', symbol: 'ETH', icon: '📐' },
  ];

  const handleRiskToleranceChange = (risk: number) => {
    setPreferences(prev => ({ ...prev, riskTolerance: risk }));
  };

  const handleChainToggle = (chainId: number) => {
    setPreferences(prev => ({
      ...prev,
      preferredChains: prev.preferredChains.includes(chainId)
        ? prev.preferredChains.filter(id => id !== chainId)
        : [...prev.preferredChains, chainId]
    }));
  };

  const handleNotificationChange = (type: keyof UserPreferences['notificationSettings']) => {
    setPreferences(prev => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [type]: !prev.notificationSettings[type]
      }
    }));
  };

  const handleSubmit = async () => {
    if (preferences.preferredChains.length === 0) {
      showError('Validation Error', 'Please select at least one blockchain network');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save preferences to backend
      const response = await authAPI.updatePreferences(preferences);
      
      if (response.success) {
        showSuccess('Preferences Saved', 'Your preferences have been saved successfully');
        onComplete?.(preferences);
        router.push('/dashboard');
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error: any) {
      showError('Save Failed', error.message || 'Failed to save preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRiskToleranceStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Risk Tolerance</h3>
        <p className="text-muted-foreground">
          This helps us recommend appropriate yield strategies for your portfolio
        </p>
      </div>

      <div className="space-y-4">
        {riskLevels.map((level) => (
          <button
            key={level.value}
            onClick={() => handleRiskToleranceChange(level.value)}
            className={cn(
              'w-full p-4 rounded-lg border text-left transition-all',
              preferences.riskTolerance === level.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{level.label}</div>
                <div className="text-sm text-muted-foreground">
                  {level.value <= 3 && 'Stable returns with lower volatility'}
                  {level.value > 3 && level.value <= 6 && 'Balanced risk and reward'}
                  {level.value > 6 && 'Higher potential returns with increased risk'}
                </div>
              </div>
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: level.color }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderChainSelectionStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Preferred Networks</h3>
        <p className="text-muted-foreground">
          Select the blockchain networks you want to use with FlowBridge
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {supportedChains.map((chain) => (
          <button
            key={chain.id}
            onClick={() => handleChainToggle(chain.id)}
            className={cn(
              'p-4 rounded-lg border text-left transition-all',
              preferences.preferredChains.includes(chain.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{chain.icon}</span>
              <div>
                <div className="font-medium">{chain.name}</div>
                <div className="text-sm text-muted-foreground">{chain.symbol}</div>
              </div>
              {preferences.preferredChains.includes(chain.id) && (
                <div className="ml-auto">
                  <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderNotificationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Notification Preferences</h3>
        <p className="text-muted-foreground">
          Choose how you'd like to receive updates about your portfolio
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(preferences.notificationSettings).map(([key, enabled]) => (
          <div 
            key={key}
            className="flex items-center justify-between p-4 rounded-lg border"
          >
            <div>
              <div className="font-medium capitalize">{key} Notifications</div>
              <div className="text-sm text-muted-foreground">
                {key === 'email' && 'Receive updates via email'}
                {key === 'push' && 'Browser push notifications'}
                {key === 'sms' && 'Text message alerts'}
              </div>
            </div>
            <button
              onClick={() => handleNotificationChange(key as keyof UserPreferences['notificationSettings'])}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                enabled ? 'bg-primary' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  enabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFeaturesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Additional Features</h3>
        <p className="text-muted-foreground">
          Enable advanced features to enhance your experience
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <div className="font-medium">Auto-Rebalancing</div>
            <div className="text-sm text-muted-foreground">
              Automatically rebalance your portfolio based on AI recommendations
            </div>
          </div>
          <button
            onClick={() => setPreferences(prev => ({ ...prev, autoRebalance: !prev.autoRebalance }))}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              preferences.autoRebalance ? 'bg-primary' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                preferences.autoRebalance ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <div className="font-medium">MetaMask Card Integration</div>
            <div className="text-sm text-muted-foreground">
              Enable spending your yield directly with MetaMask Card
            </div>
          </div>
          <button
            onClick={() => setPreferences(prev => ({ ...prev, cardIntegration: !prev.cardIntegration }))}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              preferences.cardIntegration ? 'bg-primary' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                preferences.cardIntegration ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Setup Your Preferences</CardTitle>
        <CardDescription>
          Step {currentStep + 1} of {steps.length}: {steps[currentStep].description}
        </CardDescription>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {currentStep === 0 && renderRiskToleranceStep()}
        {currentStep === 1 && renderChainSelectionStep()}
        {currentStep === 2 && renderNotificationStep()}
        {currentStep === 3 && renderFeaturesStep()}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              variant="gradient"
            >
              Complete Setup
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SetupPreferences;
