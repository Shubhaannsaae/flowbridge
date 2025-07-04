import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import asyncpg
import pandas as pd
from contextlib import asynccontextmanager
import json

class DatabaseManager:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.pool: Optional[asyncpg.Pool] = None
        self.logger = logging.getLogger(__name__)

    async def initialize(self):
        """Initialize database connection pool."""
        try:
            self.pool = await asyncpg.create_pool(
                self.connection_string,
                min_size=5,
                max_size=20,
                command_timeout=60,
                server_settings={
                    'jit': 'off'
                }
            )
            
            # Create tables if they don't exist
            await self._create_tables()
            self.logger.info("Database initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize database: {e}")
            raise

    async def close(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            self.logger.info("Database connection pool closed")

    @asynccontextmanager
    async def get_connection(self):
        """Get database connection from pool."""
        async with self.pool.acquire() as connection:
            yield connection

    async def _create_tables(self):
        """Create database tables if they don't exist."""
        tables_sql = [
            """
            CREATE TABLE IF NOT EXISTS price_data (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                price DECIMAL(20, 8) NOT NULL,
                volume DECIMAL(20, 8) DEFAULT 0,
                market_cap DECIMAL(20, 2) DEFAULT 0,
                price_change_24h DECIMAL(10, 4) DEFAULT 0,
                timestamp TIMESTAMP NOT NULL,
                source VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, timestamp, source)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS yield_data (
                id SERIAL PRIMARY KEY,
                protocol VARCHAR(100) NOT NULL,
                pool_name VARCHAR(200),
                apy DECIMAL(10, 4) NOT NULL,
                tvl DECIMAL(20, 2) DEFAULT 0,
                risk_score INTEGER DEFAULT 5,
                category VARCHAR(50),
                chain VARCHAR(50) NOT NULL,
                contract_address VARCHAR(42),
                token_symbols TEXT[],
                minimum_deposit DECIMAL(20, 8) DEFAULT 0,
                lock_period INTEGER DEFAULT 0,
                last_updated TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(protocol, pool_name, chain, last_updated)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id SERIAL PRIMARY KEY,
                portfolio_id VARCHAR(100) NOT NULL,
                total_value DECIMAL(20, 8) NOT NULL,
                allocations JSONB NOT NULL,
                performance_metrics JSONB,
                risk_metrics JSONB,
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS market_data (
                id SERIAL PRIMARY KEY,
                total_market_cap DECIMAL(20, 2),
                total_volume_24h DECIMAL(20, 2),
                btc_dominance DECIMAL(5, 2),
                eth_dominance DECIMAL(5, 2),
                defi_market_cap DECIMAL(20, 2),
                fear_greed_index INTEGER,
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(timestamp)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS ai_predictions (
                id SERIAL PRIMARY KEY,
                model_type VARCHAR(50) NOT NULL,
                input_data JSONB NOT NULL,
                prediction JSONB NOT NULL,
                confidence DECIMAL(3, 2),
                model_version VARCHAR(20),
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS gas_prices (
                id SERIAL PRIMARY KEY,
                chain VARCHAR(50) NOT NULL,
                slow DECIMAL(10, 2),
                standard DECIMAL(10, 2),
                fast DECIMAL(10, 2),
                instant DECIMAL(10, 2),
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(chain, timestamp)
            );
            """
        ]

        # Create indexes
        indexes_sql = [
            "CREATE INDEX IF NOT EXISTS idx_price_data_symbol_timestamp ON price_data(symbol, timestamp DESC);",
            "CREATE INDEX IF NOT EXISTS idx_yield_data_protocol_chain ON yield_data(protocol, chain);",
            "CREATE INDEX IF NOT EXISTS idx_yield_data_apy ON yield_data(apy DESC);",
            "CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_id_timestamp ON portfolio_snapshots(portfolio_id, timestamp DESC);",
            "CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp DESC);",
            "CREATE INDEX IF NOT EXISTS idx_ai_predictions_model_timestamp ON ai_predictions(model_type, timestamp DESC);",
            "CREATE INDEX IF NOT EXISTS idx_gas_prices_chain_timestamp ON gas_prices(chain, timestamp DESC);"
        ]

        async with self.get_connection() as conn:
            # Create tables
            for table_sql in tables_sql:
                await conn.execute(table_sql)
            
            # Create indexes
            for index_sql in indexes_sql:
                await conn.execute(index_sql)

    async def store_price_data(self, price_data: List[Dict[str, Any]]) -> int:
        """Store price data in bulk."""
        try:
            if not price_data:
                return 0

            async with self.get_connection() as conn:
                # Prepare data for insertion
                records = []
                for data in price_data:
                    records.append((
                        data['symbol'],
                        float(data['price']),
                        float(data.get('volume', 0)),
                        float(data.get('market_cap', 0)),
                        float(data.get('price_change_24h', 0)),
                        data['timestamp'],
                        data.get('source', 'unknown')
                    ))

                # Bulk insert with ON CONFLICT handling
                await conn.executemany(
                    """
                    INSERT INTO price_data (symbol, price, volume, market_cap, price_change_24h, timestamp, source)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (symbol, timestamp, source) DO UPDATE SET
                        price = EXCLUDED.price,
                        volume = EXCLUDED.volume,
                        market_cap = EXCLUDED.market_cap,
                        price_change_24h = EXCLUDED.price_change_24h
                    """,
                    records
                )

                self.logger.info(f"Stored {len(records)} price records")
                return len(records)

        except Exception as e:
            self.logger.error(f"Error storing price data: {e}")
            raise

    async def store_yield_data(self, yield_data: List[Dict[str, Any]]) -> int:
        """Store yield data in bulk."""
        try:
            if not yield_data:
                return 0

            async with self.get_connection() as conn:
                records = []
                for data in yield_data:
                    records.append((
                        data['protocol'],
                        data.get('pool_name'),
                        float(data['apy']),
                        float(data.get('tvl', 0)),
                        int(data.get('risk_score', 5)),
                        data.get('category'),
                        data['chain'],
                        data.get('contract_address'),
                        data.get('token_symbols', []),
                        float(data.get('minimum_deposit', 0)),
                        int(data.get('lock_period', 0)),
                        data['last_updated']
                    ))

                await conn.executemany(
                    """
                    INSERT INTO yield_data (protocol, pool_name, apy, tvl, risk_score, category, 
                                          chain, contract_address, token_symbols, minimum_deposit, 
                                          lock_period, last_updated)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (protocol, pool_name, chain, last_updated) DO UPDATE SET
                        apy = EXCLUDED.apy,
                        tvl = EXCLUDED.tvl,
                        risk_score = EXCLUDED.risk_score
                    """,
                    records
                )

                self.logger.info(f"Stored {len(records)} yield records")
                return len(records)

        except Exception as e:
            self.logger.error(f"Error storing yield data: {e}")
            raise

    async def store_portfolio_snapshot(self, portfolio_id: str, snapshot_data: Dict[str, Any]) -> bool:
        """Store portfolio snapshot."""
        try:
            async with self.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO portfolio_snapshots 
                    (portfolio_id, total_value, allocations, performance_metrics, risk_metrics, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    portfolio_id,
                    float(snapshot_data['total_value']),
                    json.dumps(snapshot_data['allocations']),
                    json.dumps(snapshot_data.get('performance_metrics', {})),
                    json.dumps(snapshot_data.get('risk_metrics', {})),
                    snapshot_data['timestamp']
                )

                self.logger.info(f"Stored portfolio snapshot for {portfolio_id}")
                return True

        except Exception as e:
            self.logger.error(f"Error storing portfolio snapshot: {e}")
            return False

    async def store_market_data(self, market_data: Dict[str, Any]) -> bool:
        """Store market data."""
        try:
            async with self.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO market_data 
                    (total_market_cap, total_volume_24h, btc_dominance, eth_dominance, 
                     defi_market_cap, fear_greed_index, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (timestamp) DO UPDATE SET
                        total_market_cap = EXCLUDED.total_market_cap,
                        total_volume_24h = EXCLUDED.total_volume_24h,
                        btc_dominance = EXCLUDED.btc_dominance,
                        eth_dominance = EXCLUDED.eth_dominance,
                        defi_market_cap = EXCLUDED.defi_market_cap,
                        fear_greed_index = EXCLUDED.fear_greed_index
                    """,
                    float(market_data.get('total_market_cap', 0)),
                    float(market_data.get('total_volume_24h', 0)),
                    float(market_data.get('btc_dominance', 0)),
                    float(market_data.get('eth_dominance', 0)),
                    float(market_data.get('defi_market_cap', 0)),
                    int(market_data.get('fear_greed_index', 50)),
                    market_data['timestamp']
                )

                return True

        except Exception as e:
            self.logger.error(f"Error storing market data: {e}")
            return False

    async def store_ai_prediction(self, model_type: str, input_data: Dict[str, Any], 
                                prediction: Dict[str, Any], confidence: float, 
                                model_version: str = "1.0") -> bool:
        """Store AI prediction."""
        try:
            async with self.get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO ai_predictions 
                    (model_type, input_data, prediction, confidence, model_version, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    model_type,
                    json.dumps(input_data),
                    json.dumps(prediction),
                    float(confidence),
                    model_version,
                    datetime.now()
                )

                return True

        except Exception as e:
            self.logger.error(f"Error storing AI prediction: {e}")
            return False

    async def get_price_history(self, symbol: str, days: int = 30) -> pd.DataFrame:
        """Get price history for a symbol."""
        try:
            async with self.get_connection() as conn:
                cutoff_date = datetime.now() - timedelta(days=days)
                
                rows = await conn.fetch(
                    """
                    SELECT timestamp, price, volume, price_change_24h
                    FROM price_data
                    WHERE symbol = $1 AND timestamp >= $2
                    ORDER BY timestamp DESC
                    """,
                    symbol.upper(),
                    cutoff_date
                )

                if rows:
                    return pd.DataFrame([dict(row) for row in rows])
                else:
                    return pd.DataFrame()

        except Exception as e:
            self.logger.error(f"Error getting price history for {symbol}: {e}")
            return pd.DataFrame()

    async def get_yield_opportunities(self, min_apy: float = 1.0, min_tvl: float = 100000,
                                    chains: List[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get yield opportunities based on criteria."""
        try:
            async with self.get_connection() as conn:
                conditions = ["apy >= $1", "tvl >= $2"]
                params = [min_apy, min_tvl]
                param_count = 2

                if chains:
                    param_count += 1
                    conditions.append(f"chain = ANY(${param_count})")
                    params.append(chains)

                param_count += 1
                query = f"""
                    SELECT DISTINCT ON (protocol, pool_name, chain)
                           protocol, pool_name, apy, tvl, risk_score, category, 
                           chain, contract_address, token_symbols, minimum_deposit, 
                           lock_period, last_updated
                    FROM yield_data
                    WHERE {' AND '.join(conditions)}
                    ORDER BY protocol, pool_name, chain, last_updated DESC, apy DESC
                    LIMIT ${param_count}
                """
                params.append(limit)

                rows = await conn.fetch(query, *params)
                
                return [dict(row) for row in rows]

        except Exception as e:
            self.logger.error(f"Error getting yield opportunities: {e}")
            return []

    async def get_portfolio_history(self, portfolio_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get portfolio history."""
        try:
            async with self.get_connection() as conn:
                cutoff_date = datetime.now() - timedelta(days=days)
                
                rows = await conn.fetch(
                    """
                    SELECT total_value, allocations, performance_metrics, risk_metrics, timestamp
                    FROM portfolio_snapshots
                    WHERE portfolio_id = $1 AND timestamp >= $2
                    ORDER BY timestamp DESC
                    """,
                    portfolio_id,
                    cutoff_date
                )

                result = []
                for row in rows:
                    result.append({
                        'total_value': float(row['total_value']),
                        'allocations': json.loads(row['allocations']),
                        'performance_metrics': json.loads(row['performance_metrics']) if row['performance_metrics'] else {},
                        'risk_metrics': json.loads(row['risk_metrics']) if row['risk_metrics'] else {},
                        'timestamp': row['timestamp']
                    })

                return result

        except Exception as e:
            self.logger.error(f"Error getting portfolio history: {e}")
            return []

    async def get_latest_market_data(self) -> Optional[Dict[str, Any]]:
        """Get latest market data."""
        try:
            async with self.get_connection() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT * FROM market_data
                    ORDER BY timestamp DESC
                    LIMIT 1
                    """
                )

                if row:
                    return dict(row)
                return None

        except Exception as e:
            self.logger.error(f"Error getting latest market data: {e}")
            return None

    async def get_ai_predictions(self, model_type: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent AI predictions."""
        try:
            async with self.get_connection() as conn:
                rows = await conn.fetch(
                    """
                    SELECT input_data, prediction, confidence, model_version, timestamp
                    FROM ai_predictions
                    WHERE model_type = $1
                    ORDER BY timestamp DESC
                    LIMIT $2
                    """,
                    model_type,
                    limit
                )

                result = []
                for row in rows:
                    result.append({
                        'input_data': json.loads(row['input_data']),
                        'prediction': json.loads(row['prediction']),
                        'confidence': float(row['confidence']),
                        'model_version': row['model_version'],
                        'timestamp': row['timestamp']
                    })

                return result

        except Exception as e:
            self.logger.error(f"Error getting AI predictions: {e}")
            return []

    async def cleanup_old_data(self, days_to_keep: int = 90) -> Dict[str, int]:
        """Clean up old data beyond retention period."""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            cleanup_counts = {}

            async with self.get_connection() as conn:
                # Clean up old price data
                result = await conn.execute(
                    "DELETE FROM price_data WHERE created_at < $1",
                    cutoff_date
                )
                cleanup_counts['price_data'] = int(result.split()[-1])

                # Clean up old yield data
                result = await conn.execute(
                    "DELETE FROM yield_data WHERE created_at < $1",
                    cutoff_date
                )
                cleanup_counts['yield_data'] = int(result.split()[-1])

                # Clean up old AI predictions
                result = await conn.execute(
                    "DELETE FROM ai_predictions WHERE created_at < $1",
                    cutoff_date
                )
                cleanup_counts['ai_predictions'] = int(result.split()[-1])

                # Keep portfolio snapshots longer (6 months)
                portfolio_cutoff = datetime.now() - timedelta(days=180)
                result = await conn.execute(
                    "DELETE FROM portfolio_snapshots WHERE created_at < $1",
                    portfolio_cutoff
                )
                cleanup_counts['portfolio_snapshots'] = int(result.split()[-1])

                self.logger.info(f"Cleanup completed: {cleanup_counts}")
                return cleanup_counts

        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")
            return {}

    async def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        try:
            async with self.get_connection() as conn:
                stats = {}
                
                # Table sizes
                tables = ['price_data', 'yield_data', 'portfolio_snapshots', 'market_data', 'ai_predictions', 'gas_prices']
                for table in tables:
                    count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                    stats[f"{table}_count"] = count

                # Database size
                size_result = await conn.fetchrow(
                    "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
                )
                stats['database_size'] = size_result['size']

                # Recent activity
                recent_cutoff = datetime.now() - timedelta(hours=24)
                for table in tables:
                    if table in ['price_data', 'yield_data', 'ai_predictions']:
                        count = await conn.fetchval(
                            f"SELECT COUNT(*) FROM {table} WHERE created_at >= $1",
                            recent_cutoff
                        )
                        stats[f"{table}_recent"] = count

                return stats

        except Exception as e:
            self.logger.error(f"Error getting database stats: {e}")
            return {}
