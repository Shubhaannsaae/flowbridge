// FlowBridge Frontend - Header Component
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMetaMask } from '../../hooks/useMetaMask';
import { useCardIntegration } from '../../hooks/useCardIntegration';
import { ConnectWalletButton } from '../ui/Button';
import { formatAddress, formatUSDValue } from '../../utils/web3';
import { getChainName } from '../../utils/web3';
import { SUPPORTED_CHAINS } from '../../utils/constants';
import { cn } from '../../utils/formatters';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const router = useRouter();
  const { 
    isConnected, 
    account, 
    chainId, 
    connect, 
    disconnect, 
    isConnecting,
    switchChain 
  } = useMetaMask();
  
  const { totalValueUSD, isCardLinked } = useCardIntegration();
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowAccountMenu(false);
      router.push('/');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const handleNetworkSwitch = async (targetChainId: number) => {
    try {
      await switchChain(targetChainId);
      setShowNetworkMenu(false);
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };

  const isActiveRoute = (path: string) => {
    return router.pathname === path;
  };

  const supportedNetworks = [
    { chainId: SUPPORTED_CHAINS.ETHEREUM, name: 'Ethereum', icon: '⟠' },
    { chainId: SUPPORTED_CHAINS.POLYGON, name: 'Polygon', icon: '⬟' },
    { chainId: SUPPORTED_CHAINS.ARBITRUM, name: 'Arbitrum', icon: '🔵' },
    { chainId: SUPPORTED_CHAINS.OPTIMISM, name: 'Optimism', icon: '🔴' },
    { chainId: SUPPORTED_CHAINS.BASE, name: 'Base', icon: '🔷' },
    { chainId: SUPPORTED_CHAINS.LINEA, name: 'Linea', icon: '📐' },
  ];

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className
    )}>
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">FB</span>
            </div>
            <span className="hidden sm:inline-block font-bold text-xl">FlowBridge</span>
          </Link>

          {/* Navigation Menu */}
          {isConnected && (
            <nav className="hidden md:flex items-center space-x-6 ml-8">
              <Link
                href="/dashboard"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  isActiveRoute('/dashboard') 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                )}
              >
                Dashboard
              </Link>
              <Link
                href="/yield"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  isActiveRoute('/yield') 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                )}
              >
                Yield Optimizer
              </Link>
              <Link
                href="/bridge"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  isActiveRoute('/bridge') 
                    ? 'text-primary' 
                    : 'text-muted-foreground'
                )}
              >
                Bridge
              </Link>
              {isCardLinked && (
                <Link
                  href="/card"
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    isActiveRoute('/card') 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                  )}
                >
                  Card
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {/* Card Balance Display */}
          {isConnected && isCardLinked && (
            <div className="hidden sm:flex items-center space-x-2 text-sm">
              <span className="text-muted-foreground">Card Balance:</span>
              <span className="font-medium">{formatUSDValue(totalValueUSD)}</span>
            </div>
          )}

          {/* Network Selector */}
          {isConnected && chainId && (
            <div className="relative">
              <button
                onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                className="flex items-center space-x-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <span>{supportedNetworks.find(n => n.chainId === chainId)?.icon || '🌐'}</span>
                <span className="hidden sm:inline">{getChainName(chainId)}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showNetworkMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover p-1 shadow-lg">
                  {supportedNetworks.map((network) => (
                    <button
                      key={network.chainId}
                      onClick={() => handleNetworkSwitch(network.chainId)}
                      className={cn(
                        'flex w-full items-center space-x-2 rounded-sm px-2 py-2 text-sm hover:bg-accent',
                        chainId === network.chainId && 'bg-accent'
                      )}
                    >
                      <span>{network.icon}</span>
                      <span>{network.name}</span>
                      {chainId === network.chainId && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Wallet Connection */}
          {isConnected && account ? (
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="flex items-center space-x-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                <span className="hidden sm:inline">{formatAddress(account)}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-md border bg-popover p-4 shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                      <div>
                        <p className="font-medium">{formatAddress(account, 6)}</p>
                        <p className="text-sm text-muted-foreground">{getChainName(chainId || 1)}</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-3 space-y-2">
                      <Link
                        href="/settings"
                        className="flex items-center space-x-2 rounded-sm px-2 py-2 text-sm hover:bg-accent w-full"
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Settings</span>
                      </Link>
                      
                      <button
                        onClick={handleDisconnect}
                        className="flex items-center space-x-2 rounded-sm px-2 py-2 text-sm hover:bg-accent w-full text-left"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ConnectWalletButton
              isConnected={isConnected}
              walletAddress={account}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              loading={isConnecting}
            />
          )}

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Click outside handlers */}
      {(showNetworkMenu || showAccountMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNetworkMenu(false);
            setShowAccountMenu(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;
