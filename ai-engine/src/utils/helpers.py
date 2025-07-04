import asyncio
import functools
import hashlib
import json
import time
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class RetryConfig:
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True

def retry_async(config: RetryConfig = None):
    """Decorator for retrying async functions with exponential backoff."""
    if config is None:
        config = RetryConfig()
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(config.max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt == config.max_attempts - 1:
                        raise
                    
                    # Calculate delay with exponential backoff
                    delay = min(
                        config.base_delay * (config.exponential_base ** attempt),
                        config.max_delay
                    )
                    
                    # Add jitter to prevent thundering herd
                    if config.jitter:
                        import random
                        delay = delay * (0.5 + 0.5 * random.random())
                    
                    await asyncio.sleep(delay)
            
            raise last_exception
        
        return wrapper
    return decorator

def timing_decorator(logger=None):
    """Decorator to measure and log function execution time."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                if logger:
                    logger.debug(f"{func.__name__} executed in {execution_time:.3f}s")
                
                return result
            
            except Exception as e:
                execution_time = time.time() - start_time
                
                if logger:
                    logger.error(f"{func.__name__} failed after {execution_time:.3f}s: {str(e)}")
                
                raise
        
        return wrapper
    return decorator

async def timeout_handler(coro, timeout_seconds: float):
    """Handle async function timeout."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Operation timed out after {timeout_seconds} seconds")

def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> None:
    """Validate that required fields are present in data."""
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

def safe_json_loads(json_string: str, default: Any = None) -> Any:
    """Safely parse JSON string with default fallback."""
    try:
        return json.loads(json_string)
    except (json.JSONDecodeError, TypeError):
        return default

def safe_float_conversion(value: Any, default: float = 0.0) -> float:
    """Safely convert value to float with default fallback."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int_conversion(value: Any, default: int = 0) -> int:
    """Safely convert value to int with default fallback."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def generate_request_id() -> str:
    """Generate unique request ID."""
    timestamp = str(time.time()).encode()
    random_bytes = str(np.random.random()).encode()
    return hashlib.md5(timestamp + random_bytes).hexdigest()[:12]

def sanitize_string(text: str, max_length: int = 1000) -> str:
    """Sanitize string input for logging and storage."""
    if not isinstance(text, str):
        text = str(text)
    
    # Remove or replace potentially dangerous characters
    sanitized = text.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
    
    # Limit length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + "..."
    
    return sanitized.strip()

def calculate_percentage_change(old_value: float, new_value: float) -> float:
    """Calculate percentage change between two values."""
    if old_value == 0:
        return float('inf') if new_value > 0 else float('-inf') if new_value < 0 else 0
    
    return ((new_value - old_value) / old_value) * 100

def calculate_moving_average(values: List[float], window: int) -> List[float]:
    """Calculate moving average for a list of values."""
    if not values or window <= 0:
        return []
    
    if len(values) < window:
        return [sum(values) / len(values)] * len(values)
    
    moving_averages = []
    for i in range(len(values)):
        if i < window - 1:
            moving_averages.append(sum(values[:i+1]) / (i+1))
        else:
            moving_averages.append(sum(values[i-window+1:i+1]) / window)
    
    return moving_averages

def calculate_volatility(prices: List[float], window: int = 30) -> float:
    """Calculate price volatility (standard deviation of returns)."""
    if len(prices) < 2:
        return 0.0
    
    returns = []
    for i in range(1, len(prices)):
        if prices[i-1] != 0:
            returns.append((prices[i] - prices[i-1]) / prices[i-1])
    
    if not returns:
        return 0.0
    
    # Use the last 'window' returns for calculation
    recent_returns = returns[-window:] if len(returns) > window else returns
    
    return float(np.std(recent_returns))

def normalize_data(data: List[float], method: str = 'minmax') -> List[float]:
    """Normalize data using specified method."""
    if not data:
        return []
    
    data_array = np.array(data)
    
    if method == 'minmax':
        min_val = np.min(data_array)
        max_val = np.max(data_array)
        if max_val - min_val == 0:
            return [0.5] * len(data)
        return ((data_array - min_val) / (max_val - min_val)).tolist()
    
    elif method == 'zscore':
        mean_val = np.mean(data_array)
        std_val = np.std(data_array)
        if std_val == 0:
            return [0.0] * len(data)
        return ((data_array - mean_val) / std_val).tolist()
    
    else:
        raise ValueError(f"Unknown normalization method: {method}")

def chunk_list(data: List[T], chunk_size: int) -> List[List[T]]:
    """Split list into chunks of specified size."""
    if chunk_size <= 0:
        raise ValueError("Chunk size must be positive")
    
    return [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]

def merge_dicts(*dicts: Dict[str, Any]) -> Dict[str, Any]:
    """Merge multiple dictionaries, with later ones taking precedence."""
    result = {}
    for d in dicts:
        if d:
            result.update(d)
    return result

def flatten_dict(d: Dict[str, Any], parent_key: str = '', separator: str = '.') -> Dict[str, Any]:
    """Flatten nested dictionary."""
    items = []
    
    for key, value in d.items():
        new_key = f"{parent_key}{separator}{key}" if parent_key else key
        
        if isinstance(value, dict):
            items.extend(flatten_dict(value, new_key, separator).items())
        else:
            items.append((new_key, value))
    
    return dict(items)

def paginate_list(data: List[T], page: int, page_size: int) -> Dict[str, Any]:
    """Paginate a list and return pagination info."""
    if page < 1:
        page = 1
    
    if page_size < 1:
        page_size = 10
    
    total_items = len(data)
    total_pages = (total_items + page_size - 1) // page_size
    
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    
    return {
        'data': data[start_idx:end_idx],
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_items': total_items,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }

def calculate_sharpe_ratio(returns: List[float], risk_free_rate: float = 0.02) -> float:
    """Calculate Sharpe ratio for a series of returns."""
    if not returns:
        return 0.0
    
    returns_array = np.array(returns)
    excess_returns = returns_array - risk_free_rate / 252  # Daily risk-free rate
    
    if len(excess_returns) == 0 or np.std(excess_returns) == 0:
        return 0.0
    
    return float(np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252))

def calculate_max_drawdown(prices: List[float]) -> float:
    """Calculate maximum drawdown from price series."""
    if len(prices) < 2:
        return 0.0
    
    prices_array = np.array(prices)
    peak = np.maximum.accumulate(prices_array)
    drawdown = (prices_array - peak) / peak
    
    return float(np.min(drawdown))

def is_valid_ethereum_address(address: str) -> bool:
    """Validate Ethereum address format."""
    if not isinstance(address, str):
        return False
    
    # Basic format check
    if not address.startswith('0x') or len(address) != 42:
        return False
    
    # Check if all characters after '0x' are hexadecimal
    try:
        int(address[2:], 16)
        return True
    except ValueError:
        return False

def format_currency(amount: float, currency: str = 'USD', decimals: int = 2) -> str:
    """Format amount as currency string."""
    if currency.upper() == 'USD':
        return f"${amount:,.{decimals}f}"
    elif currency.upper() in ['ETH', 'BTC']:
        return f"{amount:.{decimals}f} {currency.upper()}"
    else:
        return f"{amount:,.{decimals}f} {currency.upper()}"

def calculate_correlation(x: List[float], y: List[float]) -> float:
    """Calculate correlation coefficient between two series."""
    if len(x) != len(y) or len(x) < 2:
        return 0.0
    
    x_array = np.array(x)
    y_array = np.array(y)
    
    correlation_matrix = np.corrcoef(x_array, y_array)
    return float(correlation_matrix[0, 1]) if not np.isnan(correlation_matrix[0, 1]) else 0.0

def exponential_moving_average(values: List[float], alpha: float = 0.1) -> List[float]:
    """Calculate exponential moving average."""
    if not values or alpha <= 0 or alpha > 1:
        return []
    
    ema = [values[0]]
    
    for i in range(1, len(values)):
        ema_value = alpha * values[i] + (1 - alpha) * ema[i-1]
        ema.append(ema_value)
    
    return ema

def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
    """Calculate Relative Strength Index (RSI)."""
    if len(prices) < period + 1:
        return None
    
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    
    gains = [delta if delta > 0 else 0 for delta in deltas[-period:]]
    losses = [-delta if delta < 0 else 0 for delta in deltas[-period:]]
    
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    return float(rsi)

class CircuitBreaker:
    """Circuit breaker pattern implementation."""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = 'HALF_OPEN'
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            
            if self.state == 'HALF_OPEN':
                self.state = 'CLOSED'
                self.failure_count = 0
            
            return result
        
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.failure_count >= self.failure_threshold:
                self.state = 'OPEN'
            
            raise

def create_hash(data: Union[str, Dict, List]) -> str:
    """Create consistent hash for data."""
    if isinstance(data, (dict, list)):
        data = json.dumps(data, sort_keys=True)
    
    return hashlib.sha256(str(data).encode()).hexdigest()
