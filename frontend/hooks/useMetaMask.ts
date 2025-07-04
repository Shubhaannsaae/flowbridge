// FlowBridge Frontend - MetaMask SDK Hook
import { useSDK } from '@metamask/sdk-react';
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { authAPI } from '../utils/api';
import { isValidAddress, getChainName } from '../utils/web3';
import { SUPPORTED_CHAINS } from '../utils/constants';

interface UseMetaMaskReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  chainId: number | null;
  provider: ethers.providers.Web3Provider | null;
  
  // Installation state
  isInstalled: boolean;
  isInstalling: boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  addChain: (chainConfig: any) => Promise<void>;
  
  // Authentication
  isAuthenticated: boolean;
  authenticate: () => Promise<string>;
  token: string | null;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

interface AuthenticationData {
  token: string;
  user: {
    address: string;
    chainId: number;
    nonce: string;
  };
}

export function useMetaMask(): UseMetaMaskReturn {
  const { 
    sdk, 
    connected, 
    connecting, 
    provider: sdkProvider, 
    chainId: sdkChainId, 
    account: sdkAccount 
  } = useSDK();

  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize provider when SDK provider changes
  useEffect(() => {
    if (sdkProvider) {
      const ethersProvider = new ethers.providers.Web3Provider(sdkProvider, 'any');
      setProvider(ethersProvider);
      setIsInstalled(true);
    } else {
      setProvider(null);
    }
  }, [sdkProvider]);

  // Check authentication on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('flowbridge_auth_token');
    if (storedToken && connected && sdkAccount) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
  }, [connected, sdkAccount]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      
      if (!sdk) {
        throw new Error('MetaMask SDK not initialized');
      }

      await sdk.connect();
    } catch (err: any) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect to MetaMask');
      throw err;
    }
  }, [sdk]);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      
      if (sdk) {
        await sdk.disconnect();
      }
      
      // Clear authentication
      setIsAuthenticated(false);
      setToken(null);
      localStorage.removeItem('flowbridge_auth_token');
      localStorage.removeItem('flowbridge_user_data');
    } catch (err: any) {
      console.error('Disconnect failed:', err);
      setError(err.message || 'Failed to disconnect');
      throw err;
    }
  }, [sdk]);

  const switchChain = useCallback(async (targetChainId: number) => {
    try {
      setError(null);
      
      if (!provider || !sdkAccount) {
        throw new Error('Wallet not connected');
      }

      const chainIdHex = `0x${targetChainId.toString(16)}`;
      
      try {
        await provider.send('wallet_switchEthereumChain', [{ chainId: chainIdHex }]);
      } catch (switchError: any) {
        // If chain is not added, try to add it
        if (switchError.code === 4902) {
          throw new Error(`Chain ${targetChainId} not added to wallet. Please add it manually.`);
        }
        throw switchError;
      }
    } catch (err: any) {
      console.error('Chain switch failed:', err);
      setError(err.message || 'Failed to switch chain');
      throw err;
    }
  }, [provider, sdkAccount]);

  const addChain = useCallback(async (chainConfig: any) => {
    try {
      setError(null);
      
      if (!provider) {
        throw new Error('Wallet not connected');
      }

      await provider.send('wallet_addEthereumChain', [chainConfig]);
    } catch (err: any) {
      console.error('Add chain failed:', err);
      setError(err.message || 'Failed to add chain');
      throw err;
    }
  }, [provider]);

  const authenticate = useCallback(async (): Promise<string> => {
    try {
      setError(null);
      
      if (!connected || !sdkAccount || !provider) {
        throw new Error('Wallet not connected');
      }

      if (!isValidAddress(sdkAccount)) {
        throw new Error('Invalid wallet address');
      }

      // Get authentication challenge
      const challengeResponse = await authAPI.getChallenge(sdkAccount);
      if (!challengeResponse.success || !challengeResponse.message) {
        throw new Error('Failed to get authentication challenge');
      }

      // Sign the challenge message
      const signer = provider.getSigner();
      const signature = await signer.signMessage(challengeResponse.message);

      // Verify signature and get token
      const authResponse = await authAPI.authenticate({
        address: sdkAccount,
        signature,
        message: challengeResponse.message,
        chainId: sdkChainId || SUPPORTED_CHAINS.ETHEREUM,
      });

      if (!authResponse.success || !authResponse.token) {
        throw new Error(authResponse.error || 'Authentication failed');
      }

      const authData: AuthenticationData = {
        token: authResponse.token,
        user: authResponse.user!,
      };

      // Store authentication data
      setToken(authData.token);
      setIsAuthenticated(true);
      localStorage.setItem('flowbridge_auth_token', authData.token);
      localStorage.setItem('flowbridge_user_data', JSON.stringify(authData.user));

      return authData.token;
    } catch (err: any) {
      console.error('Authentication failed:', err);
      setError(err.message || 'Authentication failed');
      throw err;
    }
  }, [connected, sdkAccount, provider, sdkChainId]);

  return {
    // Connection state
    isConnected: connected,
    isConnecting: connecting,
    account: sdkAccount,
    chainId: sdkChainId,
    provider,
    
    // Installation state
    isInstalled,
    isInstalling,
    
    // Actions
    connect,
    disconnect,
    switchChain,
    addChain,
    
    // Authentication
    isAuthenticated,
    authenticate,
    token,
    
    // Error handling
    error,
    clearError,
  };
}

// Hook for checking MetaMask installation
export function useMetaMaskInstallation() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkInstallation = () => {
      const isMetaMaskInstalled = typeof window !== 'undefined' && 
        typeof window.ethereum !== 'undefined' && 
        window.ethereum.isMetaMask;
      
      setIsInstalled(isMetaMaskInstalled);
      setIsChecking(false);
    };

    // Check immediately
    checkInstallation();

    // Also check after a short delay in case MetaMask loads asynchronously
    const timer = setTimeout(checkInstallation, 1000);
    return () => clearTimeout(timer);
  }, []);

  return { isInstalled, isChecking };
}

export default useMetaMask;
