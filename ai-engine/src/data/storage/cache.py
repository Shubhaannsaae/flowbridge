import asyncio
import json
import logging
import pickle
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta
import aioredis
import hashlib

class CacheManager:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        self.logger = logging.getLogger(__name__)
        
        # Default TTL values (in seconds)
        self.default_ttls = {
            'price_data': 60,      # 1 minute
            'yield_data': 300,     # 5 minutes
            'market_data': 180,    # 3 minutes
            'ai_predictions': 3600, # 1 hour
            'portfolio_data': 300,  # 5 minutes
            'gas_prices': 120      # 2 minutes
        }

    async def initialize(self):
        """Initialize Redis connection."""
        try:
            self.redis = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=False,
                max_connections=20,
                retry_on_timeout=True
            )
            
            # Test connection
            await self.redis.ping()
            self.logger.info("Cache manager initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize cache: {e}")
            raise

    async def close(self):
        """Close Redis connection."""
        if self.redis:
            await self.redis.close()
            self.logger.info("Cache connection closed")

    def _generate_key(self, prefix: str, identifier: Union[str, Dict[str, Any]]) -> str:
        """Generate cache key."""
        if isinstance(identifier, dict):
            # Sort dict and create hash for consistent keys
            sorted_items = sorted(identifier.items())
            identifier_str = json.dumps(sorted_items, sort_keys=True)
            identifier_hash = hashlib.md5(identifier_str.encode()).hexdigest()
            return f"{prefix}:{identifier_hash}"
        else:
            return f"{prefix}:{identifier}"

    async def set(self, key: str, value: Any, ttl: Optional[int] = None, 
                 data_type: str = 'default') -> bool:
        """Set cache value with optional TTL."""
        try:
            if not self.redis:
                return False

            # Determine TTL
            if ttl is None:
                ttl = self.default_ttls.get(data_type, 300)

            # Serialize value
            if isinstance(value, (dict, list)):
                serialized_value = json.dumps(value, default=str)
            else:
                serialized_value = pickle.dumps(value)

            # Set with TTL
            await self.redis.setex(key, ttl, serialized_value)
            return True

        except Exception as e:
            self.logger.error(f"Error setting cache key {key}: {e}")
            return False

    async def get(self, key: str, default: Any = None) -> Any:
        """Get cache value."""
        try:
            if not self.redis:
                return default

            value = await self.redis.get(key)
            if value is None:
                return default

            # Try JSON first, then pickle
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                try:
                    return pickle.loads(value)
                except (pickle.PickleError, TypeError):
                    return value.decode('utf-8') if isinstance(value, bytes) else value

        except Exception as e:
            self.logger.error(f"Error getting cache key {key}: {e}")
            return default

    async def delete(self, key: str) -> bool:
        """Delete cache key."""
        try:
            if not self.redis:
                return False

            result = await self.redis.delete(key)
            return result > 0

        except Exception as e:
            self.logger.error(f"Error deleting cache key {key}: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if cache key exists."""
        try:
            if not self.redis:
                return False

            result = await self.redis.exists(key)
            return result > 0

        except Exception as e:
            self.logger.error(f"Error checking cache key {key}: {e}")
            return False

    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration time for a key."""
        try:
            if not self.redis:
                return False

            result = await self.redis.expire(key, ttl)
            return result

        except Exception as e:
            self.logger.error(f"Error setting expiration for key {key}: {e}")
            return False

    async def cache_price_data(self, symbol: str, price_data: Dict[str, Any], 
                             ttl: Optional[int] = None) -> bool:
        """Cache price data for a symbol."""
        key = self._generate_key("price", symbol.upper())
        return await self.set(key, price_data, ttl, 'price_data')

    async def get_cached_price_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get cached price data for a symbol."""
        key = self._generate_key("price", symbol.upper())
        return await self.get(key)

    async def cache_yield_opportunities(self, filters: Dict[str, Any], 
                                      opportunities: List[Dict[str, Any]], 
                                      ttl: Optional[int] = None) -> bool:
        """Cache yield opportunities with filters as key."""
        key = self._generate_key("yield_opportunities", filters)
        return await self.set(key, opportunities, ttl, 'yield_data')

    async def get_cached_yield_opportunities(self, filters: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        """Get cached yield opportunities."""
        key = self._generate_key("yield_opportunities", filters)
        return await self.get(key)

    async def cache_portfolio_analysis(self, portfolio_id: str, analysis: Dict[str, Any],
                                     ttl: Optional[int] = None) -> bool:
        """Cache portfolio analysis."""
        key = self._generate_key("portfolio_analysis", portfolio_id)
        return await self.set(key, analysis, ttl, 'portfolio_data')

    async def get_cached_portfolio_analysis(self, portfolio_id: str) -> Optional[Dict[str, Any]]:
        """Get cached portfolio analysis."""
        key = self._generate_key("portfolio_analysis", portfolio_id)
        return await self.get(key)

    async def cache_ai_prediction(self, model_type: str, input_hash: str, 
                                prediction: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Cache AI prediction."""
        key = self._generate_key(f"ai_prediction_{model_type}", input_hash)
        return await self.set(key, prediction, ttl, 'ai_predictions')

    async def get_cached_ai_prediction(self, model_type: str, input_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached AI prediction."""
        key = self._generate_key(f"ai_prediction_{model_type}", input_hash)
        return await self.get(key)

    async def cache_market_data(self, market_data: Dict[str, Any], 
                              ttl: Optional[int] = None) -> bool:
        """Cache market data."""
        key = "market_data:latest"
        return await self.set(key, market_data, ttl, 'market_data')

    async def get_cached_market_data(self) -> Optional[Dict[str, Any]]:
        """Get cached market data."""
        key = "market_data:latest"
        return await self.get(key)

    async def cache_gas_prices(self, chain: str, gas_data: Dict[str, Any],
                             ttl: Optional[int] = None) -> bool:
        """Cache gas prices for a chain."""
        key = self._generate_key("gas_prices", chain.lower())
        return await self.set(key, gas_data, ttl, 'gas_prices')

    async def get_cached_gas_prices(self, chain: str) -> Optional[Dict[str, Any]]:
        """Get cached gas prices for a chain."""
        key = self._generate_key("gas_prices", chain.lower())
        return await self.get(key)

    async def batch_cache_prices(self, price_data_dict: Dict[str, Dict[str, Any]], 
                               ttl: Optional[int] = None) -> Dict[str, bool]:
        """Cache multiple price data entries."""
        results = {}
        
        if not self.redis:
            return {symbol: False for symbol in price_data_dict.keys()}

        try:
            pipe = self.redis.pipeline()
            
            for symbol, data in price_data_dict.items():
                key = self._generate_key("price", symbol.upper())
                serialized_value = json.dumps(data, default=str)
                actual_ttl = ttl or self.default_ttls.get('price_data', 60)
                pipe.setex(key, actual_ttl, serialized_value)

            results_list = await pipe.execute()
            
            for i, symbol in enumerate(price_data_dict.keys()):
                results[symbol] = results_list[i] is True

            return results

        except Exception as e:
            self.logger.error(f"Error in batch cache prices: {e}")
            return {symbol: False for symbol in price_data_dict.keys()}

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern."""
        try:
            if not self.redis:
                return 0

            keys = await self.redis.keys(pattern)
            if keys:
                deleted = await self.redis.delete(*keys)
                self.logger.info(f"Invalidated {deleted} keys matching pattern: {pattern}")
                return deleted
            return 0

        except Exception as e:
            self.logger.error(f"Error invalidating pattern {pattern}: {e}")
            return 0

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            if not self.redis:
                return {}

            info = await self.redis.info()
            
            # Get key counts by pattern
            key_patterns = [
                'price:*', 'yield_opportunities:*', 'portfolio_analysis:*',
                'ai_prediction_*:*', 'market_data:*', 'gas_prices:*'
            ]
            
            key_counts = {}
            for pattern in key_patterns:
                keys = await self.redis.keys(pattern)
                pattern_name = pattern.replace(':*', '').replace('_*', '')
                key_counts[f"{pattern_name}_keys"] = len(keys)

            return {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory_human': info.get('used_memory_human', '0B'),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': (info.get('keyspace_hits', 0) / 
                           max(info.get('keyspace_hits', 0) + info.get('keyspace_misses', 0), 1)),
                **key_counts
            }

        except Exception as e:
            self.logger.error(f"Error getting cache stats: {e}")
            return {}

    async def flush_cache(self, pattern: Optional[str] = None) -> bool:
        """Flush cache - all keys or pattern-specific."""
        try:
            if not self.redis:
                return False

            if pattern:
                deleted = await self.invalidate_pattern(pattern)
                self.logger.info(f"Flushed {deleted} keys matching pattern: {pattern}")
            else:
                await self.redis.flushdb()
                self.logger.info("Flushed entire cache database")

            return True

        except Exception as e:
            self.logger.error(f"Error flushing cache: {e}")
            return False

    async def set_if_not_exists(self, key: str, value: Any, ttl: Optional[int] = None,
                              data_type: str = 'default') -> bool:
        """Set cache value only if key doesn't exist."""
        try:
            if not self.redis:
                return False

            # Check if key exists
            if await self.exists(key):
                return False

            return await self.set(key, value, ttl, data_type)

        except Exception as e:
            self.logger.error(f"Error setting cache key {key} if not exists: {e}")
            return False

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a numeric cache value."""
        try:
            if not self.redis:
                return None

            result = await self.redis.incrby(key, amount)
            return result

        except Exception as e:
            self.logger.error(f"Error incrementing cache key {key}: {e}")
            return None

    async def get_ttl(self, key: str) -> Optional[int]:
        """Get TTL for a cache key."""
        try:
            if not self.redis:
                return None

            ttl = await self.redis.ttl(key)
            return ttl if ttl > 0 else None

        except Exception as e:
            self.logger.error(f"Error getting TTL for key {key}: {e}")
            return None
