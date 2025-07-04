// FlowBridge Frontend - Loading Spinner Component
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/formatters';

const spinnerVariants = cva(
  'animate-spin rounded-full border-solid border-current',
  {
    variants: {
      size: {
        xs: 'h-3 w-3 border-[1px]',
        sm: 'h-4 w-4 border-[1px]',
        default: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-2',
        xl: 'h-12 w-12 border-[3px]',
        '2xl': 'h-16 w-16 border-[3px]',
      },
      variant: {
        default: 'border-gray-300 border-t-gray-900',
        primary: 'border-blue-200 border-t-blue-600',
        secondary: 'border-purple-200 border-t-purple-600',
        success: 'border-green-200 border-t-green-600',
        warning: 'border-yellow-200 border-t-yellow-600',
        error: 'border-red-200 border-t-red-600',
        white: 'border-white/30 border-t-white',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  }
);

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

const LoadingSpinner = forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size, variant, label, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(spinnerVariants({ size, variant }), className)}
      role="status"
      aria-label={label || 'Loading'}
      {...props}
    >
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  )
);
LoadingSpinner.displayName = 'LoadingSpinner';

// Dots loading indicator
export interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'primary' | 'secondary';
}

const LoadingDots = forwardRef<HTMLDivElement, LoadingDotsProps>(
  ({ className, size = 'default', variant = 'default', ...props }, ref) => {
    const dotSizes = {
      sm: 'w-1 h-1',
      default: 'w-2 h-2',
      lg: 'w-3 h-3',
    };

    const dotColors = {
      default: 'bg-gray-500',
      primary: 'bg-blue-600',
      secondary: 'bg-purple-600',
    };

    return (
      <div
        ref={ref}
        className={cn('flex space-x-1', className)}
        role="status"
        aria-label="Loading"
        {...props}
      >
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={cn(
              'rounded-full animate-pulse',
              dotSizes[size],
              dotColors[variant]
            )}
            style={{
              animationDelay: `${index * 0.1}s`,
              animationDuration: '0.6s',
              animationIterationCount: 'infinite',
            }}
          />
        ))}
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
);
LoadingDots.displayName = 'LoadingDots';

// Skeleton loading component
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ 
    className, 
    variant = 'rectangular', 
    width, 
    height, 
    lines = 1,
    ...props 
  }, ref) => {
    const baseClasses = 'animate-pulse bg-gray-300 dark:bg-gray-700';
    
    const variantClasses = {
      text: 'h-4 rounded',
      rectangular: 'rounded',
      circular: 'rounded-full',
    };

    if (variant === 'text' && lines > 1) {
      return (
        <div ref={ref} className={cn('space-y-2', className)} {...props}>
          {Array.from({ length: lines }).map((_, index) => (
            <div
              key={index}
              className={cn(
                baseClasses,
                variantClasses[variant],
                index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
              )}
              style={{ 
                width: index === lines - 1 && lines > 1 ? '75%' : width,
                height: height || '1rem'
              }}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        style={{ width, height }}
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

// Page loading component
export interface PageLoadingProps {
  message?: string;
  showLogo?: boolean;
}

const PageLoading = forwardRef<HTMLDivElement, PageLoadingProps>(
  ({ message = 'Loading...', showLogo = true }, ref) => (
    <div
      ref={ref}
      className="flex flex-col items-center justify-center min-h-screen space-y-4"
    >
      {showLogo && (
        <div className="mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">FB</span>
          </div>
        </div>
      )}
      <LoadingSpinner size="xl" variant="primary" />
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  )
);
PageLoading.displayName = 'PageLoading';

// Inline loading component
export interface InlineLoadingProps {
  message?: string;
  size?: 'sm' | 'default' | 'lg';
}

const InlineLoading = forwardRef<HTMLDivElement, InlineLoadingProps>(
  ({ message = 'Loading...', size = 'default' }, ref) => (
    <div ref={ref} className="flex items-center space-x-2">
      <LoadingSpinner size={size} variant="primary" />
      <span className="text-sm text-gray-600">{message}</span>
    </div>
  )
);
InlineLoading.displayName = 'InlineLoading';

// Button loading component
export interface ButtonLoadingProps {
  size?: 'sm' | 'default' | 'lg';
  variant?: 'white' | 'primary';
}

const ButtonLoading = forwardRef<HTMLDivElement, ButtonLoadingProps>(
  ({ size = 'default', variant = 'white' }, ref) => (
    <LoadingSpinner
      ref={ref}
      size={size}
      variant={variant}
      className="mr-2"
    />
  )
);
ButtonLoading.displayName = 'ButtonLoading';

export {
  LoadingSpinner,
  LoadingDots,
  Skeleton,
  PageLoading,
  InlineLoading,
  ButtonLoading,
  spinnerVariants,
};
