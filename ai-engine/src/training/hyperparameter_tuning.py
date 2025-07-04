import asyncio
import logging
import json
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import itertools
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from models.yield_predictor import YieldPredictor
from models.risk_assessor import RiskAssessor
from models.portfolio_optimizer import PortfolioOptimizer
from models.market_analyzer import MarketAnalyzer
from utils.config import Config
from utils.logger import setup_logger
from training.evaluate import ModelEvaluator

class HyperparameterTuner:
    def __init__(self):
        self.config = Config()
        self.logger = setup_logger('hyperparameter_tuner')
        self.evaluator = ModelEvaluator()
        
        # Hyperparameter spaces for Gemini API configuration
        self.hyperparameter_spaces = {
            'yield_prediction': {
                'temperature': [0.1, 0.3, 0.5, 0.7],
                'max_output_tokens': [512, 1024, 2048],
                'top_p': [0.8, 0.9, 0.95],
                'top_k': [20, 32, 40]
            },
            'risk_assessment': {
                'temperature': [0.1, 0.2, 0.3],
                'max_output_tokens': [1024, 1536, 2048],
                'top_p': [0.8, 0.9],
                'top_k': [32, 40]
            },
            'portfolio_optimization': {
                'temperature': [0.2, 0.4, 0.6],
                'max_output_tokens': [1536, 2048, 3072],
                'top_p': [0.8, 0.9, 0.95],
                'top_k': [32, 40, 48]
            },
            'market_analysis': {
                'temperature': [0.2, 0.3, 0.4],
                'max_output_tokens': [1024, 1536, 2048],
                'top_p': [0.8, 0.9],
                'top_k': [32, 40]
            }
        }

    async def initialize(self):
        """Initialize tuner."""
        try:
            await self.evaluator.initialize()
            self.logger.info("Hyperparameter tuner initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize tuner: {e}")
            raise

    async def tune_yield_prediction_hyperparameters(self) -> Dict[str, Any]:
        """Tune hyperparameters for yield prediction model."""
        try:
            self.logger.info("Starting yield prediction hyperparameter tuning")
            
            best_config = None
            best_score = -float('inf')
            all_results = []
            
            # Get parameter combinations
            param_space = self.hyperparameter_spaces['yield_prediction']
            param_combinations = list(itertools.product(
                param_space['temperature'],
                param_space['max_output_tokens'],
                param_space['top_p'],
                param_space['top_k']
            ))
            
            # Test each combination
            for i, (temperature, max_tokens, top_p, top_k) in enumerate(param_combinations):
                self.logger.info(f"Testing configuration {i+1}/{len(param_combinations)}")
                
                # Create configuration
                config = {
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                    'top_p': top_p,
                    'top_k': top_k
                }
                
                # Evaluate configuration
                score, metrics = await self._evaluate_yield_prediction_config(config)
                
                result = {
                    'configuration': config,
                    'score': score,
                    'metrics': metrics
                }
                all_results.append(result)
                
                # Track best configuration
                if score > best_score:
                    best_score = score
                    best_config = config
                
                self.logger.info(f"Configuration score: {score:.4f}")
            
            tuning_results = {
                'model': 'yield_prediction',
                'best_configuration': best_config,
                'best_score': best_score,
                'total_configurations_tested': len(param_combinations),
                'all_results': all_results,
                'tuning_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Yield prediction tuning completed. Best score: {best_score:.4f}")
            return tuning_results
            
        except Exception as e:
            self.logger.error(f"Error tuning yield prediction hyperparameters: {e}")
            return {'error': str(e)}

    async def tune_risk_assessment_hyperparameters(self) -> Dict[str, Any]:
        """Tune hyperparameters for risk assessment model."""
        try:
            self.logger.info("Starting risk assessment hyperparameter tuning")
            
            best_config = None
            best_score = -float('inf')
            all_results = []
            
            # Get parameter combinations
            param_space = self.hyperparameter_spaces['risk_assessment']
            param_combinations = list(itertools.product(
                param_space['temperature'],
                param_space['max_output_tokens'],
                param_space['top_p'],
                param_space['top_k']
            ))
            
            # Test each combination
            for i, (temperature, max_tokens, top_p, top_k) in enumerate(param_combinations):
                self.logger.info(f"Testing configuration {i+1}/{len(param_combinations)}")
                
                config = {
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                    'top_p': top_p,
                    'top_k': top_k
                }
                
                # Evaluate configuration
                score, metrics = await self._evaluate_risk_assessment_config(config)
                
                result = {
                    'configuration': config,
                    'score': score,
                    'metrics': metrics
                }
                all_results.append(result)
                
                if score > best_score:
                    best_score = score
                    best_config = config
                
                self.logger.info(f"Configuration score: {score:.4f}")
            
            tuning_results = {
                'model': 'risk_assessment',
                'best_configuration': best_config,
                'best_score': best_score,
                'total_configurations_tested': len(param_combinations),
                'all_results': all_results,
                'tuning_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Risk assessment tuning completed. Best score: {best_score:.4f}")
            return tuning_results
            
        except Exception as e:
            self.logger.error(f"Error tuning risk assessment hyperparameters: {e}")
            return {'error': str(e)}

    async def tune_portfolio_optimization_hyperparameters(self) -> Dict[str, Any]:
        """Tune hyperparameters for portfolio optimization model."""
        try:
            self.logger.info("Starting portfolio optimization hyperparameter tuning")
            
            best_config = None
            best_score = -float('inf')
            all_results = []
            
            # Get parameter combinations
            param_space = self.hyperparameter_spaces['portfolio_optimization']
            param_combinations = list(itertools.product(
                param_space['temperature'],
                param_space['max_output_tokens'],
                param_space['top_p'],
                param_space['top_k']
            ))
            
            # Limit combinations for efficiency (take every 2nd combination)
            param_combinations = param_combinations[::2]
            
            for i, (temperature, max_tokens, top_p, top_k) in enumerate(param_combinations):
                self.logger.info(f"Testing configuration {i+1}/{len(param_combinations)}")
                
                config = {
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                    'top_p': top_p,
                    'top_k': top_k
                }
                
                # Evaluate configuration
                score, metrics = await self._evaluate_portfolio_optimization_config(config)
                
                result = {
                    'configuration': config,
                    'score': score,
                    'metrics': metrics
                }
                all_results.append(result)
                
                if score > best_score:
                    best_score = score
                    best_config = config
                
                self.logger.info(f"Configuration score: {score:.4f}")
            
            tuning_results = {
                'model': 'portfolio_optimization',
                'best_configuration': best_config,
                'best_score': best_score,
                'total_configurations_tested': len(param_combinations),
                'all_results': all_results,
                'tuning_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Portfolio optimization tuning completed. Best score: {best_score:.4f}")
            return tuning_results
            
        except Exception as e:
            self.logger.error(f"Error tuning portfolio optimization hyperparameters: {e}")
            return {'error': str(e)}

    async def tune_market_analysis_hyperparameters(self) -> Dict[str, Any]:
        """Tune hyperparameters for market analysis model."""
        try:
            self.logger.info("Starting market analysis hyperparameter tuning")
            
            best_config = None
            best_score = -float('inf')
            all_results = []
            
            # Get parameter combinations
            param_space = self.hyperparameter_spaces['market_analysis']
            param_combinations = list(itertools.product(
                param_space['temperature'],
                param_space['max_output_tokens'],
                param_space['top_p'],
                param_space['top_k']
            ))
            
            for i, (temperature, max_tokens, top_p, top_k) in enumerate(param_combinations):
                self.logger.info(f"Testing configuration {i+1}/{len(param_combinations)}")
                
                config = {
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                    'top_p': top_p,
                    'top_k': top_k
                }
                
                # Evaluate configuration
                score, metrics = await self._evaluate_market_analysis_config(config)
                
                result = {
                    'configuration': config,
                    'score': score,
                    'metrics': metrics
                }
                all_results.append(result)
                
                if score > best_score:
                    best_score = score
                    best_config = config
                
                self.logger.info(f"Configuration score: {score:.4f}")
            
            tuning_results = {
                'model': 'market_analysis',
                'best_configuration': best_config,
                'best_score': best_score,
                'total_configurations_tested': len(param_combinations),
                'all_results': all_results,
                'tuning_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info(f"Market analysis tuning completed. Best score: {best_score:.4f}")
            return tuning_results
            
        except Exception as e:
            self.logger.error(f"Error tuning market analysis hyperparameters: {e}")
            return {'error': str(e)}

    async def _evaluate_yield_prediction_config(self, config: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """Evaluate a specific configuration for yield prediction."""
        try:
            # Create model with specific configuration
            yield_predictor = YieldPredictor()
            
            # Test with sample data
            test_protocols = [
                {
                    'name': 'Aave USDC',
                    'current_apy': 4.5,
                    'tvl': 1500000000,
                    'category': 'lending',
                    'chain': 'ethereum',
                    'risk_score': 3
                },
                {
                    'name': 'Uniswap V3 ETH/USDC',
                    'current_apy': 12.5,
                    'tvl': 800000000,
                    'category': 'dex',
                    'chain': 'ethereum',
                    'risk_score': 6
                }
            ]
            
            predictions = []
            confidences = []
            response_times = []
            
            for protocol in test_protocols:
                start_time = datetime.now()
                try:
                    prediction = yield_predictor.predict_yield(protocol, 7)
                    end_time = datetime.now()
                    
                    response_time = (end_time - start_time).total_seconds()
                    
                    predictions.append(prediction.predicted_apy)
                    confidences.append(prediction.confidence)
                    response_times.append(response_time)
                    
                except Exception as e:
                    self.logger.warning(f"Prediction failed for config: {e}")
                    return 0.0, {'error': str(e)}
            
            # Calculate score based on multiple factors
            avg_confidence = np.mean(confidences) if confidences else 0
            avg_response_time = np.mean(response_times) if response_times else 10
            prediction_variance = np.std(predictions) if len(predictions) > 1 else 0
            
            # Scoring: prioritize high confidence, low response time, reasonable variance
            confidence_score = avg_confidence
            speed_score = max(0, 1 - avg_response_time / 10)  # Penalize response times > 10s
            consistency_score = max(0, 1 - prediction_variance / 10)  # Penalize high variance
            
            overall_score = (confidence_score * 0.5 + speed_score * 0.3 + consistency_score * 0.2)
            
            metrics = {
                'average_confidence': float(avg_confidence),
                'average_response_time': float(avg_response_time),
                'prediction_variance': float(prediction_variance),
                'predictions_count': len(predictions)
            }
            
            return float(overall_score), metrics
            
        except Exception as e:
            return 0.0, {'error': str(e)}

    async def _evaluate_risk_assessment_config(self, config: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """Evaluate a specific configuration for risk assessment."""
        try:
            risk_assessor = RiskAssessor()
            
            # Test with sample portfolios
            test_portfolios = [
                {
                    'allocations': [
                        {'protocol': 'Aave USDC', 'percentage': 100, 'apy': 4.5, 'risk_score': 3}
                    ],
                    'total_value': 10000
                },
                {
                    'allocations': [
                        {'protocol': 'Uniswap V3', 'percentage': 50, 'apy': 15.0, 'risk_score': 8},
                        {'protocol': 'Aave USDC', 'percentage': 50, 'apy': 4.5, 'risk_score': 3}
                    ],
                    'total_value': 25000
                }
            ]
            
            assessments = []
            confidences = []
            response_times = []
            
            for portfolio in test_portfolios:
                start_time = datetime.now()
                try:
                    assessment = risk_assessor.assess_portfolio_risk(portfolio)
                    end_time = datetime.now()
                    
                    response_time = (end_time - start_time).total_seconds()
                    
                    assessments.append(assessment.overall_risk_score)
                    confidences.append(assessment.confidence)
                    response_times.append(response_time)
                    
                except Exception as e:
                    self.logger.warning(f"Risk assessment failed for config: {e}")
                    return 0.0, {'error': str(e)}
            
            # Calculate score
            avg_confidence = np.mean(confidences) if confidences else 0
            avg_response_time = np.mean(response_times) if response_times else 10
            assessment_consistency = 1 - (np.std(assessments) / 10) if len(assessments) > 1 else 1
            
            confidence_score = avg_confidence
            speed_score = max(0, 1 - avg_response_time / 10)
            consistency_score = max(0, assessment_consistency)
            
            overall_score = (confidence_score * 0.4 + speed_score * 0.3 + consistency_score * 0.3)
            
            metrics = {
                'average_confidence': float(avg_confidence),
                'average_response_time': float(avg_response_time),
                'assessment_consistency': float(assessment_consistency),
                'assessments_count': len(assessments)
            }
            
            return float(overall_score), metrics
            
        except Exception as e:
            return 0.0, {'error': str(e)}

    async def _evaluate_portfolio_optimization_config(self, config: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """Evaluate a specific configuration for portfolio optimization."""
        try:
            portfolio_optimizer = PortfolioOptimizer()
            
            # Test with sample portfolio data
            test_data = {
                'total_value': 10000,
                'current_allocations': [],
                'available_protocols': [
                    {'name': 'Aave USDC', 'apy': 4.5, 'risk_score': 3, 'tvl': 1500000000},
                    {'name': 'Compound DAI', 'apy': 3.8, 'risk_score': 2, 'tvl': 800000000},
                    {'name': 'Yearn USDC', 'apy': 7.2, 'risk_score': 5, 'tvl': 500000000}
                ]
            }
            
            preferences = {'risk_tolerance': 5, 'optimization_target': 'balanced'}
            
            start_time = datetime.now()
            try:
                optimization = portfolio_optimizer.optimize_portfolio(test_data, preferences)
                end_time = datetime.now()
                
                response_time = (end_time - start_time).total_seconds()
                
                # Score based on optimization quality
                sharpe_ratio = optimization.sharpe_ratio
                confidence = optimization.confidence
                allocations_count = len(optimization.allocations)
                
                # Quality score
                quality_score = min(sharpe_ratio / 2, 1.0) if sharpe_ratio > 0 else 0
                confidence_score = confidence
                speed_score = max(0, 1 - response_time / 15)  # Allow up to 15s
                diversity_score = min(allocations_count / 5, 1.0)  # Prefer 3-5 allocations
                
                overall_score = (quality_score * 0.4 + confidence_score * 0.3 + 
                               speed_score * 0.2 + diversity_score * 0.1)
                
                metrics = {
                    'sharpe_ratio': float(sharpe_ratio),
                    'confidence': float(confidence),
                    'response_time': float(response_time),
                    'allocations_count': allocations_count,
                    'expected_return': float(optimization.expected_return)
                }
                
                return float(overall_score), metrics
                
            except Exception as e:
                self.logger.warning(f"Portfolio optimization failed for config: {e}")
                return 0.0, {'error': str(e)}
                
        except Exception as e:
            return 0.0, {'error': str(e)}

    async def _evaluate_market_analysis_config(self, config: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
        """Evaluate a specific configuration for market analysis."""
        try:
            market_analyzer = MarketAnalyzer()
            
            # Test with sample market data
            test_market_data = {
                'total_market_cap': 2500000000000,
                'total_volume_24h': 50000000000,
                'btc_dominance': 45.2,
                'eth_dominance': 18.5,
                'defi_market_cap': 60000000000,
                'fear_greed_index': 65
            }
            
            start_time = datetime.now()
            try:
                analysis = market_analyzer.analyze_market_conditions(test_market_data)
                end_time = datetime.now()
                
                response_time = (end_time - start_time).total_seconds()
                
                # Score based on analysis quality
                confidence = analysis.confidence
                trends_count = len(analysis.key_trends)
                opportunities_count = len(analysis.opportunities)
                
                confidence_score = confidence
                speed_score = max(0, 1 - response_time / 10)
                completeness_score = min((trends_count + opportunities_count) / 10, 1.0)
                
                overall_score = (confidence_score * 0.5 + speed_score * 0.3 + completeness_score * 0.2)
                
                metrics = {
                    'confidence': float(confidence),
                    'response_time': float(response_time),
                    'trends_count': trends_count,
                    'opportunities_count': opportunities_count,
                    'market_score': float(analysis.market_score)
                }
                
                return float(overall_score), metrics
                
            except Exception as e:
                self.logger.warning(f"Market analysis failed for config: {e}")
                return 0.0, {'error': str(e)}
                
        except Exception as e:
            return 0.0, {'error': str(e)}

    async def run_comprehensive_tuning(self) -> Dict[str, Any]:
        """Run comprehensive hyperparameter tuning across all models."""
        try:
            self.logger.info("Starting comprehensive hyperparameter tuning")
            
            tuning_results = {
                'yield_prediction': await self.tune_yield_prediction_hyperparameters(),
                'risk_assessment': await self.tune_risk_assessment_hyperparameters(),
                'portfolio_optimization': await self.tune_portfolio_optimization_hyperparameters(),
                'market_analysis': await self.tune_market_analysis_hyperparameters()
            }
            
            # Generate summary
            summary = {
                'tuning_timestamp': datetime.now().isoformat(),
                'models_tuned': len(tuning_results),
                'total_configurations_tested': sum(
                    result.get('total_configurations_tested', 0) 
                    for result in tuning_results.values() 
                    if 'error' not in result
                ),
                'best_configurations': {
                    model: result.get('best_configuration')
                    for model, result in tuning_results.items()
                    if 'error' not in result
                },
                'best_scores': {
                    model: result.get('best_score')
                    for model, result in tuning_results.items()
                    if 'error' not in result
                },
                'detailed_results': tuning_results
            }
            
            self.logger.info("Comprehensive hyperparameter tuning completed")
            return summary
            
        except Exception as e:
            self.logger.error(f"Error in comprehensive tuning: {e}")
            return {'error': str(e)}

    async def cleanup(self):
        """Cleanup resources."""
        try:
            await self.evaluator.cleanup()
            self.logger.info("Hyperparameter tuner cleanup completed")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

async def main():
    """Main tuning function."""
    tuner = HyperparameterTuner()
    
    try:
        await tuner.initialize()
        
        # Run comprehensive tuning
        results = await tuner.run_comprehensive_tuning()
        
        print("Hyperparameter Tuning Results:")
        print(json.dumps(results, indent=2, default=str))
        
    except Exception as e:
        print(f"Hyperparameter tuning failed: {e}")
    finally:
        await tuner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
