// FlowBridge Frontend - Allocation Chart Component
import React, { useState, useMemo } from 'react';
import { useYieldData } from '../../hooks/useYieldData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner, Skeleton } from '../ui/LoadingSpinner';
import { formatUSDValue, formatPercentage } from '../../utils/formatters';
import { cn } from '../../utils/formatters';

interface AllocationChartProps {
  portfolioId?: string;
  className?: string;
  size?: number;
}

interface AllocationData {
  protocol: string;
  value: number;
  percentage: number;
  color: string;
  category: string;
}

interface ChartSettings {
  chartType: 'donut' | 'pie' | 'bar';
  groupBy: 'protocol' | 'category' | 'chain';
  showLabels: boolean;
  showValues: boolean;
}

const AllocationChart: React.FC<AllocationChartProps> = ({ 
  portfolioId, 
  className,
  size = 400 
}) => {
  const { strategies, strategiesLoading } = useYieldData(portfolioId);
  
  const [settings, setSettings] = useState<ChartSettings>({
    chartType: 'donut',
    groupBy: 'protocol',
    showLabels: true,
    showValues: true,
  });

  const [hoveredSegment, setHoveredSegment] = useState<AllocationData | null>(null);

  // Generate colors for chart segments
  const generateColors = (count: number): string[] => {
    const baseColors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  };

  // Process allocation data
  const allocationData = useMemo(() => {
    if (!strategies || strategies.length === 0) return [];

    const activeStrategies = strategies.filter(s => s.isActive);
    const totalValue = activeStrategies.reduce((sum, s) => sum + parseFloat(s.currentValue), 0);

    if (totalValue === 0) return [];

    let groupedData: Record<string, { value: number; protocols: string[]; category: string }> = {};

    activeStrategies.forEach(strategy => {
      const value = parseFloat(strategy.currentValue);
      const key = (() => {
        switch (settings.groupBy) {
          case 'category': return strategy.category || 'Other';
          case 'chain': return strategy.chainName || 'Unknown';
          default: return strategy.protocolName;
        }
      })();

      if (groupedData[key]) {
        groupedData[key].value += value;
        if (!groupedData[key].protocols.includes(strategy.protocolName)) {
          groupedData[key].protocols.push(strategy.protocolName);
        }
      } else {
        groupedData[key] = {
          value,
          protocols: [strategy.protocolName],
          category: strategy.category || 'Other',
        };
      }
    });

    const colors = generateColors(Object.keys(groupedData).length);

    return Object.entries(groupedData)
      .map(([protocol, data], index) => ({
        protocol,
        value: data.value,
        percentage: (data.value / totalValue) * 100,
        color: colors[index],
        category: data.category,
      }))
      .sort((a, b) => b.value - a.value);
  }, [strategies, settings.groupBy]);

  // Generate SVG paths for donut/pie chart
  const generateChartPaths = useMemo(() => {
    if (allocationData.length === 0) return [];

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 40;
    const innerRadius = settings.chartType === 'donut' ? radius * 0.6 : 0;

    let currentAngle = -Math.PI / 2; // Start from top

    return allocationData.map((segment) => {
      const angle = (segment.percentage / 100) * 2 * Math.PI;
      const endAngle = currentAngle + angle;

      // Calculate path coordinates
      const x1 = centerX + Math.cos(currentAngle) * radius;
      const y1 = centerY + Math.sin(currentAngle) * radius;
      const x2 = centerX + Math.cos(endAngle) * radius;
      const y2 = centerY + Math.sin(endAngle) * radius;

      const x3 = centerX + Math.cos(endAngle) * innerRadius;
      const y3 = centerY + Math.sin(endAngle) * innerRadius;
      const x4 = centerX + Math.cos(currentAngle) * innerRadius;
      const y4 = centerY + Math.sin(currentAngle) * innerRadius;

      const largeArcFlag = angle > Math.PI ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z'
      ].join(' ');

      // Calculate label position
      const labelAngle = currentAngle + angle / 2;
      const labelRadius = radius + 20;
      const labelX = centerX + Math.cos(labelAngle) * labelRadius;
      const labelY = centerY + Math.sin(labelAngle) * labelRadius;

      const result = {
        ...segment,
        pathData,
        labelX,
        labelY,
        startAngle: currentAngle,
        endAngle,
      };

      currentAngle = endAngle;
      return result;
    });
  }, [allocationData, size, settings.chartType]);

  // Generate bar chart data
  const generateBarChart = () => {
    if (allocationData.length === 0) return null;

    const barHeight = 30;
    const barSpacing = 10;
    const chartHeight = allocationData.length * (barHeight + barSpacing);
    const maxValue = Math.max(...allocationData.map(d => d.value));

    return (
      <svg width="100%" height={chartHeight + 40} className="overflow-visible">
        {allocationData.map((segment, index) => {
          const y = index * (barHeight + barSpacing);
          const barWidth = (segment.value / maxValue) * 300;

          return (
            <g key={segment.protocol}>
              {/* Bar Background */}
              <rect
                x={150}
                y={y}
                width={300}
                height={barHeight}
                fill="#f3f4f6"
                rx={4}
              />
              
              {/* Bar Fill */}
              <rect
                x={150}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={segment.color}
                rx={4}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
              />

              {/* Label */}
              <text
                x={140}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fontSize={12}
                fill="#374151"
                className="font-medium"
              >
                {segment.protocol}
              </text>

              {/* Value */}
              <text
                x={460}
                y={y + barHeight / 2 + 4}
                textAnchor="start"
                fontSize={12}
                fill="#6b7280"
              >
                {formatUSDValue(segment.value)} ({formatPercentage(segment.percentage)})
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (strategiesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <Skeleton height={`${size}px`} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            <span>Portfolio Allocation</span>
          </CardTitle>

          <div className="flex items-center space-x-2">
            {/* Chart Type Selector */}
            <select
              value={settings.chartType}
              onChange={(e) => setSettings(prev => ({ ...prev, chartType: e.target.value as any }))}
              className="px-3 py-1 border border-input rounded text-sm bg-background"
            >
              <option value="donut">Donut</option>
              <option value="pie">Pie</option>
              <option value="bar">Bar</option>
            </select>

            {/* Group By Selector */}
            <select
              value={settings.groupBy}
              onChange={(e) => setSettings(prev => ({ ...prev, groupBy: e.target.value as any }))}
              className="px-3 py-1 border border-input rounded text-sm bg-background"
            >
              <option value="protocol">Protocol</option>
              <option value="category">Category</option>
              <option value="chain">Chain</option>
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        {allocationData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {allocationData.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {settings.groupBy === 'protocol' ? 'Protocols' : 
                 settings.groupBy === 'category' ? 'Categories' : 'Chains'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatUSDValue(allocationData.reduce((sum, d) => sum + d.value, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatPercentage(Math.max(...allocationData.map(d => d.percentage)))}
              </div>
              <div className="text-sm text-muted-foreground">Largest Position</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatPercentage(allocationData.slice(0, 3).reduce((sum, d) => sum + d.percentage, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Top 3</div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {allocationData.length > 0 ? (
          <div className="space-y-6">
            {/* Chart Display */}
            {settings.chartType === 'bar' ? (
              <div className="overflow-x-auto">
                {generateBarChart()}
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row items-center space-y-6 lg:space-y-0 lg:space-x-8">
                {/* Chart */}
                <div className="relative">
                  <svg width={size} height={size} className="overflow-visible">
                    {generateChartPaths.map((segment, index) => (
                      <g key={segment.protocol}>
                        <path
                          d={segment.pathData}
                          fill={hoveredSegment === segment ? segment.color : segment.color}
                          stroke="#ffffff"
                          strokeWidth={2}
                          className="transition-all duration-300 cursor-pointer"
                          style={{
                            filter: hoveredSegment === segment ? 'brightness(1.1)' : 'none',
                            transform: hoveredSegment === segment ? 'scale(1.02)' : 'scale(1)',
                            transformOrigin: `${size/2}px ${size/2}px`,
                          }}
                          onMouseEnter={() => setHoveredSegment(segment)}
                          onMouseLeave={() => setHoveredSegment(null)}
                        />

                        {/* Labels */}
                        {settings.showLabels && segment.percentage >= 5 && (
                          <text
                            x={segment.labelX}
                            y={segment.labelY}
                            textAnchor="middle"
                            fontSize={12}
                            fill="#374151"
                            className="font-medium pointer-events-none"
                          >
                            {segment.protocol}
                          </text>
                        )}
                      </g>
                    ))}

                    {/* Center Label for Donut Chart */}
                    {settings.chartType === 'donut' && (
                      <g>
                        <text
                          x={size / 2}
                          y={size / 2 - 10}
                          textAnchor="middle"
                          fontSize={16}
                          fill="#374151"
                          className="font-bold"
                        >
                          Total
                        </text>
                        <text
                          x={size / 2}
                          y={size / 2 + 10}
                          textAnchor="middle"
                          fontSize={14}
                          fill="#6b7280"
                        >
                          {formatUSDValue(allocationData.reduce((sum, d) => sum + d.value, 0))}
                        </text>
                      </g>
                    )}
                  </svg>

                  {/* Hover Tooltip */}
                  {hoveredSegment && (
                    <div className="absolute top-4 right-4 bg-background border border-border rounded-lg p-3 shadow-lg">
                      <div className="text-sm space-y-1">
                        <div className="font-medium">{hoveredSegment.protocol}</div>
                        <div className="text-green-600">
                          {formatUSDValue(hoveredSegment.value)}
                        </div>
                        <div className="text-muted-foreground">
                          {formatPercentage(hoveredSegment.percentage)} of total
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="flex-1 max-w-xs">
                  <h4 className="font-medium mb-3">Allocation Breakdown</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {allocationData.map((segment) => (
                      <div 
                        key={segment.protocol}
                        className={cn(
                          'flex items-center space-x-3 p-2 rounded cursor-pointer transition-colors',
                          hoveredSegment === segment ? 'bg-accent' : 'hover:bg-accent/50'
                        )}
                        onMouseEnter={() => setHoveredSegment(segment)}
                        onMouseLeave={() => setHoveredSegment(null)}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: segment.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {segment.protocol}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {segment.category}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">
                            {formatPercentage(segment.percentage)}
                          </div>
                          <div className="text-muted-foreground">
                            {formatUSDValue(segment.value)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="h-12 w-12 mx-auto mb-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
              <p className="text-muted-foreground">No allocation data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create yield strategies to see portfolio allocation
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AllocationChart;
