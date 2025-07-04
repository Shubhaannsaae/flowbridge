import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import talib
from sklearn.preprocessing import StandardScaler
from scipy import stats

class FeatureExtractor:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.scaler = StandardScaler()
        
    def extract_price_features(self, price_data: pd.DataFrame) -> pd.DataFrame:
        """Extract technical indicators and price-based features."""
        try:
            if price_data.empty or 'price' not in price_data.columns:
                return pd.DataFrame()
            
            df = price_data.copy()
            prices = df['price'].values
            
            # Basic price features
            df['price_change'] = df['price'].pct_change()
            df['price_change_abs'] = df['price_change'].abs()
            df['log_return'] = np.log(df['price'] / df['price'].shift(1))
            
            # Moving averages
            for window in [7, 14, 30, 50]:
                df[f'ma_{window}'] = df['price'].rolling(window=window).mean()
                df[f'price_ma_{window}_ratio'] = df['price'] / df[f'ma_{window}']
            
            # Technical indicators using TA-Lib
            if len(prices) >= 14:
                # RSI
                df['rsi'] = talib.RSI(prices, timeperiod=14)
                
                # MACD
                macd, macd_signal, macd_hist = talib.MACD(prices)
                df['macd'] = macd
                df['macd_signal'] = macd_signal
                df['macd_histogram'] = macd_hist
                
                # Bollinger Bands
                bb_upper, bb_middle, bb_lower = talib.BBANDS(prices)
                df['bb_upper'] = bb_upper
                df['bb_middle'] = bb_middle
                df['bb_lower'] = bb_lower
                df['bb_width'] = (bb_upper - bb_lower) / bb_middle
                df['bb_position'] = (prices - bb_lower) / (bb_upper - bb_lower)
                
                # Stochastic
                stoch_k, stoch_d = talib.STOCH(df['price'].values, df['price'].values, df['price'].values)
                df['stoch_k'] = stoch_k
                df['stoch_d'] = stoch_d
            
            # Volatility features
            df['volatility_7d'] = df['price_change'].rolling(window=7).std()
            df['volatility_30d'] = df['price_change'].rolling(window=30).std()
            
            # Volume features if available
            if 'volume' in df.columns:
                df['volume_ma_7'] = df['volume'].rolling(window=7).mean()
                df['volume_ratio'] = df['volume'] / df['volume_ma_7']
                df['price_volume_trend'] = df['price_change'] * df['volume']
            
            # Support and resistance levels
            df['price_high_14d'] = df['price'].rolling(window=14).max()
            df['price_low_14d'] = df['price'].rolling(window=14).min()
            df['price_position_14d'] = (df['price'] - df['price_low_14d']) / (df['price_high_14d'] - df['price_low_14d'])
            
            self.logger.info(f"Extracted price features: {len(df.columns)} columns")
            return df
            
        except Exception as e:
            self.logger.error(f"Error extracting price features: {e}")
            return pd.DataFrame()

    def extract_yield_features(self, yield_data: pd.DataFrame) -> pd.DataFrame:
        """Extract yield-related features."""
        try:
            if yield_data.empty:
                return pd.DataFrame()
            
            df = yield_data.copy()
            
            # APY-based features
            if 'apy' in df.columns:
                df['apy_log'] = np.log1p(df['apy'])  # Log transform for skewed data
                df['apy_zscore'] = stats.zscore(df['apy'])
                
                # APY categories
                df['apy_category'] = pd.cut(df['apy'], 
                                          bins=[0, 2, 5, 10, 20, float('inf')],
                                          labels=['very_low', 'low', 'medium', 'high', 'very_high'])
            
            # TVL-based features
            if 'tvl' in df.columns:
                df['tvl_log'] = np.log1p(df['tvl'])
                df['tvl_zscore'] = stats.zscore(df['tvl'])
                
                # TVL categories
                df['tvl_category'] = pd.cut(df['tvl'],
                                          bins=[0, 1e6, 10e6, 100e6, 1e9, float('inf')],
                                          labels=['very_small', 'small', 'medium', 'large', 'very_large'])
            
            # Risk-adjusted metrics
            if 'apy' in df.columns and 'risk_score' in df.columns:
                df['risk_adjusted_yield'] = df['apy'] / df['risk_score']
                df['yield_risk_ratio'] = df['apy'] / (df['risk_score'] + 1)  # Add 1 to avoid division by zero
            
            # Protocol reputation features
            if 'protocol' in df.columns:
                # Create protocol reputation score based on known protocols
                reputable_protocols = ['aave', 'compound', 'uniswap', 'curve', 'yearn']
                df['protocol_reputation'] = df['protocol'].str.lower().apply(
                    lambda x: 1 if any(rep in x for rep in reputable_protocols) else 0
                )
            
            # Chain-based features
            if 'chain' in df.columns:
                # Create chain risk scores
                chain_risk_scores = {
                    'ethereum': 1,
                    'polygon': 2,
                    'arbitrum': 2,
                    'optimism': 2,
                    'avalanche': 3,
                    'bsc': 4,
                    'fantom': 4
                }
                df['chain_risk_score'] = df['chain'].map(chain_risk_scores).fillna(5)
            
            # Time-based features
            if 'last_updated' in df.columns:
                df['last_updated'] = pd.to_datetime(df['last_updated'])
                df['days_since_update'] = (datetime.now() - df['last_updated']).dt.days
                df['is_recent'] = df['days_since_update'] <= 1
            
            self.logger.info(f"Extracted yield features: {len(df.columns)} columns")
            return df
            
        except Exception as e:
            self.logger.error(f"Error extracting yield features: {e}")
            return pd.DataFrame()

    def extract_portfolio_features(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract portfolio-level features."""
        try:
            features = {}
            
            # Basic portfolio metrics
            if 'allocations' in portfolio_data:
                allocations = portfolio_data['allocations']
                if allocations:
                    # Diversification metrics
                    features['num_positions'] = len(allocations)
                    
                    # Calculate Herfindahl-Hirschman Index for concentration
                    percentages = [alloc.get('percentage', 0) / 100 for alloc in allocations]
                    features['hhi_concentration'] = sum(p**2 for p in percentages)
                    features['diversification_ratio'] = 1 - features['hhi_concentration']
                    
                    # Risk metrics
                    risk_scores = [alloc.get('risk_score', 5) for alloc in allocations]
                    weights = [alloc.get('percentage', 0) / 100 for alloc in allocations]
                    features['weighted_avg_risk'] = sum(r * w for r, w in zip(risk_scores, weights))
                    features['max_position_risk'] = max(risk_scores) if risk_scores else 0
                    
                    # Return metrics
                    expected_returns = [alloc.get('expected_return', 0) for alloc in allocations]
                    features['weighted_avg_return'] = sum(r * w for r, w in zip(expected_returns, weights))
                    features['max_position_return'] = max(expected_returns) if expected_returns else 0
                    
                    # Sharpe ratio approximation
                    if features['weighted_avg_risk'] > 0:
                        features['approx_sharpe_ratio'] = features['weighted_avg_return'] / features['weighted_avg_risk']
                    else:
                        features['approx_sharpe_ratio'] = 0
            
            # Balance-based features
            balance_fields = ['total_value', 'available_balance', 'locked_balance']
            for field in balance_fields:
                if field in portfolio_data:
                    features[field] = portfolio_data[field]
            
            # Calculate ratios
            if 'total_value' in features and features['total_value'] > 0:
                if 'available_balance' in features:
                    features['liquidity_ratio'] = features['available_balance'] / features['total_value']
                if 'locked_balance' in features:
                    features['lock_ratio'] = features['locked_balance'] / features['total_value']
            
            # User preference features
            if 'risk_tolerance' in portfolio_data:
                features['risk_tolerance'] = portfolio_data['risk_tolerance']
                
                # Risk alignment score
                if 'weighted_avg_risk' in features:
                    features['risk_alignment'] = 1 - abs(features['weighted_avg_risk'] - portfolio_data['risk_tolerance']) / 10
            
            self.logger.info(f"Extracted portfolio features: {len(features)} features")
            return features
            
        except Exception as e:
            self.logger.error(f"Error extracting portfolio features: {e}")
            return {}

    def extract_market_features(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract market condition features."""
        try:
            features = {}
            
            # Basic market metrics
            market_fields = [
                'total_market_cap', 'total_volume_24h', 'market_cap_change_24h',
                'btc_dominance', 'eth_dominance', 'defi_market_cap'
            ]
            
            for field in market_fields:
                if field in market_data:
                    features[field] = market_data[field]
            
            # Derived market features
            if 'total_market_cap' in features and 'total_volume_24h' in features:
                if features['total_market_cap'] > 0:
                    features['volume_to_mcap_ratio'] = features['total_volume_24h'] / features['total_market_cap']
            
            # Market sentiment indicators
            if 'market_cap_change_24h' in features:
                features['market_sentiment'] = 1 if features['market_cap_change_24h'] > 0 else 0
                features['market_volatility'] = abs(features['market_cap_change_24h'])
            
            # Dominance features
            if 'btc_dominance' in features and 'eth_dominance' in features:
                features['btc_eth_dominance'] = features['btc_dominance'] + features['eth_dominance']
                features['alt_dominance'] = 100 - features['btc_eth_dominance']
            
            # DeFi specific features
            if 'defi_market_cap' in features and 'total_market_cap' in features:
                if features['total_market_cap'] > 0:
                    features['defi_market_share'] = features['defi_market_cap'] / features['total_market_cap']
            
            self.logger.info(f"Extracted market features: {len(features)} features")
            return features
            
        except Exception as e:
            self.logger.error(f"Error extracting market features: {e}")
            return {}

    def create_time_series_features(self, df: pd.DataFrame, target_col: str, 
                                  timestamp_col: str = 'timestamp') -> pd.DataFrame:
        """Create time-series based features."""
        try:
            if df.empty or target_col not in df.columns:
                return df
            
            result_df = df.copy()
            
            # Lag features
            for lag in [1, 3, 7, 14, 30]:
                result_df[f'{target_col}_lag_{lag}'] = result_df[target_col].shift(lag)
            
            # Rolling statistics
            for window in [7, 14, 30]:
                result_df[f'{target_col}_mean_{window}d'] = result_df[target_col].rolling(window=window).mean()
                result_df[f'{target_col}_std_{window}d'] = result_df[target_col].rolling(window=window).std()
                result_df[f'{target_col}_min_{window}d'] = result_df[target_col].rolling(window=window).min()
                result_df[f'{target_col}_max_{window}d'] = result_df[target_col].rolling(window=window).max()
            
            # Trend features
            result_df[f'{target_col}_trend_7d'] = result_df[target_col] - result_df[f'{target_col}_mean_7d']
            result_df[f'{target_col}_trend_30d'] = result_df[target_col] - result_df[f'{target_col}_mean_30d']
            
            # Cyclical features if timestamp is available
            if timestamp_col in result_df.columns:
                result_df[timestamp_col] = pd.to_datetime(result_df[timestamp_col])
                result_df['hour'] = result_df[timestamp_col].dt.hour
                result_df['day_of_week'] = result_df[timestamp_col].dt.dayofweek
                result_df['day_of_month'] = result_df[timestamp_col].dt.day
                result_df['month'] = result_df[timestamp_col].dt.month
                
                # Cyclical encoding
                result_df['hour_sin'] = np.sin(2 * np.pi * result_df['hour'] / 24)
                result_df['hour_cos'] = np.cos(2 * np.pi * result_df['hour'] / 24)
                result_df['day_sin'] = np.sin(2 * np.pi * result_df['day_of_week'] / 7)
                result_df['day_cos'] = np.cos(2 * np.pi * result_df['day_of_week'] / 7)
            
            self.logger.info(f"Created time series features: {len(result_df.columns)} columns")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error creating time series features: {e}")
            return df

    def calculate_correlation_features(self, df: pd.DataFrame, 
                                     asset_columns: List[str]) -> pd.DataFrame:
        """Calculate correlation-based features between assets."""
        try:
            if df.empty or len(asset_columns) < 2:
                return df
            
            result_df = df.copy()
            
            # Calculate pairwise correlations
            for i, col1 in enumerate(asset_columns):
                for col2 in asset_columns[i+1:]:
                    if col1 in df.columns and col2 in df.columns:
                        # Rolling correlation
                        corr_30d = df[col1].rolling(window=30).corr(df[col2])
                        result_df[f'corr_{col1}_{col2}_30d'] = corr_30d
                        
                        # Correlation change
                        corr_7d = df[col1].rolling(window=7).corr(df[col2])
                        result_df[f'corr_change_{col1}_{col2}'] = corr_30d - corr_7d
            
            # Average correlation with other assets
            for col in asset_columns:
                if col in df.columns:
                    other_cols = [c for c in asset_columns if c != col and c in df.columns]
                    if other_cols:
                        correlations = []
                        for other_col in other_cols:
                            corr = df[col].rolling(window=30).corr(df[other_col])
                            correlations.append(corr)
                        
                        result_df[f'{col}_avg_correlation'] = pd.concat(correlations, axis=1).mean(axis=1)
            
            self.logger.info(f"Calculated correlation features")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error calculating correlation features: {e}")
            return df
