// FlowBridge Frontend - Protocol List Component
import React, { useState, useEffect } from 'react';
import { useYieldData } from '../../../hooks/useYieldData';
import { Card, CardContent, CardHeader, CardTitle, ProtocolCard } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner, Skeleton } from '../../ui/LoadingSpinner';
import { formatPercentage, formatUSDValue, formatRiskScore } from '../../../utils/formatters';
import { cn } from '../../../utils/formatters';
import type { Protocol } from '../../../types';

interface ProtocolListProps {
  onProtocolSelect?: (protocol: Protocol) => void;
  selectedProtocolIds?: string[];
  className?: string;
  showFilters?: boolean;
  category?: string;
}

interface ProtocolFilters {
  category: string;
  minAPY: string;
  maxRisk: string;
  minTVL: string;
  sortBy: 'apy' | 'tvl' | 'risk' | 'name';
  sortDirection: 'asc' | 'desc';
}

const ProtocolList: React.FC<ProtocolListProps> = ({
  onProtocolSelect,
  selectedProtocolIds = [],
  className,
  showFilters = true,
  category,
}) => {
  const { 
    protocols, 
    protocolsLoading, 
    fetchProtocols,
    filterProtocols,
    getProtocolsByCategory 
  } = useYieldData();

  const [filters, setFilters] = useState<ProtocolFilters>({
    category: category || 'all',
    minAPY: '',
    maxRisk: '',
    minTVL: '',
    sortBy: 'apy',
    sortDirection: 'desc',
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Apply filters and search
  const getFilteredProtocols = () => {
    let filtered = protocols;

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = getProtocolsByCategory(filters.category);
    }

    // Apply other filters
    filtered = filterProtocols({
      category: filters.category !== 'all' ? filters.category : undefined,
      minAPY: filters.minAPY ? parseFloat(filters.minAPY) : undefined,
      maxRisk: filters.maxRisk ? parseInt(filters.maxRisk) : undefined,
      minTVL: filters.minTVL ? parseFloat(filters.minTVL) : undefined,
    });

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(protocol =>
        protocol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        protocol.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort protocols
    filtered = [...filtered].sort((a, b) => {
      let aValue: number, bValue: number;

      switch (filters.sortBy) {
        case 'apy':
          aValue = parseFloat(a.apyCurrent);
          bValue = parseFloat(b.apyCurrent);
          break;
        case 'tvl':
          aValue = parseFloat(a.tvl);
          bValue = parseFloat(b.tvl);
          break;
        case 'risk':
          aValue = a.riskScore;
          bValue = b.riskScore;
          break;
        case 'name':
          return filters.sortDirection === 'asc' 
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        default:
          aValue = parseFloat(a.apyCurrent);
          bValue = parseFloat(b.apyCurrent);
      }

      return filters.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  };

  const handleFilterChange = (key: keyof ProtocolFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSort = (sortBy: ProtocolFilters['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortDirection: prev.sortBy === sortBy && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }));
  };

  const filteredProtocols = getFilteredProtocols();

  const protocolCategories = [
    { value: 'all', label: 'All Protocols' },
    { value: 'lending', label: 'Lending' },
    { value: 'dex', label: 'DEX' },
    { value: 'yield_farming', label: 'Yield Farming' },
    { value: 'liquidity_mining', label: 'Liquidity Mining' },
    { value: 'derivatives', label: 'Derivatives' },
    { value: 'insurance', label: 'Insurance' },
  ];

  useEffect(() => {
    if (protocols.length === 0) {
      fetchProtocols();
    }
  }, [protocols.length, fetchProtocols]);

  if (protocolsLoading && protocols.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton width="200px" height="24px" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton lines={4} />
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>DeFi Protocols</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredProtocols.length} protocols available
          </div>
        </div>

        {showFilters && (
          <div className="space-y-4 mt-4">
            {/* Search */}
            <div>
              <input
                type="text"
                placeholder="Search protocols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm bg-background"
              >
                {protocolCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Min APY %"
                value={filters.minAPY}
                onChange={(e) => handleFilterChange('minAPY', e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm bg-background"
              />

              <input
                type="number"
                placeholder="Max Risk (1-100)"
                value={filters.maxRisk}
                onChange={(e) => handleFilterChange('maxRisk', e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm bg-background"
              />

              <input
                type="number"
                placeholder="Min TVL ($M)"
                value={filters.minTVL}
                onChange={(e) => handleFilterChange('minTVL', e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm bg-background"
              />
            </div>

            {/* Sort Options */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'apy', label: 'APY' },
                { key: 'tvl', label: 'TVL' },
                { key: 'risk', label: 'Risk' },
                { key: 'name', label: 'Name' },
              ].map(option => (
                <Button
                  key={option.key}
                  variant={filters.sortBy === option.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort(option.key as ProtocolFilters['sortBy'])}
                >
                  {option.label}
                  {filters.sortBy === option.key && (
                    <span className="ml-1">
                      {filters.sortDirection === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredProtocols.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProtocols.map((protocol) => (
              <ProtocolCard
                key={protocol.id}
                name={protocol.name}
                category={protocol.category}
                apy={formatPercentage(parseFloat(protocol.apyCurrent))}
                tvl={formatUSDValue(protocol.tvl)}
                riskScore={protocol.riskScore}
                selected={selectedProtocolIds.includes(protocol.id)}
                onSelect={() => onProtocolSelect?.(protocol)}
                className="cursor-pointer hover:shadow-md transition-shadow"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-medium mb-2">No Protocols Found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters to see more protocols
            </p>
          </div>
        )}

        {protocolsLoading && (
          <div className="flex justify-center mt-6">
            <LoadingSpinner size="lg" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProtocolList;
