// FlowBridge Frontend - Connect Wallet Component
import React, { useState, useEffect } from 'react';
import { useMetaMask, useMetaMaskInstallation } from '../../../hooks/useMetaMask';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useToastNotification } from '../../ui/Toast';
import { EXTERNAL_LINKS } from '../../../utils/constants';
import { cn } from '../../../utils/formatters';

interface ConnectWalletProps {
  onConnect?: () => void;
  className?: string;
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect, className }) => {
  const { connect, isConnected, isConnecting, account, error } = useMetaMask();
  const { isInstalled, isChecking } = useMetaMaskInstallation();
  const { success: showSuccess, error: showError } = useToastNotification();
  
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  // Handle successful connection
  useEffect(() => {
    if (isConnected && account && hasAttemptedConnection) {
      showSuccess('Wallet Connected', `Connected to ${account.slice(0, 6)}...${account.slice(-4)}`);
      onConnect?.();
    }
  }, [isConnected, account, hasAttemptedConnection, showSuccess, onConnect]);

  // Handle connection errors
  useEffect(() => {
    if (error && hasAttemptedConnection) {
      showError('Connection Failed', error);
      setHasAttemptedConnection(false);
    }
  }, [error, hasAttemptedConnection, showError]);

  const handleConnect = async () => {
    if (!isInstalled) {
      window.open(EXTERNAL_LINKS.METAMASK_DOWNLOAD, '_blank');
      return;
    }

    try {
      setHasAttemptedConnection(true);
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
      setHasAttemptedConnection(false);
    }
  };

  if (isChecking) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  if (isConnected && account) {
    return (
      <Card className={cn('border-green-200 bg-green-50', className)}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Wallet Connected</h3>
              <p className="text-sm text-green-700">
                {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.763 12.574c-.055-.03-.462-.23-.462-.23l-.415-.22s-.24-.144-.462-.23l.415.22.924.46z"/>
            <path d="M23.301 11.914l-.924-.46-.415-.22s-.24-.144-.462-.23c-.055-.03-.924-.46-.924-.46L19.65 10.084l-.924-.46-.415-.22s-.24-.144-.462-.23l.415.22.924.46z"/>
            <path d="M22.839 11.254l-.924-.46-.415-.22s-.24-.144-.462-.23l.415.22.924.46z"/>
          </svg>
        </div>
        <CardTitle>Connect Your Wallet</CardTitle>
        <CardDescription>
          Connect with MetaMask to access FlowBridge's DeFi features
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isInstalled ? (
          <>
            <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
              <div className="flex items-start space-x-3">
                <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.296 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="font-medium text-yellow-800">MetaMask Not Detected</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You'll need to install MetaMask to continue. Click the button below to download it.
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleConnect}
              className="w-full"
              size="lg"
            >
              Install MetaMask
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Secure connection with MetaMask</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>No personal information stored</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Cross-platform support</span>
              </div>
            </div>

            <Button 
              onClick={handleConnect}
              loading={isConnecting}
              className="w-full"
              size="lg"
              variant="gradient"
            >
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200">
            <div className="flex items-start space-x-3">
              <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-red-800">Connection Failed</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>
            By connecting, you agree to our{' '}
            <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectWallet;
