// FlowBridge Frontend - Card Component
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/formatters';

const cardVariants = cva(
  'rounded-lg border bg-card text-card-foreground shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-border',
        outline: 'border-2 border-border',
        elevated: 'shadow-lg border-border/50',
        gradient: 'bg-gradient-to-br from-card via-card to-accent/10 border-border/50',
        glass: 'bg-card/80 backdrop-blur-sm border-border/50',
      },
      padding: {
        none: '',
        sm: 'p-4',
        default: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'default',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Specialized card components
export interface StatCardProps extends CardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  loading?: boolean;
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ 
    title, 
    value, 
    change, 
    changeType = 'neutral', 
    icon, 
    loading = false,
    className,
    ...props 
  }, ref) => {
    const changeColors = {
      positive: 'text-green-600',
      negative: 'text-red-600',
      neutral: 'text-gray-600',
    };

    return (
      <Card ref={ref} className={cn('p-6', className)} {...props}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-bold">{value}</p>
                {change && (
                  <span className={cn('text-sm font-medium', changeColors[changeType])}>
                    {changeType === 'positive' && '+'}
                    {change}
                  </span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="h-8 w-8 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </Card>
    );
  }
);
StatCard.displayName = 'StatCard';

// Portfolio card component
export interface PortfolioCardProps extends CardProps {
  name: string;
  totalValue: string;
  totalReturn: string;
  returnPercentage: string;
  isPositive: boolean;
  lastUpdated: string;
  onClick?: () => void;
}

const PortfolioCard = forwardRef<HTMLDivElement, PortfolioCardProps>(
  ({
    name,
    totalValue,
    totalReturn,
    returnPercentage,
    isPositive,
    lastUpdated,
    onClick,
    className,
    ...props
  }, ref) => {
    return (
      <Card 
        ref={ref}
        className={cn(
          'cursor-pointer transition-all hover:shadow-md',
          onClick && 'hover:scale-[1.02]',
          className
        )}
        onClick={onClick}
        {...props}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{name}</CardTitle>
          <CardDescription>Portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{totalValue}</span>
              <div className={cn(
                'text-sm font-medium',
                isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {isPositive ? '+' : ''}{returnPercentage}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total Return: {totalReturn}</span>
              <span>Updated {lastUpdated}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
PortfolioCard.displayName = 'PortfolioCard';

// Protocol card component
export interface ProtocolCardProps extends CardProps {
  name: string;
  category: string;
  apy: string;
  tvl: string;
  riskScore: number;
  logo?: string;
  onSelect?: () => void;
  selected?: boolean;
}

const ProtocolCard = forwardRef<HTMLDivElement, ProtocolCardProps>(
  ({
    name,
    category,
    apy,
    tvl,
    riskScore,
    logo,
    onSelect,
    selected = false,
    className,
    ...props
  }, ref) => {
    const getRiskColor = (score: number) => {
      if (score <= 30) return 'text-green-600 bg-green-100';
      if (score <= 60) return 'text-yellow-600 bg-yellow-100';
      return 'text-red-600 bg-red-100';
    };

    return (
      <Card
        ref={ref}
        className={cn(
          'cursor-pointer transition-all hover:shadow-md',
          selected && 'ring-2 ring-primary',
          className
        )}
        onClick={onSelect}
        {...props}
      >
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {logo && (
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <img src={logo} alt={name} className="h-6 w-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium truncate">{name}</h3>
                <span className="text-sm font-medium text-green-600">{apy}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-muted-foreground">{category}</span>
                <span className="text-xs text-muted-foreground">TVL: {tvl}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">Risk Score</span>
                <span className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  getRiskColor(riskScore)
                )}>
                  {riskScore}/100
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ProtocolCard.displayName = 'ProtocolCard';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  PortfolioCard,
  ProtocolCard,
  cardVariants,
};
