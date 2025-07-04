// FlowBridge Frontend - Performance Chart Component
import React, { useState, useMemo } from 'react';
import { useYieldData } from '../../hooks/useYieldData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner, Skeleton } from '../ui/LoadingSpinner';
import { formatUSDValue, formatPercentage, formatDateTime } from '../../utils/formatters';
import { cn } from '../../utils/formatters';

interface PerformanceChartProps {
  portfolioId?: string;
  className?: string;
  height?: number;
}

interface PerformanceDataPoint {
  timestamp: string;
  portfolioValue: number;
  totalReturn: number;
  dailyReturn: number;
  benchmark: number;
}

interface ChartSettings {
  timeframe: '7d' | '30d' | '90d' | '1y';
  comparison: 'none' | 'eth' | 'btc' | 'sp500';
  showBenchmark: boolean;
  metric: 'absolute' | 'percentage';
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ 
  portfolioId, 
  className,
  height = 400 
}) => {
  const { strategies, strategiesLoading } = useYieldData(portfolioId);
  
  const [settings, setSettings] = useState<ChartSettings>({
    timeframe: '30d',
    comparison: 'eth',
    showBenchmark: true,
    metric: 'percentage',
  });

  const [hoveredPoint, setHoveredPoint] = useState<PerformanceDataPoint | null>(null);
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null);

  // Generate performance data
  const performanceData = useMemo(() => {
    if (!strategies || strategies.length === 0) return [];

    // Generate mock performance data based on strategies
    const days = (() => {
      switch (settings.timeframe) {
        case '7d': return 7;
        case '30d': return 30;
        case '90d': return 90;
        case '1y': return 365;
        default: return 30;
      }
    })();

    const data: PerformanceDataPoint[] = [];
    const baseValue = strategies.reduce((sum, s) => sum + parseFloat(s.deployedAmount || '0'), 0);
    const currentValue = strategies.reduce((sum, s) => sum + parseFloat(s.currentValue || '0'), 0);
    const totalGrowth = currentValue - baseValue;

    for (let i = 0; i < days; i++) {
      const progress = i / (days - 1);
      const timestamp = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString();
      
      // Simulate realistic performance curve
      const growthFactor = Math.sin(progress * Math.PI * 0.5) * progress;
      const portfolioValue = baseValue + (totalGrowth * growthFactor);
      const totalReturn = portfolioValue - baseValue;
      const dailyReturn = i > 0 ? (portfolioValue - data[i - 1].portfolioValue) / data[i - 1].portfolioValue * 100 : 0;
      
      // Benchmark comparison (ETH, BTC, etc.)
      const benchmarkMultiplier = (() => {
        switch (settings.comparison) {
          case 'eth': return 0.8; // Assume ETH grew 80% of our performance
          case 'btc': return 0.6; // BTC grew 60%
          case 'sp500': return 0.3; // S&P 500 grew 30%
          default: return 0;
        }
      })();
      const benchmark = baseValue + (totalGrowth * growthFactor * benchmarkMultiplier);

      data.push({
        timestamp,
        portfolioValue,
        totalReturn,
        dailyReturn,
        benchmark,
      });
    }

    return data;
  }, [strategies, settings.timeframe, settings.comparison]);

  // Calculate chart metrics
  const chartMetrics = useMemo(() => {
    if (performanceData.length === 0) return null;

    const values = performanceData.map(d => 
      settings.metric === 'percentage' 
        ? (d.portfolioValue / performanceData[0].portfolioValue - 1) * 100
        : d.portfolioValue
    );

    const benchmarkValues = settings.showBenchmark 
      ? performanceData.map(d => 
          settings.metric === 'percentage'
            ? (d.benchmark / performanceData[0].portfolioValue - 1) * 100
            : d.benchmark
        )
      : [];

    const allValues = [...values, ...benchmarkValues];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const padding = (maxValue - minValue) * 0.1;

    return {
      minValue: minValue - padding,
      maxValue: maxValue + padding,
      range: maxValue - minValue + (padding * 2),
      portfolioValues: values,
      benchmarkValues,
    };
  }, [performanceData, settings.metric, settings.showBenchmark]);

  // Generate SVG paths
  const generatePaths = useMemo(() => {
    if (!chartMetrics || performanceData.length === 0) return { portfolio: '', benchmark: '' };

    const width = 800;
    const chartHeight = height - 80;

    // Portfolio path
    const portfolioPoints = chartMetrics.portfolioValues.map((value, index) => {
      const x = (index / (performanceData.length - 1)) * width;
      const y = chartHeight - ((value - chartMetrics.minValue) / chartMetrics.range) * chartHeight;
      return `${x},${y}`;
    });

    const portfolioPath = `M ${portfolioPoints.join(' L ')}`;

    // Benchmark path
    let benchmarkPath = '';
    if (settings.showBenchmark && chartMetrics.benchmarkValues.length > 0) {
      const benchmarkPoints = chartMetrics.benchmarkValues.map((value, index) => {
        const x = (index / (performanceData.length - 1)) * width;
        const y = chartHeight - ((value - chartMetrics.minValue) / chartMetrics.range) * chartHeight;
        return `${x},${y}`;
      });
      benchmarkPath = `M ${benchmarkPoints.join(' L ')}`;
    }

    return { portfolio: portfolioPath, benchmark: benchmarkPath };
  }, [chartMetrics, performanceData, settings.showBenchmark, height]);

  // Handle mouse events
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef || performanceData.length === 0) return;

    const rect = svgRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;

    const dataIndex = Math.round((x / width) * (performanceData.length - 1));
    const boundedIndex = Math.max(0, Math.min(performanceData.length - 1, dataIndex));

    setHoveredPoint(performanceData[boundedIndex]);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Format values
  const formatValue = (value: number, isPercentage = false) => {
    return isPercentage || settings.metric === 'percentage' 
      ? formatPercentage(value)
      : formatUSDValue(value);
  };

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (performanceData.length === 0) return null;

    const first = performanceData[0];
    const last = performanceData[performanceData.length - 1];
    
    const totalReturn = ((last.portfolioValue - first.portfolioValue) / first.portfolioValue) * 100;
    const annualizedReturn = settings.timeframe === '1y' 
      ? totalReturn 
      : totalReturn * (365 / performanceData.length);
    
    // Calculate volatility (standard deviation of daily returns)
    const dailyReturns = performanceData.slice(1).map(d => d.dailyReturn);
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized

    // Sharpe ratio (assuming 2% risk-free rate)
    const sharpeRatio = (annualizedReturn - 2) / volatility;

    // Max drawdown
    let maxDrawdown = 0;
    let peak = first.portfolioValue;
    performanceData.forEach(point => {
      if (point.portfolioValue > peak) {
        peak = point.portfolioValue;
      }
      const drawdown = ((peak - point.portfolioValue) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
    };
  }, [performanceData, settings.timeframe]);

  if (strategiesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <Skeleton height={`${height}px`} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span>Performance Analysis</span>
          </CardTitle>

          <div className="flex items-center space-x-2">
            {/* Metric Selector */}
            <select
              value={settings.metric}
              onChange={(e) => setSettings(prev => ({ ...prev, metric: e.target.value as any }))}
              className="px-3 py-1 border border-input rounded text-sm bg-background"
            >
              <option value="percentage">Percentage</option>
              <option value="absolute">Absolute</option>
            </select>

            {/* Comparison Selector */}
            <select
              value={settings.comparison}
              onChange={(e) => setSettings(prev => ({ ...prev, comparison: e.target.value as any }))}
              className="px-3 py-1 border border-input rounded text-sm bg-background"
            >
              <option value="none">No Comparison</option>
              <option value="eth">vs ETH</option>
              <option value="btc">vs BTC</option>
              <option value="sp500">vs S&P 500</option>
            </select>

            {/* Timeframe Selector */}
            <select
              value={settings.timeframe}
              onChange={(e) => setSettings(prev => ({ ...prev, timeframe: e.target.value as any }))}
              className="px-3 py-1 border border-input rounded text-sm bg-background"
            >
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
              <option value="1y">1 Year</option>
            </select>
          </div>
        </div>

        {/* Performance Metrics */}
        {performanceMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="text-center">
              <div className={cn(
                'text-2xl font-bold',
                performanceMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {formatPercentage(performanceMetrics.totalReturn)}
              </div>
              <div className="text-sm text-muted-foreground">Total Return</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatPercentage(performanceMetrics.annualizedReturn)}
              </div>
              <div className="text-sm text-muted-foreground">Annualized</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {performanceMetrics.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatPercentage(performanceMetrics.volatility)}
              </div>
              <div className="text-sm text-muted-foreground">Volatility</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                -{formatPercentage(performanceMetrics.maxDrawdown)}
              </div>
              <div className="text-sm text-muted-foreground">Max Drawdown</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {performanceData.length > 0 ? (
          <div className="relative">
            <svg
              ref={setSvgRef}
              width="100%"
              height={height}
              viewBox={`0 0 800 ${height}`}
              className="overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id="portfolioGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <g transform={`translate(60, 20)`}>
                {/* Grid Lines */}
                {chartMetrics && (
                  <>
                    {/* Horizontal grid lines */}
                    {Array.from({ length: 6 }, (_, i) => {
                      const y = (i / 5) * (height - 80);
                      const value = chartMetrics.maxValue - (i / 5) * chartMetrics.range;
                      
                      return (
                        <g key={`grid-h-${i}`}>
                          <line
                            x1={0}
                            y1={y}
                            x2={800}
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth={1}
                            strokeDasharray="2,2"
                          />
                          <text
                            x={-10}
                            y={y + 4}
                            fill="#6b7280"
                            fontSize={12}
                            textAnchor="end"
                          >
                            {formatValue(value)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Zero line */}
                    {settings.metric === 'percentage' && (
                      <line
                        x1={0}
                        y1={(height - 80) - ((0 - chartMetrics.minValue) / chartMetrics.range) * (height - 80)}
                        x2={800}
                        y2={(height - 80) - ((0 - chartMetrics.minValue) / chartMetrics.range) * (height - 80)}
                        stroke="#374151"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                      />
                    )}
                  </>
                )}

                {/* Portfolio Line */}
                <path
                  d={generatePaths.portfolio}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Benchmark Line */}
                {settings.showBenchmark && generatePaths.benchmark && (
                  <path
                    d={generatePaths.benchmark}
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points */}
                {chartMetrics && performanceData.map((point, index) => {
                  const x = (index / (performanceData.length - 1)) * 800;
                  const value = settings.metric === 'percentage'
                    ? (point.portfolioValue / performanceData[0].portfolioValue - 1) * 100
                    : point.portfolioValue;
                  const y = (height - 80) - ((value - chartMetrics.minValue) / chartMetrics.range) * (height - 80);
                  
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={hoveredPoint === point ? 5 : 3}
                      fill="#8b5cf6"
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-all duration-200 cursor-pointer"
                    />
                  );
                })}

                {/* Hover Line */}
                {hoveredPoint && chartMetrics && (
                  <line
                    x1={performanceData.indexOf(hoveredPoint) / (performanceData.length - 1) * 800}
                    y1={0}
                    x2={performanceData.indexOf(hoveredPoint) / (performanceData.length - 1) * 800}
                    y2={height - 80}
                    stroke="#6b7280"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                    opacity={0.7}
                  />
                )}
              </g>
            </svg>

            {/* Tooltip */}
            {hoveredPoint && (
              <div className="absolute top-4 right-4 bg-background border border-border rounded-lg p-3 shadow-lg">
                <div className="text-sm space-y-1">
                  <div className="font-medium">
                    {formatDateTime(hoveredPoint.timestamp)}
                  </div>
                  <div className="text-purple-600">
                    Portfolio: {formatValue(
                      settings.metric === 'percentage'
                        ? (hoveredPoint.portfolioValue / performanceData[0].portfolioValue - 1) * 100
                        : hoveredPoint.portfolioValue
                    )}
                  </div>
                  {settings.showBenchmark && (
                    <div className="text-gray-600">
                      {settings.comparison.toUpperCase()}: {formatValue(
                        settings.metric === 'percentage'
                          ? (hoveredPoint.benchmark / performanceData[0].portfolioValue - 1) * 100
                          : hoveredPoint.benchmark
                      )}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    Daily Return: {formatPercentage(hoveredPoint.dailyReturn)}
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-600 rounded-full" />
                <span>Portfolio</span>
              </div>
              {settings.showBenchmark && (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-0.5 bg-gray-600" style={{ borderStyle: 'dashed' }} />
                  <span>{settings.comparison.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="h-12 w-12 mx-auto mb-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-muted-foreground">No performance data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start investing to track your performance
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;
