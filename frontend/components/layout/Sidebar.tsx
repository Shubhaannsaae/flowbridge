// FlowBridge Frontend - Sidebar Component
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMetaMask } from '../../hooks/useMetaMask';
import { useCardIntegration } from '../../hooks/useCardIntegration';
import { cn } from '../../utils/formatters';

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  description?: string;
  requiresCard?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  className, 
  collapsed = false, 
  onCollapse 
}) => {
  const router = useRouter();
  const { isConnected } = useMetaMask();
  const { isCardLinked } = useCardIntegration();

  const navigationItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H10a2 2 0 01-2-2V5z" />
        </svg>
      ),
      description: 'Overview of your portfolio'
    },
    {
      name: 'Yield Optimizer',
      href: '/yield',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      description: 'AI-powered yield strategies'
    },
    {
      name: 'Cross-Chain Bridge',
      href: '/bridge',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      description: 'Move assets across chains'
    },
    {
      name: 'Card & Spending',
      href: '/card',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      description: 'MetaMask Card integration',
      requiresCard: true,
      badge: isCardLinked ? undefined : 'Setup'
    },
    {
      name: 'Portfolio Analytics',
      href: '/analytics',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      description: 'Detailed performance metrics'
    },
    {
      name: 'AI Insights',
      href: '/insights',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      description: 'AI-generated recommendations'
    }
  ];

  const bottomNavigationItems: NavItem[] = [
    {
      name: 'Settings',
      href: '/settings',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'Account preferences'
    },
    {
      name: 'Help & Support',
      href: '/help',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: 'Get help and documentation'
    }
  ];

  const isActiveRoute = (path: string) => {
    return router.pathname === path || router.pathname.startsWith(path + '/');
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isActiveRoute(item.href);
    const isDisabled = item.requiresCard && !isCardLinked;

    return (
      <Link
        key={item.name}
        href={isDisabled ? '#' : item.href}
        className={cn(
          'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all',
          collapsed ? 'justify-center' : 'justify-start',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
          }
        }}
      >
        <span className={cn('flex-shrink-0', !collapsed && 'mr-3')}>
          {item.icon}
        </span>
        
        {!collapsed && (
          <>
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {item.badge}
              </span>
            )}
          </>
        )}

        {collapsed && (
          <div className="absolute left-full ml-2 hidden group-hover:block z-50">
            <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-lg">
              <div className="font-medium">{item.name}</div>
              {item.description && (
                <div className="text-muted-foreground text-xs mt-1">
                  {item.description}
                </div>
              )}
              {item.badge && (
                <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </div>
          </div>
        )}
      </Link>
    );
  };

  if (!isConnected) {
    return null;
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Collapse Toggle */}
      <div className="flex items-center justify-between p-4">
        {!collapsed && (
          <h2 className="text-lg font-semibold">Navigation</h2>
        )}
        <button
          onClick={() => onCollapse?.(!collapsed)}
          className="rounded-md p-1 hover:bg-accent"
        >
          <svg 
            className={cn(
              'h-5 w-5 transition-transform',
              collapsed ? 'rotate-180' : ''
            )} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-4 pt-0">
        {navigationItems.map(renderNavItem)}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t p-4 space-y-1">
        {bottomNavigationItems.map(renderNavItem)}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t p-4">
          <div className="text-xs text-muted-foreground">
            <p>FlowBridge v1.0.0</p>
            <p className="mt-1">
              Powered by{' '}
              <a 
                href="https://metamask.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MetaMask
              </a>
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
