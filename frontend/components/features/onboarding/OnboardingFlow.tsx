// FlowBridge Frontend - Onboarding Flow Component
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useMetaMask } from '../../../hooks/useMetaMask';
import { useToastNotification } from '../../ui/Toast';
import { LOCAL_STORAGE_KEYS } from '../../../utils/constants';
import ConnectWallet from './ConnectWallet';
import SetupPreferences from './SetupPreferences';
import { PageLoading } from '../../ui/LoadingSpinner';

interface OnboardingFlowProps {
  className?: string;
}

enum OnboardingStep {
  CONNECT_WALLET = 'connect_wallet',
  SETUP_PREFERENCES = 'setup_preferences',
  COMPLETE = 'complete'
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ className }) => {
  const router = useRouter();
  const { isConnected, account, isConnecting } = useMetaMask();
  const { success: showSuccess } = useToastNotification();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.CONNECT_WALLET);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has already completed onboarding
  useEffect(() => {
    const checkOnboardingStatus = () => {
      const onboardingCompleted = localStorage.getItem(LOCAL_STORAGE_KEYS.ONBOARDING_COMPLETED);
      
      if (onboardingCompleted === 'true' && isConnected) {
        router.push('/dashboard');
        return;
      }

      // Determine current step based on connection status
      if (isConnected && account) {
        setCurrentStep(OnboardingStep.SETUP_PREFERENCES);
      } else {
        setCurrentStep(OnboardingStep.CONNECT_WALLET);
      }
      
      setIsLoading(false);
    };

    // Wait for initial MetaMask connection check
    if (!isConnecting) {
      checkOnboardingStatus();
    }
  }, [isConnected, account, isConnecting, router]);

  // Handle wallet connection
  const handleWalletConnected = () => {
    setCurrentStep(OnboardingStep.SETUP_PREFERENCES);
  };

  // Handle preferences completion
  const handlePreferencesComplete = () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
    showSuccess('Welcome to FlowBridge!', 'Your account has been set up successfully');
    
    setCurrentStep(OnboardingStep.COMPLETE);
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  };

  // Loading state
  if (isLoading || isConnecting) {
    return (
      <PageLoading 
        message="Initializing FlowBridge..." 
        showLogo={true}
      />
    );
  }

  // Completion state
  if (currentStep === OnboardingStep.COMPLETE) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center space-y-6 max-w-md mx-auto p-8">
          <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Welcome to FlowBridge!</h1>
            <p className="text-gray-600">
              Your account has been set up successfully. Redirecting to your dashboard...
            </p>
          </div>
          
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">FB</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">FlowBridge</h1>
          </div>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The next-generation DeFi platform that seamlessly integrates yield optimization, 
            cross-chain bridging, and MetaMask Card spending.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="max-w-lg mx-auto mb-8">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 ${
              currentStep === OnboardingStep.CONNECT_WALLET ? 'text-blue-600' : 'text-green-600'
            }`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                currentStep === OnboardingStep.CONNECT_WALLET 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-green-600 text-white'
              }`}>
                {currentStep === OnboardingStep.CONNECT_WALLET ? (
                  <span className="text-sm font-bold">1</span>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="font-medium">Connect Wallet</span>
            </div>
            
            <div className={`h-1 flex-1 mx-4 ${
              currentStep === OnboardingStep.SETUP_PREFERENCES ? 'bg-blue-600' : 'bg-gray-300'
            }`} />
            
            <div className={`flex items-center space-x-2 ${
              currentStep === OnboardingStep.SETUP_PREFERENCES ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                currentStep === OnboardingStep.SETUP_PREFERENCES 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-600'
              }`}>
                <span className="text-sm font-bold">2</span>
              </div>
              <span className="font-medium">Setup Preferences</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {currentStep === OnboardingStep.CONNECT_WALLET && (
            <ConnectWallet 
              onConnect={handleWalletConnected}
              className={className}
            />
          )}
          
          {currentStep === OnboardingStep.SETUP_PREFERENCES && (
            <SetupPreferences 
              onComplete={handlePreferencesComplete}
              className={className}
            />
          )}
        </div>

        {/* Features Preview */}
        <div className="max-w-6xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">What you'll get with FlowBridge</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg bg-white shadow-sm">
              <div className="h-12 w-12 mx-auto mb-4 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">AI-Powered Yield Optimization</h3>
              <p className="text-sm text-gray-600">
                Let our AI find the best yield opportunities across DeFi protocols automatically.
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-white shadow-sm">
              <div className="h-12 w-12 mx-auto mb-4 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Seamless Cross-Chain</h3>
              <p className="text-sm text-gray-600">
                Move assets across multiple blockchains with integrated LI.FI bridge technology.
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-white shadow-sm">
              <div className="h-12 w-12 mx-auto mb-4 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">MetaMask Card Integration</h3>
              <p className="text-sm text-gray-600">
                Spend your yield directly in the real world with MetaMask Card integration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
