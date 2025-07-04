// FlowBridge Frontend - Data Formatting Utilities

// Format USD values
export function formatUSDValue(value: string | number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(numValue);
}

// Format percentage values
export function formatPercentage(value: string | number, decimals: number = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue / 100);
}

// Format large numbers with suffixes
export function formatLargeNumber(value: string | number, decimals: number = 1): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const magnitude = Math.floor(Math.log10(Math.abs(numValue)) / 3);
  const suffix = suffixes[Math.min(magnitude, suffixes.length - 1)];
  const scaled = numValue / Math.pow(1000, magnitude);
  
  return `${scaled.toFixed(decimals)}${suffix}`;
}

// Format token amounts
export function formatTokenAmount(
  value: string | number, 
  decimals: number = 6,
  symbol?: string
): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return symbol ? `0 ${symbol}` : '0';
  
  // Use appropriate precision based on value size
  let precision = decimals;
  if (numValue >= 1000) precision = 2;
  else if (numValue >= 1) precision = 4;
  else precision = 6;
  
  const formatted = numValue.toFixed(precision).replace(/\.?0+$/, '');
  return symbol ? `${formatted} ${symbol}` : formatted;
}

// Format date and time
export function formatDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  const months = Math.floor(diff / 2592000000);
  
  if (months > 0) return `${months} month${months === 1 ? '' : 's'} ago`;
  if (weeks > 0) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  
  return 'Just now';
}

// Format duration (e.g., "2h 30m")
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

// Format address for display with ENS support
export function formatAddress(
  address: string, 
  chars: number = 4,
  ensName?: string
): string {
  if (ensName) return ensName;
  
  if (!address || address.length < 10) return address;
  
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format transaction hash
export function formatTxHash(hash: string, chars: number = 6): string {
  if (!hash || hash.length < 10) return hash;
  
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

// Format APY with trend indicator
export function formatAPY(
  current: number,
  previous?: number,
  showTrend: boolean = true
): string {
  const formatted = formatPercentage(current);
  
  if (!showTrend || previous === undefined) return formatted;
  
  const diff = current - previous;
  const trend = diff > 0 ? '↗' : diff < 0 ? '↘' : '→';
  const trendColor = diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-gray-500';
  
  return `${formatted} <span class="${trendColor}">${trend}</span>`;
}

// Format risk score with color
export function formatRiskScore(score: number): { text: string; color: string; level: string } {
  let level: string;
  let color: string;
  
  if (score <= 20) {
    level = 'Very Low';
    color = 'text-green-600';
  } else if (score <= 40) {
    level = 'Low';
    color = 'text-green-500';
  } else if (score <= 60) {
    level = 'Medium';
    color = 'text-yellow-500';
  } else if (score <= 80) {
    level = 'High';
    color = 'text-orange-500';
  } else {
    level = 'Very High';
    color = 'text-red-500';
  }
  
  return {
    text: `${score}/100`,
    color,
    level,
  };
}

// Format gas price in Gwei
export function formatGasPrice(gasPrice: string): string {
  try {
    const gwei = parseFloat(gasPrice);
    return `${gwei.toFixed(1)} Gwei`;
  } catch {
    return 'Unknown';
  }
}

// Format network status
export function formatNetworkStatus(
  isConnected: boolean,
  chainId?: number,
  chainName?: string
): { text: string; color: string } {
  if (!isConnected) {
    return { text: 'Disconnected', color: 'text-red-500' };
  }
  
  if (chainName) {
    return { text: `Connected to ${chainName}`, color: 'text-green-500' };
  }
  
  if (chainId) {
    return { text: `Connected to Chain ${chainId}`, color: 'text-yellow-500' };
  }
  
  return { text: 'Connected', color: 'text-green-500' };
}

// Format number with commas
export function formatNumber(value: string | number, decimals?: number): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

// Format bytes
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// Utility for className concatenation
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Format yield calculation
export function formatYieldCalculation(
  principal: number,
  apy: number,
  days: number
): {
  dailyYield: string;
  totalYield: string;
  finalAmount: string;
} {
  const dailyRate = apy / 365 / 100;
  const dailyYield = principal * dailyRate;
  const totalYield = dailyYield * days;
  const finalAmount = principal + totalYield;
  
  return {
    dailyYield: formatUSDValue(dailyYield),
    totalYield: formatUSDValue(totalYield),
    finalAmount: formatUSDValue(finalAmount),
  };
}
