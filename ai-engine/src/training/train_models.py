import asyncio
import logging
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import sys

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from models.yield_predictor import YieldPredictor
from models.risk_assessor import RiskAssessor
from models.portfolio_optimizer import PortfolioOptimizer
from models.market_analyzer import MarketAnalyzer
from data.storage.database import DatabaseManager
from data.storage.cache import CacheManager
from utils.config import Config
from utils.logger import setup_logger

class ModelTrainer:
    def __init__(self):
        self.config = Config()
        self.logger = setup_logger('model_trainer')
        self.db_manager = None
        self.cache_manager = None
        
        # Initialize AI models with Gemini API
        self.yield_predictor = YieldPredictor()
        self.risk_assessor = RiskAssessor()
        self.portfolio_optimizer = PortfolioOptimizer()
        self.market_analyzer = MarketAnalyzer()
        
        # Training metrics storage
        self.training_metrics = {
            'yield_prediction': [],
            'risk_assessment': [],
            'portfolio_optimization': [],
            'market_analysis': []
        }

    async def initialize(self):
        """Initialize database and cache connections."""
        try:
            # Initialize database
            db_connection_string = self.config.get('DATABASE_URL')
            if db_connection_string:
                self.db_manager = DatabaseManager(db_connection_string)
                await self.db_manager.initialize()
                self.logger.info("Database initialized for training")
            
            # Initialize cache
            redis_url = self.config.get('REDIS_URL', 'redis://localhost:6379')
            self.cache_manager = CacheManager(redis_url)
            await self.cache_manager.initialize()
            self.logger.info("Cache initialized for training")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize training environment: {e}")
            raise

    async def prepare_training_data(self, model_type: str, days: int = 90) -> Dict[str, Any]:
        """Prepare training data for specific model type."""
        try:
            if model_type == 'yield_prediction':
                return await self._prepare_yield_data(days)
            elif model_type == 'risk_assessment':
                return await self._prepare_risk_data(days)
            elif model_type == 'portfolio_optimization':
                return await self._prepare_portfolio_data(days)
            elif model_type == 'market_analysis':
                return await self._prepare_market_data(days)
            else:
                raise ValueError(f"Unknown model type: {model_type}")
                
        except Exception as e:
            self.logger.error(f"Error preparing training data for {model_type}: {e}")
            raise

    async def _prepare_yield_data(self, days: int) -> Dict[str, Any]:
        """Prepare yield prediction training data."""
        try:
            # Get historical yield data
            yield_opportunities = await self.db_manager.get_yield_opportunities(
                min_apy=0.1, min_tvl=10000, limit=1000
            )
            
            # Get price history for major tokens
            price_symbols = ['ETH', 'BTC', 'USDC', 'USDT']
            price_data = {}
            
            for symbol in price_symbols:
                price_history = await self.db_manager.get_price_history(symbol, days)
                if not price_history.empty:
                    price_data[symbol] = price_history.to_dict('records')
            
            # Structure training data
            training_data = {
                'yield_opportunities': yield_opportunities,
                'price_data': price_data,
                'market_conditions': await self.db_manager.get_latest_market_data(),
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Prepared yield training data: {len(yield_opportunities)} opportunities")
            return training_data
            
        except Exception as e:
            self.logger.error(f"Error preparing yield data: {e}")
            return {}

    async def _prepare_risk_data(self, days: int) -> Dict[str, Any]:
        """Prepare risk assessment training data."""
        try:
            # Get historical portfolio data
            portfolio_data = []
            
            # Get yield data with risk scores
            yield_data = await self.db_manager.get_yield_opportunities(
                min_apy=0.1, min_tvl=1000, limit=500
            )
            
            # Get market volatility data
            market_data = []
            for i in range(days):
                date = datetime.now() - timedelta(days=i)
                daily_market = await self.db_manager.get_latest_market_data()
                if daily_market:
                    market_data.append(daily_market)
            
            training_data = {
                'yield_data': yield_data,
                'market_data': market_data,
                'volatility_metrics': await self._calculate_volatility_metrics(),
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Prepared risk training data: {len(yield_data)} protocols")
            return training_data
            
        except Exception as e:
            self.logger.error(f"Error preparing risk data: {e}")
            return {}

    async def _prepare_portfolio_data(self, days: int) -> Dict[str, Any]:
        """Prepare portfolio optimization training data."""
        try:
            # Get diverse portfolio examples
            portfolio_snapshots = []
            
            # Simulate different portfolio configurations
            sample_portfolios = [
                {
                    'allocations': [
                        {'protocol': 'Aave', 'percentage': 40, 'apy': 4.5, 'risk_score': 3},
                        {'protocol': 'Compound', 'percentage': 30, 'apy': 3.8, 'risk_score': 2},
                        {'protocol': 'Yearn', 'percentage': 30, 'apy': 8.2, 'risk_score': 6}
                    ],
                    'total_value': 10000,
                    'risk_tolerance': 5
                },
                {
                    'allocations': [
                        {'protocol': 'Uniswap V3', 'percentage': 50, 'apy': 12.5, 'risk_score': 7},
                        {'protocol': 'Curve', 'percentage': 30, 'apy': 6.3, 'risk_score': 4},
                        {'protocol': 'Aave', 'percentage': 20, 'apy': 4.5, 'risk_score': 3}
                    ],
                    'total_value': 25000,
                    'risk_tolerance': 7
                }
            ]
            
            # Get actual yield data for context
            current_yields = await self.db_manager.get_yield_opportunities(
                min_apy=1.0, min_tvl=100000, limit=100
            )
            
            training_data = {
                'sample_portfolios': sample_portfolios,
                'current_yields': current_yields,
                'market_conditions': await self.db_manager.get_latest_market_data(),
                'optimization_targets': ['max_return', 'min_risk', 'balanced'],
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info("Prepared portfolio optimization training data")
            return training_data
            
        except Exception as e:
            self.logger.error(f"Error preparing portfolio data: {e}")
            return {}

    async def _prepare_market_data(self, days: int) -> Dict[str, Any]:
        """Prepare market analysis training data."""
        try:
            # Get historical market data
            market_history = []
            
            # Get price data for major assets
            major_assets = ['BTC', 'ETH', 'USDC']
            price_histories = {}
            
            for asset in major_assets:
                price_history = await self.db_manager.get_price_history(asset, days)
                if not price_history.empty:
                    price_histories[asset] = price_history.to_dict('records')
            
            # Get DeFi metrics
            defi_metrics = {
                'total_tvl': 60000000000,  # Example current TVL
                'protocol_count': 200,
                'chain_distribution': {
                    'ethereum': 65,
                    'polygon': 12,
                    'arbitrum': 8,
                    'optimism': 6,
                    'others': 9
                }
            }
            
            training_data = {
                'price_histories': price_histories,
                'defi_metrics': defi_metrics,
                'market_indicators': await self._get_market_indicators(),
                'sentiment_factors': await self._get_sentiment_factors(),
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info("Prepared market analysis training data")
            return training_data
            
        except Exception as e:
            self.logger.error(f"Error preparing market data: {e}")
            return {}

    async def validate_model_performance(self, model_type: str, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate model performance using test data."""
        try:
            if model_type == 'yield_prediction':
                return await self._validate_yield_predictions(test_data)
            elif model_type == 'risk_assessment':
                return await self._validate_risk_assessments(test_data)
            elif model_type == 'portfolio_optimization':
                return await self._validate_portfolio_optimizations(test_data)
            elif model_type == 'market_analysis':
                return await self._validate_market_analysis(test_data)
            else:
                raise ValueError(f"Unknown model type: {model_type}")
                
        except Exception as e:
            self.logger.error(f"Error validating {model_type} model: {e}")
            return {'error': str(e)}

    async def _validate_yield_predictions(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate yield prediction accuracy."""
        try:
            predictions = []
            actual_results = []
            
            for protocol_data in test_data.get('protocols', []):
                # Make prediction
                prediction = self.yield_predictor.predict_yield(protocol_data)
                
                # Compare with actual (simulated for validation)
                actual_apy = protocol_data.get('actual_apy', protocol_data.get('apy', 0))
                
                predictions.append(prediction.predicted_apy)
                actual_results.append(actual_apy)
            
            # Calculate metrics
            if predictions and actual_results:
                mae = np.mean(np.abs(np.array(predictions) - np.array(actual_results)))
                rmse = np.sqrt(np.mean((np.array(predictions) - np.array(actual_results))**2))
                
                validation_results = {
                    'model_type': 'yield_prediction',
                    'mean_absolute_error': float(mae),
                    'root_mean_square_error': float(rmse),
                    'predictions_count': len(predictions),
                    'average_confidence': float(np.mean([p for p in predictions if p > 0])) if predictions else 0,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                validation_results = {
                    'model_type': 'yield_prediction',
                    'error': 'No valid predictions generated',
                    'timestamp': datetime.now().isoformat()
                }
            
            self.logger.info(f"Yield prediction validation completed: MAE={mae:.3f}, RMSE={rmse:.3f}")
            return validation_results
            
        except Exception as e:
            self.logger.error(f"Error validating yield predictions: {e}")
            return {'error': str(e)}

    async def _validate_risk_assessments(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate risk assessment accuracy."""
        try:
            assessments = []
            
            for portfolio_data in test_data.get('portfolios', []):
                # Make risk assessment
                assessment = self.risk_assessor.assess_portfolio_risk(portfolio_data)
                assessments.append({
                    'risk_score': assessment.overall_risk_score,
                    'confidence': assessment.confidence,
                    'risk_level': assessment.risk_level.value
                })
            
            validation_results = {
                'model_type': 'risk_assessment',
                'assessments_count': len(assessments),
                'average_risk_score': float(np.mean([a['risk_score'] for a in assessments])) if assessments else 0,
                'average_confidence': float(np.mean([a['confidence'] for a in assessments])) if assessments else 0,
                'risk_distribution': self._calculate_risk_distribution(assessments),
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Risk assessment validation completed: {len(assessments)} assessments")
            return validation_results
            
        except Exception as e:
            self.logger.error(f"Error validating risk assessments: {e}")
            return {'error': str(e)}

    async def _validate_portfolio_optimizations(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate portfolio optimization performance."""
        try:
            optimizations = []
            
            for portfolio_data in test_data.get('portfolios', []):
                preferences = test_data.get('preferences', {})
                
                # Perform optimization
                optimization = self.portfolio_optimizer.optimize_portfolio(portfolio_data, preferences)
                
                optimizations.append({
                    'expected_return': optimization.expected_return,
                    'risk_score': optimization.risk_score,
                    'sharpe_ratio': optimization.sharpe_ratio,
                    'confidence': optimization.confidence,
                    'allocations_count': len(optimization.allocations)
                })
            
            validation_results = {
                'model_type': 'portfolio_optimization',
                'optimizations_count': len(optimizations),
                'average_expected_return': float(np.mean([o['expected_return'] for o in optimizations])) if optimizations else 0,
                'average_sharpe_ratio': float(np.mean([o['sharpe_ratio'] for o in optimizations])) if optimizations else 0,
                'average_confidence': float(np.mean([o['confidence'] for o in optimizations])) if optimizations else 0,
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Portfolio optimization validation completed: {len(optimizations)} optimizations")
            return validation_results
            
        except Exception as e:
            self.logger.error(f"Error validating portfolio optimizations: {e}")
            return {'error': str(e)}

    async def _validate_market_analysis(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate market analysis accuracy."""
        try:
            analyses = []
            
            market_data_samples = test_data.get('market_samples', [test_data.get('market_data', {})])
            
            for market_data in market_data_samples:
                if market_data:
                    # Perform market analysis
                    analysis = self.market_analyzer.analyze_market_conditions(market_data)
                    
                    analyses.append({
                        'sentiment': analysis.overall_sentiment.value,
                        'market_score': analysis.market_score,
                        'confidence': analysis.confidence,
                        'trends_count': len(analysis.key_trends),
                        'risks_count': len(analysis.risk_factors),
                        'opportunities_count': len(analysis.opportunities)
                    })
            
            validation_results = {
                'model_type': 'market_analysis',
                'analyses_count': len(analyses),
                'average_market_score': float(np.mean([a['market_score'] for a in analyses])) if analyses else 0,
                'average_confidence': float(np.mean([a['confidence'] for a in analyses])) if analyses else 0,
                'sentiment_distribution': self._calculate_sentiment_distribution(analyses),
                'timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Market analysis validation completed: {len(analyses)} analyses")
            return validation_results
            
        except Exception as e:
            self.logger.error(f"Error validating market analysis: {e}")
            return {'error': str(e)}

    async def run_comprehensive_validation(self) -> Dict[str, Any]:
        """Run comprehensive validation across all models."""
        try:
            self.logger.info("Starting comprehensive model validation")
            
            # Prepare test data for all models
            test_data = {
                'yield_prediction': await self.prepare_training_data('yield_prediction', 30),
                'risk_assessment': await self.prepare_training_data('risk_assessment', 30),
                'portfolio_optimization': await self.prepare_training_data('portfolio_optimization', 30),
                'market_analysis': await self.prepare_training_data('market_analysis', 30)
            }
            
            # Validate each model
            validation_results = {}
            for model_type, data in test_data.items():
                validation_results[model_type] = await self.validate_model_performance(model_type, data)
            
            # Calculate overall metrics
            overall_results = {
                'validation_timestamp': datetime.now().isoformat(),
                'models_validated': len(validation_results),
                'individual_results': validation_results,
                'overall_health': self._calculate_overall_health(validation_results)
            }
            
            # Store validation results
            if self.db_manager:
                await self.db_manager.store_ai_prediction(
                    'validation_results',
                    {'validation_type': 'comprehensive'},
                    overall_results,
                    1.0
                )
            
            self.logger.info("Comprehensive validation completed successfully")
            return overall_results
            
        except Exception as e:
            self.logger.error(f"Error in comprehensive validation: {e}")
            return {'error': str(e)}

    def _calculate_risk_distribution(self, assessments: List[Dict[str, Any]]) -> Dict[str, int]:
        """Calculate risk level distribution."""
        distribution = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
        
        for assessment in assessments:
            risk_level = assessment.get('risk_level', 'medium')
            if risk_level in distribution:
                distribution[risk_level] += 1
        
        return distribution

    def _calculate_sentiment_distribution(self, analyses: List[Dict[str, Any]]) -> Dict[str, int]:
        """Calculate sentiment distribution."""
        distribution = {'bullish': 0, 'bearish': 0, 'neutral': 0, 'volatile': 0}
        
        for analysis in analyses:
            sentiment = analysis.get('sentiment', 'neutral')
            if sentiment in distribution:
                distribution[sentiment] += 1
        
        return distribution

    def _calculate_overall_health(self, validation_results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall model health score."""
        health_scores = []
        
        for model_type, results in validation_results.items():
            if 'error' not in results:
                confidence = results.get('average_confidence', 0)
                health_scores.append(confidence)
        
        overall_health = {
            'score': float(np.mean(health_scores)) if health_scores else 0,
            'models_healthy': len(health_scores),
            'models_total': len(validation_results),
            'health_status': 'healthy' if len(health_scores) == len(validation_results) else 'degraded'
        }
        
        return overall_health

    async def _calculate_volatility_metrics(self) -> Dict[str, float]:
        """Calculate market volatility metrics."""
        try:
            # Get recent price data for major assets
            assets = ['BTC', 'ETH']
            volatility_data = {}
            
            for asset in assets:
                price_history = await self.db_manager.get_price_history(asset, 30)
                if not price_history.empty:
                    prices = price_history['price'].values
                    returns = np.diff(np.log(prices))
                    volatility = np.std(returns) * np.sqrt(365) * 100  # Annualized volatility
                    volatility_data[f"{asset}_volatility"] = float(volatility)
            
            return volatility_data
            
        except Exception as e:
            self.logger.error(f"Error calculating volatility metrics: {e}")
            return {}

    async def _get_market_indicators(self) -> Dict[str, Any]:
        """Get current market indicators."""
        return {
            'fear_greed_index': 65,
            'bitcoin_dominance': 45.2,
            'ethereum_dominance': 18.5,
            'defi_dominance': 8.3,
            'market_trend': 'bullish',
            'volatility_regime': 'medium'
        }

    async def _get_sentiment_factors(self) -> Dict[str, Any]:
        """Get sentiment analysis factors."""
        return {
            'social_sentiment': 0.65,
            'institutional_flow': 'positive',
            'regulatory_sentiment': 'neutral',
            'developer_activity': 'high',
            'on_chain_metrics': 'bullish'
        }

    async def cleanup(self):
        """Cleanup resources."""
        try:
            if self.db_manager:
                await self.db_manager.close()
            if self.cache_manager:
                await self.cache_manager.close()
            self.logger.info("Training environment cleanup completed")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

async def main():
    """Main training function."""
    trainer = ModelTrainer()
    
    try:
        await trainer.initialize()
        
        # Run comprehensive validation
        results = await trainer.run_comprehensive_validation()
        
        print("Validation Results:")
        print(json.dumps(results, indent=2, default=str))
        
    except Exception as e:
        print(f"Training failed: {e}")
    finally:
        await trainer.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
