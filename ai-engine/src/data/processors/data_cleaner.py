import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import re

class DataCleaner:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    def clean_price_data(self, price_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Clean and validate price data."""
        try:
            df = pd.DataFrame(price_data)
            
            if df.empty:
                return df
            
            # Convert timestamp to datetime
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df = df.sort_values('timestamp')
            
            # Clean price columns
            price_columns = ['price', 'volume', 'market_cap']
            for col in price_columns:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    df[col] = df[col].fillna(0)
                    
                    # Remove negative values
                    df[col] = df[col].clip(lower=0)
                    
                    # Remove extreme outliers (beyond 99.9th percentile)
                    if col == 'price':
                        upper_bound = df[col].quantile(0.999)
                        df[col] = df[col].clip(upper=upper_bound)
            
            # Remove duplicate timestamps
            df = df.drop_duplicates(subset=['timestamp'], keep='last')
            
            # Fill missing values with forward fill
            df = df.fillna(method='ffill')
            
            # Remove rows with zero price
            if 'price' in df.columns:
                df = df[df['price'] > 0]
            
            self.logger.info(f"Cleaned price data: {len(df)} records")
            return df
            
        except Exception as e:
            self.logger.error(f"Error cleaning price data: {e}")
            return pd.DataFrame()

    def clean_yield_data(self, yield_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Clean and validate yield data."""
        try:
            df = pd.DataFrame(yield_data)
            
            if df.empty:
                return df
            
            # Clean APY values
            if 'apy' in df.columns:
                df['apy'] = pd.to_numeric(df['apy'], errors='coerce')
                df['apy'] = df['apy'].fillna(0)
                
                # Remove unrealistic APY values (>1000% or negative)
                df['apy'] = df['apy'].clip(lower=0, upper=1000)
            
            # Clean TVL values
            if 'tvl' in df.columns:
                df['tvl'] = pd.to_numeric(df['tvl'], errors='coerce')
                df['tvl'] = df['tvl'].fillna(0)
                df['tvl'] = df['tvl'].clip(lower=0)
            
            # Clean protocol names
            if 'protocol' in df.columns:
                df['protocol'] = df['protocol'].astype(str)
                df['protocol'] = df['protocol'].str.strip()
                df['protocol'] = df['protocol'].replace('', 'Unknown')
            
            # Standardize chain names
            if 'chain' in df.columns:
                df['chain'] = df['chain'].astype(str).str.lower()
                df['chain'] = df['chain'].replace({
                    'eth': 'ethereum',
                    'matic': 'polygon',
                    'avax': 'avalanche',
                    'arb': 'arbitrum',
                    'op': 'optimism'
                })
            
            # Clean risk scores
            if 'risk_score' in df.columns:
                df['risk_score'] = pd.to_numeric(df['risk_score'], errors='coerce')
                df['risk_score'] = df['risk_score'].fillna(5)  # Default medium risk
                df['risk_score'] = df['risk_score'].clip(lower=1, upper=10)
            
            # Remove duplicate protocols
            if 'protocol' in df.columns and 'chain' in df.columns:
                df = df.drop_duplicates(subset=['protocol', 'chain'], keep='last')
            
            self.logger.info(f"Cleaned yield data: {len(df)} records")
            return df
            
        except Exception as e:
            self.logger.error(f"Error cleaning yield data: {e}")
            return pd.DataFrame()

    def clean_portfolio_data(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Clean and validate portfolio data."""
        try:
            cleaned_data = portfolio_data.copy()
            
            # Clean allocation values
            if 'allocations' in cleaned_data:
                allocations = cleaned_data['allocations']
                if isinstance(allocations, list):
                    for allocation in allocations:
                        if 'percentage' in allocation:
                            allocation['percentage'] = max(0, min(100, float(allocation.get('percentage', 0))))
                        if 'amount' in allocation:
                            allocation['amount'] = max(0, float(allocation.get('amount', 0)))
                        if 'expected_return' in allocation:
                            allocation['expected_return'] = max(0, min(1000, float(allocation.get('expected_return', 0))))
                
                # Ensure allocations sum to 100%
                total_percentage = sum(alloc.get('percentage', 0) for alloc in allocations)
                if total_percentage > 0 and total_percentage != 100:
                    for allocation in allocations:
                        allocation['percentage'] = (allocation.get('percentage', 0) / total_percentage) * 100
            
            # Clean balance values
            balance_fields = ['total_value', 'available_balance', 'locked_balance']
            for field in balance_fields:
                if field in cleaned_data:
                    cleaned_data[field] = max(0, float(cleaned_data.get(field, 0)))
            
            # Clean risk tolerance
            if 'risk_tolerance' in cleaned_data:
                cleaned_data['risk_tolerance'] = max(1, min(10, int(cleaned_data.get('risk_tolerance', 5))))
            
            self.logger.info("Cleaned portfolio data")
            return cleaned_data
            
        except Exception as e:
            self.logger.error(f"Error cleaning portfolio data: {e}")
            return {}

    def remove_outliers(self, df: pd.DataFrame, columns: List[str], method: str = 'iqr') -> pd.DataFrame:
        """Remove outliers from specified columns."""
        try:
            cleaned_df = df.copy()
            
            for col in columns:
                if col not in df.columns:
                    continue
                
                if method == 'iqr':
                    Q1 = df[col].quantile(0.25)
                    Q3 = df[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    cleaned_df = cleaned_df[(cleaned_df[col] >= lower_bound) & (cleaned_df[col] <= upper_bound)]
                
                elif method == 'zscore':
                    z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
                    cleaned_df = cleaned_df[z_scores < 3]
                
                elif method == 'percentile':
                    lower_bound = df[col].quantile(0.01)
                    upper_bound = df[col].quantile(0.99)
                    cleaned_df = cleaned_df[(cleaned_df[col] >= lower_bound) & (cleaned_df[col] <= upper_bound)]
            
            removed_count = len(df) - len(cleaned_df)
            self.logger.info(f"Removed {removed_count} outliers using {method} method")
            
            return cleaned_df
            
        except Exception as e:
            self.logger.error(f"Error removing outliers: {e}")
            return df

    def validate_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Validate data quality and return quality metrics."""
        try:
            if df.empty:
                return {'quality_score': 0, 'issues': ['Empty dataset']}
            
            quality_metrics = {
                'total_records': len(df),
                'missing_values': df.isnull().sum().to_dict(),
                'duplicate_records': df.duplicated().sum(),
                'data_types': df.dtypes.to_dict(),
                'memory_usage': df.memory_usage(deep=True).sum(),
                'issues': []
            }
            
            # Check for high missing value percentage
            missing_percentage = (df.isnull().sum() / len(df) * 100)
            high_missing_cols = missing_percentage[missing_percentage > 50].index.tolist()
            if high_missing_cols:
                quality_metrics['issues'].append(f"High missing values in columns: {high_missing_cols}")
            
            # Check for duplicate records
            if quality_metrics['duplicate_records'] > 0:
                quality_metrics['issues'].append(f"Found {quality_metrics['duplicate_records']} duplicate records")
            
            # Calculate overall quality score
            quality_score = 100
            quality_score -= min(50, missing_percentage.mean())  # Deduct for missing values
            quality_score -= min(20, (quality_metrics['duplicate_records'] / len(df)) * 100)  # Deduct for duplicates
            
            quality_metrics['quality_score'] = max(0, quality_score)
            
            return quality_metrics
            
        except Exception as e:
            self.logger.error(f"Error validating data quality: {e}")
            return {'quality_score': 0, 'issues': ['Validation error']}

    def clean_text_data(self, text_data: List[str]) -> List[str]:
        """Clean and standardize text data."""
        try:
            cleaned_texts = []
            
            for text in text_data:
                if not isinstance(text, str):
                    text = str(text)
                
                # Remove extra whitespace
                text = re.sub(r'\s+', ' ', text).strip()
                
                # Remove special characters but keep alphanumeric and common symbols
                text = re.sub(r'[^\w\s\-\.\(\)\[\]]', '', text)
                
                # Convert to lowercase for consistency
                text = text.lower()
                
                # Skip empty strings
                if text:
                    cleaned_texts.append(text)
            
            return cleaned_texts
            
        except Exception as e:
            self.logger.error(f"Error cleaning text data: {e}")
            return []

    def handle_missing_values(self, df: pd.DataFrame, strategy: Dict[str, str] = None) -> pd.DataFrame:
        """Handle missing values with specified strategies."""
        try:
            if strategy is None:
                strategy = {}
            
            cleaned_df = df.copy()
            
            for column in df.columns:
                if df[column].isnull().any():
                    col_strategy = strategy.get(column, 'forward_fill')
                    
                    if col_strategy == 'drop':
                        cleaned_df = cleaned_df.dropna(subset=[column])
                    elif col_strategy == 'mean' and df[column].dtype in ['int64', 'float64']:
                        cleaned_df[column] = cleaned_df[column].fillna(df[column].mean())
                    elif col_strategy == 'median' and df[column].dtype in ['int64', 'float64']:
                        cleaned_df[column] = cleaned_df[column].fillna(df[column].median())
                    elif col_strategy == 'mode':
                        mode_value = df[column].mode()
                        if not mode_value.empty:
                            cleaned_df[column] = cleaned_df[column].fillna(mode_value[0])
                    elif col_strategy == 'forward_fill':
                        cleaned_df[column] = cleaned_df[column].fillna(method='ffill')
                    elif col_strategy == 'backward_fill':
                        cleaned_df[column] = cleaned_df[column].fillna(method='bfill')
                    elif col_strategy == 'zero':
                        cleaned_df[column] = cleaned_df[column].fillna(0)
                    elif isinstance(col_strategy, (int, float, str)):
                        cleaned_df[column] = cleaned_df[column].fillna(col_strategy)
            
            return cleaned_df
            
        except Exception as e:
            self.logger.error(f"Error handling missing values: {e}")
            return df

    def standardize_timestamps(self, df: pd.DataFrame, timestamp_col: str = 'timestamp') -> pd.DataFrame:
        """Standardize timestamp formats and handle timezone issues."""
        try:
            if timestamp_col not in df.columns:
                return df
            
            cleaned_df = df.copy()
            
            # Convert to datetime
            cleaned_df[timestamp_col] = pd.to_datetime(cleaned_df[timestamp_col], errors='coerce')
            
            # Remove rows with invalid timestamps
            cleaned_df = cleaned_df.dropna(subset=[timestamp_col])
            
            # Convert to UTC if timezone-aware
            if cleaned_df[timestamp_col].dt.tz is not None:
                cleaned_df[timestamp_col] = cleaned_df[timestamp_col].dt.tz_convert('UTC')
            
            # Sort by timestamp
            cleaned_df = cleaned_df.sort_values(timestamp_col)
            
            return cleaned_df
            
        except Exception as e:
            self.logger.error(f"Error standardizing timestamps: {e}")
            return df
