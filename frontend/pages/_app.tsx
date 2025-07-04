// FlowBridge Frontend - Next.js App Component
import React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { MetaMaskProvider } from '@metamask/sdk-react';
import { ErrorBoundary } from 'react-error-boundary';
import { DashboardErrorBoundary } from '../components/layout/DashboardLayout';
import { ToastProvider } from '../components/ui/Toast';
import '../styles/globals.css';

// MetaMask SDK configuration
const sdkOptions = {
  dappMetadata: {
    name: 'FlowBridge',
    url: typeof window !== 'undefined' ? window.location.href : 'https://flowbridge.app',
    iconUrl: 'https://flowbridge.app/icon.png',
  },
  infuraAPIKey: process.env.NEXT_PUBLIC_INFURA_API_KEY,
  // Enable logging in development
  logging: {
    developerMode: process.env.NODE_ENV === 'development',
  },
  // Configure for mobile and desktop
  useDeeplink: true,
  checkInstallationImmediately: false,
  // Storage configuration
  storage: {
    enabled: true,
  },
  // i18n configuration
  i18nOptions: {
    enabled: true,
  },
};

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.296 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6 max-w-md">
          An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
        </p>
        <div className="space-x-4">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Refresh Page
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">Error Details (Development)</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto max-w-md">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function FlowBridgeApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FlowBridge - Next-Generation DeFi Platform</title>
        <meta name="description" content="The next-generation DeFi platform that seamlessly integrates yield optimization, cross-chain bridging, and MetaMask Card spending." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://flowbridge.app/" />
        <meta property="og:title" content="FlowBridge - Next-Generation DeFi Platform" />
        <meta property="og:description" content="Seamlessly integrate yield optimization, cross-chain bridging, and MetaMask Card spending." />
        <meta property="og:image" content="https://flowbridge.app/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://flowbridge.app/" />
        <meta property="twitter:title" content="FlowBridge - Next-Generation DeFi Platform" />
        <meta property="twitter:description" content="Seamlessly integrate yield optimization, cross-chain bridging, and MetaMask Card spending." />
        <meta property="twitter:image" content="https://flowbridge.app/og-image.png" />

        {/* Security */}
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' *.metamask.io *.infura.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' *.metamask.io *.infura.io *.li.fi wss: https:;" />
      </Head>

      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error, errorInfo) => {
          console.error('Application error:', error, errorInfo);
          // Report to error tracking service in production
          if (process.env.NODE_ENV === 'production') {
            // Example: Sentry.captureException(error);
          }
        }}
      >
        <MetaMaskProvider debug={false} sdkOptions={sdkOptions}>
          <ToastProvider>
            <DashboardErrorBoundary>
              <Component {...pageProps} />
            </DashboardErrorBoundary>
          </ToastProvider>
        </MetaMaskProvider>
      </ErrorBoundary>
    </>
  );
}

export default FlowBridgeApp;
