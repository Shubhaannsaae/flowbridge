// FlowBridge Frontend - Dashboard Layout Component
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useMetaMask } from '../../hooks/useMetaMask';
import { useToastNotification } from '../ui/Toast';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { PageLoading } from '../ui/LoadingSpinner';
import { cn } from '../../utils/formatters';

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
  showFooter?: boolean;
  requireAuth?: boolean;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className,
  showSidebar = true,
  showFooter = false,
  requireAuth = true,
}) => {
  const router = useRouter();
  const { isConnected, isConnecting, account, error } = useMetaMask();
  const { error: showError } = useToastNotification();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle authentication redirect
  useEffect(() => {
    if (mounted && requireAuth && !isConnecting && !isConnected) {
      router.push('/onboarding');
    }
  }, [mounted, requireAuth, isConnecting, isConnected, router]);

  // Handle wallet errors
  useEffect(() => {
    if (error) {
      showError('Wallet Error', error);
    }
  }, [error, showError]);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Loading state
  if (!mounted || (requireAuth && isConnecting)) {
    return (
      <PageLoading 
        message="Connecting to MetaMask..." 
        showLogo={true}
      />
    );
  }

  // Authentication required but not connected
  if (requireAuth && !isConnected) {
    return (
      <PageLoading 
        message="Redirecting to onboarding..." 
        showLogo={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        {showSidebar && isConnected && (
          <Sidebar 
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
          />
        )}

        {/* Main Content */}
        <main 
          className={cn(
            'flex-1 overflow-y-auto',
            showSidebar && isConnected && 'lg:border-l',
            className
          )}
        >
          <div className="container mx-auto p-6">
            {children}
          </div>
          
          {/* Footer in main content area */}
          {showFooter && (
            <div className="mt-auto">
              <Footer />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showSidebar && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
    </div>
  );
};

// HOC for pages that require authentication
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const AuthenticatedComponent = (props: P) => {
    return (
      <DashboardLayout requireAuth={true}>
        <Component {...props} />
      </DashboardLayout>
    );
  };

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  return AuthenticatedComponent;
};

// HOC for public pages
export const withPublicLayout = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    showSidebar?: boolean;
    showFooter?: boolean;
  } = {}
) => {
  const PublicComponent = (props: P) => {
    return (
      <DashboardLayout 
        requireAuth={false}
        showSidebar={options.showSidebar ?? false}
        showFooter={options.showFooter ?? true}
      >
        <Component {...props} />
      </DashboardLayout>
    );
  };

  PublicComponent.displayName = `withPublicLayout(${Component.displayName || Component.name})`;
  return PublicComponent;
};

// Error Boundary for Dashboard
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L3.296 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground max-w-md">
              An unexpected error occurred. Please refresh the page or contact support if the problem persists.
            </p>
            <div className="space-x-4">
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Refresh Page
              </button>
              <button 
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 border border-input rounded-md hover:bg-accent"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-muted p-4 rounded overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardLayout;
