import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, PowerTransformer
from sklearn.compose import ColumnTransformer
import joblib
import os

class DataNormalizer:
    def __init__(self, method: str = 'standard'):
        self.logger = logging.getLogger(__name__)
        self.method = method
        self.scalers = {}
        self.fitted_columns = {}
        
        # Initialize scaler based on method
        if method == 'standard':
            self.default_scaler = StandardScaler()
        elif method == 'minmax':
            self.default_scaler = MinMaxScaler()
        elif method == 'robust':
            self.default_scaler = RobustScaler()
        elif method == 'power':
            self.default_scaler = PowerTransformer(method='yeo-johnson')
        else:
            self.default_scaler = StandardScaler()
            
    def fit_transform(self, df: pd.DataFrame, 
                     columns: Optional[List[str]] = None,
                     column_configs: Optional[Dict[str, str]] = None) -> pd.DataFrame:
        """Fit normalizer and transform data."""
        try:
            if df.empty:
                return df
            
            result_df = df.copy()
            
            # Determine columns to normalize
            if columns is None:
                columns = df.select_dtypes(include=[np.number]).columns.tolist()
            
            # Apply column-specific configurations
            if column_configs is None:
                column_configs = {}
            
            for column in columns:
                if column not in df.columns:
                    continue
                
                # Get scaler for this column
                scaler_method = column_configs.get(column, self.method)
                scaler = self._get_scaler(scaler_method)
                
                # Fit and transform
                column_data = df[column].values.reshape(-1, 1)
                
                # Handle NaN values
                mask = ~np.isnan(column_data.flatten())
                if mask.sum() == 0:
                    continue
                
                # Fit scaler on non-NaN values
                scaler.fit(column_data[mask].reshape(-1, 1))
                
                # Transform all values
                normalized_data = np.full_like(column_data.flatten(), np.nan)
                normalized_data[mask] = scaler.transform(column_data[mask].reshape(-1, 1)).flatten()
                
                result_df[column] = normalized_data
                
                # Store scaler for future use
                self.scalers[column] = scaler
                self.fitted_columns[column] = scaler_method
            
            self.logger.info(f"Fitted and transformed {len(columns)} columns")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error in fit_transform: {e}")
            return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform data using previously fitted scalers."""
        try:
            if df.empty or not self.scalers:
                return df
            
            result_df = df.copy()
            
            for column, scaler in self.scalers.items():
                if column not in df.columns:
                    continue
                
                column_data = df[column].values.reshape(-1, 1)
                
                # Handle NaN values
                mask = ~np.isnan(column_data.flatten())
                if mask.sum() == 0:
                    continue
                
                # Transform non-NaN values
                normalized_data = np.full_like(column_data.flatten(), np.nan)
                normalized_data[mask] = scaler.transform(column_data[mask].reshape(-1, 1)).flatten()
                
                result_df[column] = normalized_data
            
            self.logger.info(f"Transformed data using fitted scalers")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error in transform: {e}")
            return df

    def inverse_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Inverse transform normalized data back to original scale."""
        try:
            if df.empty or not self.scalers:
                return df
            
            result_df = df.copy()
            
            for column, scaler in self.scalers.items():
                if column not in df.columns:
                    continue
                
                column_data = df[column].values.reshape(-1, 1)
                
                # Handle NaN values
                mask = ~np.isnan(column_data.flatten())
                if mask.sum() == 0:
                    continue
                
                # Inverse transform non-NaN values
                original_data = np.full_like(column_data.flatten(), np.nan)
                original_data[mask] = scaler.inverse_transform(column_data[mask].reshape(-1, 1)).flatten()
                
                result_df[column] = original_data
            
            self.logger.info(f"Inverse transformed data")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error in inverse_transform: {e}")
            return df

    def normalize_portfolio_data(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize portfolio-specific data."""
        try:
            normalized_data = portfolio_data.copy()
            
            # Normalize percentage allocations to sum to 1
            if 'allocations' in normalized_data:
                allocations = normalized_data['allocations']
                total_percentage = sum(alloc.get('percentage', 0) for alloc in allocations)
                
                if total_percentage > 0:
                    for allocation in allocations:
                        allocation['percentage_normalized'] = allocation.get('percentage', 0) / total_percentage
            
            # Normalize risk scores to 0-1 scale
            if 'risk_tolerance' in normalized_data:
                normalized_data['risk_tolerance_normalized'] = (normalized_data['risk_tolerance'] - 1) / 9
            
            # Normalize balance values using log transformation
            balance_fields = ['total_value', 'available_balance', 'locked_balance']
            for field in balance_fields:
                if field in normalized_data and normalized_data[field] > 0:
                    normalized_data[f'{field}_log_normalized'] = np.log1p(normalized_data[field])
            
            return normalized_data
            
        except Exception as e:
            self.logger.error(f"Error normalizing portfolio data: {e}")
            return portfolio_data

    def normalize_yield_data(self, yield_df: pd.DataFrame) -> pd.DataFrame:
        """Normalize yield-specific data with domain knowledge."""
        try:
            if yield_df.empty:
                return yield_df
            
            result_df = yield_df.copy()
            
            # Log-normalize TVL (typically highly skewed)
            if 'tvl' in result_df.columns:
                result_df['tvl_log'] = np.log1p(result_df['tvl'])
                result_df['tvl_normalized'] = self._min_max_normalize(result_df['tvl_log'])
            
            # Normalize APY using domain-specific bounds
            if 'apy' in result_df.columns:
                # Cap extreme values at 99th percentile
                apy_cap = result_df['apy'].quantile(0.99)
                result_df['apy_capped'] = result_df['apy'].clip(upper=apy_cap)
                result_df['apy_normalized'] = result_df['apy_capped'] / 100  # Convert percentage to decimal
            
            # Normalize risk scores to 0-1 scale
            if 'risk_score' in result_df.columns:
                result_df['risk_score_normalized'] = (result_df['risk_score'] - 1) / 9
            
            # Create stability score based on historical variance
            if 'apy' in result_df.columns and len(result_df) > 7:
                result_df['apy_stability'] = 1 / (1 + result_df['apy'].rolling(window=7).std())
                result_df['apy_stability'] = result_df['apy_stability'].fillna(0.5)
            
            self.logger.info(f"Normalized yield data: {len(result_df.columns)} columns")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error normalizing yield data: {e}")
            return yield_df

    def normalize_price_data(self, price_df: pd.DataFrame) -> pd.DataFrame:
        """Normalize price data with financial domain knowledge."""
        try:
            if price_df.empty:
                return price_df
            
            result_df = price_df.copy()
            
            # Log-normalize price for better distribution
            if 'price' in result_df.columns:
                result_df['price_log'] = np.log(result_df['price'])
                result_df['price_log_normalized'] = self._z_score_normalize(result_df['price_log'])
            
            # Normalize returns
            if 'price_change' in result_df.columns:
                result_df['price_change_normalized'] = self._robust_normalize(result_df['price_change'])
            
            # Normalize volume with log transformation
            if 'volume' in result_df.columns:
                result_df['volume_log'] = np.log1p(result_df['volume'])
                result_df['volume_normalized'] = self._min_max_normalize(result_df['volume_log'])
            
            # Normalize technical indicators to standard ranges
            technical_indicators = ['rsi', 'stoch_k', 'stoch_d']
            for indicator in technical_indicators:
                if indicator in result_df.columns:
                    result_df[f'{indicator}_normalized'] = result_df[indicator] / 100
            
            # Normalize Bollinger Band position (already 0-1)
            if 'bb_position' in result_df.columns:
                result_df['bb_position_normalized'] = result_df['bb_position'].clip(0, 1)
            
            self.logger.info(f"Normalized price data: {len(result_df.columns)} columns")
            return result_df
            
        except Exception as e:
            self.logger.error(f"Error normalizing price data: {e}")
            return price_df

    def create_feature_scaling_config(self, df: pd.DataFrame) -> Dict[str, str]:
        """Create optimal scaling configuration based on data distribution."""
        try:
            config = {}
            
            for column in df.select_dtypes(include=[np.number]).columns:
                data = df[column].dropna()
                
                if len(data) == 0:
                    continue
                
                # Analyze distribution
                skewness = abs(data.skew())
                kurtosis = abs(data.kurtosis())
                
                # Choose scaler based on distribution characteristics
                if skewness > 2 or kurtosis > 7:
                    # Highly skewed or heavy-tailed distribution
                    config[column] = 'power'
                elif data.min() >= 0 and data.max() <= 1:
                    # Already normalized data
                    config[column] = None
                elif skewness > 1:
                    # Moderately skewed
                    config[column] = 'robust'
                else:
                    # Normal-like distribution
                    config[column] = 'standard'
            
            self.logger.info(f"Created scaling config for {len(config)} columns")
            return config
            
        except Exception as e:
            self.logger.error(f"Error creating scaling config: {e}")
            return {}

    def save_scaler(self, filepath: str) -> bool:
        """Save fitted scalers to file."""
        try:
            scaler_data = {
                'scalers': self.scalers,
                'fitted_columns': self.fitted_columns,
                'method': self.method
            }
            
            joblib.dump(scaler_data, filepath)
            self.logger.info(f"Saved scalers to {filepath}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving scalers: {e}")
            return False

    def load_scaler(self, filepath: str) -> bool:
        """Load fitted scalers from file."""
        try:
            if not os.path.exists(filepath):
                self.logger.error(f"Scaler file not found: {filepath}")
                return False
            
            scaler_data = joblib.load(filepath)
            self.scalers = scaler_data['scalers']
            self.fitted_columns = scaler_data['fitted_columns']
            self.method = scaler_data['method']
            
            self.logger.info(f"Loaded scalers from {filepath}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error loading scalers: {e}")
            return False

    def _get_scaler(self, method: str):
        """Get scaler instance based on method."""
        if method == 'standard':
            return StandardScaler()
        elif method == 'minmax':
            return MinMaxScaler()
        elif method == 'robust':
            return RobustScaler()
        elif method == 'power':
            return PowerTransformer(method='yeo-johnson')
        else:
            return StandardScaler()

    def _min_max_normalize(self, series: pd.Series) -> pd.Series:
        """Min-max normalization."""
        return (series - series.min()) / (series.max() - series.min())

    def _z_score_normalize(self, series: pd.Series) -> pd.Series:
        """Z-score normalization."""
        return (series - series.mean()) / series.std()

    def _robust_normalize(self, series: pd.Series) -> pd.Series:
        """Robust normalization using median and IQR."""
        median = series.median()
        q75, q25 = series.quantile([0.75, 0.25])
        iqr = q75 - q25
        return (series - median) / iqr if iqr > 0 else series - median
