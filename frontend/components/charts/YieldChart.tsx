// FlowBridge Frontend - Yield Chart Component
import React, { useState, useEffect, useMemo } from 'react';
import { useYieldHistory } from '../../hooks/useYieldData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner, Skeleton } from '../ui/LoadingSpinner';
import { formatUSDValue, formatPercentage, formatDateTime } from '../../utils/formatters';
import { cn } from '../../utils/formatters';

interface YieldChartProps {
  portfolioId?: string;
  className?: string;
  height?: number;
}

interface ChartDataPoint {
  timestamp: string;
  value: number;
  apy: number;
  cumulativeYield: number;
}

interface ChartSettings {
  timeframe: '7d' | '30d' | '90d' | '1y';
  metric: 'yield' | 'apy' | 'cumulative';
  showGrid: boolean;
  showTooltip: boolean;
}

const YieldChart: React.FC<YieldChartProps> = ({ 
  portfolioId, 
  className,
  height = 400 
}) => {
  const [settings, setSettings] = useState<ChartSettings>({
    timeframe: '30d',
    metric: 'yield',
    showGrid: true,
    showTooltip: true,
  });

  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null);

  const { history, loading, error, refetch } = useYieldHistory(
    portfolioId || '',
    settings.timeframe
  );

  // Process chart data
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    return history.map((point: any) => ({
      timestamp: point.timestamp,
      value: parseFloat(point.yieldEarned || '0'),
      apy: parseFloat(point.apy || '0'),
      cumulativeYield: parseFloat(point.cumulativeYield || '0'),
    }));
  }, [history]);

  // Calculate chart dimensions and scales
  const chartMetrics = useMemo(() => {
    if (chartData.length === 0) return null;

    const values = chartData.map(d => {
      switch (settings.metric) {
        case 'apy': return d.apy;
        case 'cumulative': return d.cumulativeYield;
        default: return d.value;
      }
    });

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = (maxValue - minValue) * 0.1;

    return {
      minValue: minValue - padding,
      maxValue: maxValue + padding,
      range: maxValue - minValue + (padding * 2),
    };
  }, [chartData, settings.metric]);

  // Generate SVG path for line chart
  const generatePath = useMemo(() => {
    if (!chartMetrics || chartData.length === 0) return '';

    const width = 800;
    const chartHeight = height - 80; // Account for padding

    const points = chartData.map((point, index) => {
      const x = (index / (chartData.length - 1)) * width;
      const value = (() => {
        switch (settings.metric) {
          case 'apy': return point.apy;
          case 'cumulative': return point.cumulativeYield;
          default: return point.value;
        }
      })();
      const y = chartHeight - ((value - chartMetrics.minValue) / chartMetrics.range) * chartHeight;
      
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [chartData, chartMetrics, settings.metric, height]);

  // Generate area path for filled chart
  const generateAreaPath = useMemo(() => {
    if (!chartMetrics || chartData.length === 0) return '';

    const width = 800;
    const chartHeight = height - 80;

    const points = chartData.map((point, index) => {
      const x = (index / (chartData.length - 1)) * width;
      const value = (() => {
        switch (settings.metric) {
          case 'apy': return point.apy;
          case 'cumulative': return point.cumulativeYield;
          default: return point.value;
        }
      })();
      const y = chartHeight - ((value - chartMetrics.minValue) / chartMetrics.range) * chartHeight;
      
      return { x, y };
    });

    const pathData = points.map((point, index) => {
      return index === 0 ? `M ${point.x},${point.y}` : `L ${point.x},${point.y}`;
    }).join(' ');

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return `${pathData} L ${lastPoint.x},${chartHeight} L ${firstPoint.x},${chartHeight} Z`;
  }, [chartData, chartMetrics, settings.metric, height]);

  // Handle mouse events
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef || chartData.length === 0) return;

    const rect = svgRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;

    const dataIndex = Math.round((x / width) * (chartData.length - 1));
    const boundedIndex = Math.max(0, Math.min(chartData.length - 1, dataIndex));

    setHoveredPoint(chartData[boundedIndex]);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Format values based on metric
  const formatValue = (value: number) => {
    switch (settings.metric) {
      case 'apy':
        return formatPercentage(value);
      case 'cumulative':
      case 'yield':
      default:
        return formatUSDValue(value);
    }
  };

  // Get metric label
  const getMetricLabel = () => {
    switch (settings.metric) {
      case 'apy': return 'APY';
      case 'cumulative': return 'Cumulative Yield';
      default: return 'Daily Yield';
    }
  };

  // Generate grid lines
  const generateGridLines = () => {
    if (!settings.showGrid || !chartMetrics) return null;

    const width = 800;
    const chartHeight = height - 80;
    const gridLines = [];

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = (i / 5) * chartHeight;
      const value = chartMetrics.maxValue - (i / 5) * chartMetrics.range;
      
      gridLines.push(
        <g key={`grid-h-${i}`}>
          <line
            x1={0}
            y1={y}
            x2={width}
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
    }

    // Vertical grid lines
    const timePoints = Math.min(6, chartData.length);
    for (let i = 0; i < timePoints; i++) {
      const x = (i / (timePoints - 1)) * width;
      const dataIndex = Math.round((i / (timePoints - 1)) * (chartData.length - 1));
      const point = chartData[dataIndex];
      
      if (point) {
        gridLines.push(
          <g key={`grid-v-${i}`}>
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={chartHeight}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <text
              x={x}
              y={chartHeight + 20}
              fill="#6b7280"
              fontSize={12}
              textAnchor="middle"
            >
              {new Date(point.timestamp).toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric' 
              })}
            </text>
          </g>
        );
      }
    }

    return gridLines;
  };

  if (loading) {
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

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Yield Performance Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="h-12 w-12 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-muted-foreground">Failed to load chart data</p>
              <Button size="sm" onClick={refetch} className="mt-2">
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>Yield Performance</span>
          </CardTitle>

          <div className="flex items-center space-x-2">
            {/* Metric Selector */}
            <select
              value={settings.metric}
              onChange={(e) => setSettings(prev => ({ ...prev, metric: e.target.value as any }))}
              className="px-3 py-1 border border-input rounded text-sm bg-background"
            >
              <option value="yield">Daily Yield</option>
              <option value="apy">APY</option>
              <option value="cumulative">Cumulative</option>
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

            <Button variant="outline" size="sm" onClick={refetch}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Current Value Display */}
        {chartData.length > 0 && (
          <div className="flex items-center space-x-6 mt-4">
            <div>
              <div className="text-sm text-muted-foreground">Current {getMetricLabel()}</div>
              <div className="text-2xl font-bold">
                {formatValue((() => {
                  const latest = chartData[chartData.length - 1];
                  switch (settings.metric) {
                    case 'apy': return latest.apy;
                    case 'cumulative': return latest.cumulativeYield;
                    default: return latest.value;
                  }
                })())}
              </div>
            </div>

            {hoveredPoint && (
              <div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(hoveredPoint.timestamp)}
                </div>
                <div className="text-xl font-semibold">
                  {formatValue((() => {
                    switch (settings.metric) {
                      case 'apy': return hoveredPoint.apy;
                      case 'cumulative': return hoveredPoint.cumulativeYield;
                      default: return hoveredPoint.value;
                    }
                  })())}
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {chartData.length > 0 ? (
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
                <linearGradient id="yieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <g transform={`translate(60, 20)`}>
                {/* Grid Lines */}
                {generateGridLines()}

                {/* Area Fill */}
                <path
                  d={generateAreaPath}
                  fill="url(#yieldGradient)"
                  className="transition-all duration-300"
                />

                {/* Line Chart */}
                <path
                  d={generatePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />

                {/* Data Points */}
                {chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * 800;
                  const value = (() => {
                    switch (settings.metric) {
                      case 'apy': return point.apy;
                      case 'cumulative': return point.cumulativeYield;
                      default: return point.value;
                    }
                  })();
                  const y = (height - 80) - ((value - (chartMetrics?.minValue || 0)) / (chartMetrics?.range || 1)) * (height - 80);
                  
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={hoveredPoint === point ? 6 : 4}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-all duration-200 cursor-pointer"
                    />
                  );
                })}

                {/* Hover Line */}
                {hoveredPoint && (
                  <line
                    x1={chartData.indexOf(hoveredPoint) / (chartData.length - 1) * 800}
                    y1={0}
                    x2={chartData.indexOf(hoveredPoint) / (chartData.length - 1) * 800}
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
            {settings.showTooltip && hoveredPoint && (
              <div className="absolute top-4 right-4 bg-background border border-border rounded-lg p-3 shadow-lg">
                <div className="text-sm space-y-1">
                  <div className="font-medium">
                    {formatDateTime(hoveredPoint.timestamp)}
                  </div>
                  <div className="text-green-600">
                    {getMetricLabel()}: {formatValue((() => {
                      switch (settings.metric) {
                        case 'apy': return hoveredPoint.apy;
                        case 'cumulative': return hoveredPoint.cumulativeYield;
                        default: return hoveredPoint.value;
                      }
                    })())}
                  </div>
                  {settings.metric !== 'apy' && (
                    <div className="text-muted-foreground">
                      APY: {formatPercentage(hoveredPoint.apy)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="h-12 w-12 mx-auto mb-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-muted-foreground">No yield data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start earning yield to see your performance chart
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YieldChart;
