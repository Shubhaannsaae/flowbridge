import asyncio
import logging
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from models.yield_predictor import YieldPredictor
from models.risk_assessor import RiskAssessor
from models.portfolio_optimizer import PortfolioOptimizer
from models.market_analyzer import MarketAnalyzer
from data.storage.database import DatabaseManager
from utils.config import Config
from utils.logger import setup_logger

class ModelEvaluator:
    def __init__(self):
        self.config = Config()
        self.logger = setup_logger('model_evaluator')
        self.db_manager = None
        
        # Initialize models
        self.yield_predictor = YieldPredictor()
        self.risk_assessor = RiskAssessor()
        self.portfolio_optimizer = PortfolioOptimizer()
        self.market_analyzer = MarketAnalyzer()

    async def initialize(self):
        """Initialize database connection."""
        try:
            db_connection_string = self.config.get('DATABASE_URL')
            if db_connection_string:
                self.db_manager = DatabaseManager(db_connection_string)
                await self.db_manager.initialize()
                self.logger.info("Database initialized for evaluation")
        except Exception as e:
            self.logger.error(f"Failed to initialize evaluator: {e}")
            raise

    async def evaluate_yield_prediction_accuracy(self, days: int = 30) -> Dict[str, Any]:
        """Evaluate yield prediction accuracy over time."""
        try:
            self.logger.info(f"Evaluating yield prediction accuracy over {days} days")
            
            # Get historical yield data
            yield_data = await self.db_manager.get_yield_opportunities(
                min_apy=0.5, min_tvl=50000, limit=100
            )
            
            predictions = []
            actual_values = []
            confidence_scores = []
            
            for opportunity in yield_data:
                try:
                    # Create protocol data for prediction
                    protocol_data = {
                        'name': opportunity['protocol'],
                        'current_apy': opportunity['apy'],
                        'tvl': opportunity['tvl'],
                        'category': opportunity.get('category', 'unknown'),
                        'chain': opportunity['chain'],
                        'risk_score': opportunity.get('risk_score', 5)
                    }
                    
                    # Make prediction
                    prediction = self.yield_predictor.predict_yield(protocol_data, 7)
                    
                    predictions.append(prediction.predicted_apy)
                    actual_values.append(opportunity['apy'])  # Using current as baseline
                    confidence_scores.append(prediction.confidence)
                    
                except Exception as e:
                    self.logger.warning(f"Error predicting yield for {opportunity['protocol']}: {e}")
                    continue
            
            # Calculate evaluation metrics
            if predictions and actual_values:
                predictions_array = np.array(predictions)
                actual_array = np.array(actual_values)
                
                mae = np.mean(np.abs(predictions_array - actual_array))
                rmse = np.sqrt(np.mean((predictions_array - actual_array)**2))
                mape = np.mean(np.abs((predictions_array - actual_array) / actual_array)) * 100
                correlation = np.corrcoef(predictions_array, actual_array)[0, 1]
                
                # Calculate accuracy by confidence bins
                confidence_analysis = self._analyze_by_confidence(
                    predictions, actual_values, confidence_scores
                )
                
                evaluation_results = {
                    'model': 'yield_prediction',
                    'evaluation_period_days': days,
                    'sample_size': len(predictions),
                    'metrics': {
                        'mean_absolute_error': float(mae),
                        'root_mean_square_error': float(rmse),
                        'mean_absolute_percentage_error': float(mape),
                        'correlation_coefficient': float(correlation),
                        'average_confidence': float(np.mean(confidence_scores))
                    },
                    'confidence_analysis': confidence_analysis,
                    'evaluation_timestamp': datetime.now().isoformat()
                }
                
                self.logger.info(f"Yield prediction evaluation completed: MAE={mae:.3f}, RMSE={rmse:.3f}")
                return evaluation_results
            else:
                return {'error': 'No valid predictions generated for evaluation'}
                
        except Exception as e:
            self.logger.error(f"Error evaluating yield prediction: {e}")
            return {'error': str(e)}

    async def evaluate_risk_assessment_consistency(self) -> Dict[str, Any]:
        """Evaluate risk assessment model consistency."""
        try:
            self.logger.info("Evaluating risk assessment consistency")
            
            # Create test portfolios with known risk characteristics
            test_portfolios = [
                # Conservative portfolio
                {
                    'allocations': [
                        {'protocol': 'Aave USDC', 'percentage': 60, 'apy': 3.5, 'risk_score': 2},
                        {'protocol': 'Compound DAI', 'percentage': 40, 'apy': 3.2, 'risk_score': 2}
                    ],
                    'total_value': 10000,
                    'expected_risk_level': 'low'
                },
                # Moderate portfolio
                {
                    'allocations': [
                        {'protocol': 'Aave ETH', 'percentage': 40, 'apy': 5.5, 'risk_score': 4},
                        {'protocol': 'Yearn USDC', 'percentage': 35, 'apy': 7.2, 'risk_score': 5},
                        {'protocol': 'Compound USDC', 'percentage': 25, 'apy': 3.8, 'risk_score': 2}
                    ],
                    'total_value': 25000,
                    'expected_risk_level': 'medium'
                },
                # Aggressive portfolio
                {
                    'allocations': [
                        {'protocol': 'Uniswap V3 ETH/USDC', 'percentage': 50, 'apy': 15.5, 'risk_score': 8},
                        {'protocol': 'Curve 3Pool', 'percentage': 30, 'apy': 8.2, 'risk_score': 6},
                        {'protocol': 'Convex CRV', 'percentage': 20, 'apy': 12.8, 'risk_score': 7}
                    ],
                    'total_value': 50000,
                    'expected_risk_level': 'high'
                }
            ]
            
            assessments = []
            consistency_checks = []
            
            for i, portfolio in enumerate(test_portfolios):
                # Assess risk multiple times to check consistency
                portfolio_assessments = []
                
                for _ in range(3):  # Run 3 times to check consistency
                    assessment = self.risk_assessor.assess_portfolio_risk(portfolio)
                    portfolio_assessments.append({
                        'risk_score': assessment.overall_risk_score,
                        'risk_level': assessment.risk_level.value,
                        'confidence': assessment.confidence
                    })
                
                # Check consistency across runs
                risk_scores = [a['risk_score'] for a in portfolio_assessments]
                risk_levels = [a['risk_level'] for a in portfolio_assessments]
                
                consistency_checks.append({
                    'portfolio_id': i,
                    'expected_risk_level': portfolio['expected_risk_level'],
                    'risk_score_std': float(np.std(risk_scores)),
                    'risk_level_consistency': len(set(risk_levels)) == 1,
                    'average_risk_score': float(np.mean(risk_scores)),
                    'predicted_risk_level': portfolio_assessments[0]['risk_level']
                })
                
                assessments.extend(portfolio_assessments)
            
            # Calculate overall consistency metrics
            evaluation_results = {
                'model': 'risk_assessment',
                'sample_size': len(test_portfolios),
                'runs_per_sample': 3,
                'consistency_metrics': {
                    'average_score_std': float(np.mean([c['risk_score_std'] for c in consistency_checks])),
                    'level_consistency_rate': sum(c['risk_level_consistency'] for c in consistency_checks) / len(consistency_checks),
                    'average_confidence': float(np.mean([a['confidence'] for a in assessments]))
                },
                'portfolio_results': consistency_checks,
                'evaluation_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info("Risk assessment consistency evaluation completed")
            return evaluation_results
            
        except Exception as e:
            self.logger.error(f"Error evaluating risk assessment: {e}")
            return {'error': str(e)}

    async def evaluate_portfolio_optimization_efficiency(self) -> Dict[str, Any]:
        """Evaluate portfolio optimization efficiency."""
        try:
            self.logger.info("Evaluating portfolio optimization efficiency")
            
            # Get current yield opportunities
            current_opportunities = await self.db_manager.get_yield_opportunities(
                min_apy=2.0, min_tvl=100000, limit=20
            )
            
            if not current_opportunities:
                return {'error': 'No yield opportunities available for evaluation'}
            
            # Test different optimization scenarios
            test_scenarios = [
                {'risk_tolerance': 3, 'target': 'conservative'},
                {'risk_tolerance': 5, 'target': 'balanced'},
                {'risk_tolerance': 8, 'target': 'aggressive'}
            ]
            
            optimization_results = []
            
            for scenario in test_scenarios:
                portfolio_data = {
                    'total_value': 10000,
                    'current_allocations': [],  # Start with empty portfolio
                    'available_protocols': current_opportunities[:10]  # Use top 10
                }
                
                preferences = {
                    'risk_tolerance': scenario['risk_tolerance'],
                    'optimization_target': scenario['target'],
                    'max_allocations': 5
                }
                
                # Perform optimization
                optimization = self.portfolio_optimizer.optimize_portfolio(portfolio_data, preferences)
                
                # Calculate efficiency metrics
                efficiency_metrics = self._calculate_optimization_efficiency(
                    optimization, scenario['risk_tolerance']
                )
                
                optimization_results.append({
                    'scenario': scenario,
                    'optimization': {
                        'expected_return': optimization.expected_return,
                        'risk_score': optimization.risk_score,
                        'sharpe_ratio': optimization.sharpe_ratio,
                        'allocations_count': len(optimization.allocations),
                        'confidence': optimization.confidence
                    },
                    'efficiency_metrics': efficiency_metrics
                })
            
            # Calculate overall efficiency
            evaluation_results = {
                'model': 'portfolio_optimization',
                'scenarios_tested': len(test_scenarios),
                'optimization_results': optimization_results,
                'overall_metrics': {
                    'average_sharpe_ratio': float(np.mean([r['optimization']['sharpe_ratio'] for r in optimization_results])),
                    'average_confidence': float(np.mean([r['optimization']['confidence'] for r in optimization_results])),
                    'risk_alignment_score': float(np.mean([r['efficiency_metrics']['risk_alignment'] for r in optimization_results]))
                },
                'evaluation_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info("Portfolio optimization efficiency evaluation completed")
            return evaluation_results
            
        except Exception as e:
            self.logger.error(f"Error evaluating portfolio optimization: {e}")
            return {'error': str(e)}

    async def evaluate_market_analysis_timeliness(self) -> Dict[str, Any]:
        """Evaluate market analysis timeliness and relevance."""
        try:
            self.logger.info("Evaluating market analysis timeliness")
            
            # Get recent market data
            market_data = await self.db_manager.get_latest_market_data()
            
            if not market_data:
                # Use sample market data
                market_data = {
                    'total_market_cap': 2500000000000,  # $2.5T
                    'total_volume_24h': 50000000000,    # $50B
                    'btc_dominance': 45.2,
                    'eth_dominance': 18.5,
                    'defi_market_cap': 60000000000,     # $60B
                    'fear_greed_index': 65
                }
            
            # Perform multiple analyses to check consistency
            analyses = []
            response_times = []
            
            for i in range(5):
                start_time = datetime.now()
                
                analysis = self.market_analyzer.analyze_market_conditions(market_data)
                
                end_time = datetime.now()
                response_time = (end_time - start_time).total_seconds()
                response_times.append(response_time)
                
                analyses.append({
                    'sentiment': analysis.overall_sentiment.value,
                    'market_score': analysis.market_score,
                    'confidence': analysis.confidence,
                    'trends_count': len(analysis.key_trends),
                    'response_time': response_time
                })
            
            # Calculate timeliness metrics
            evaluation_results = {
                'model': 'market_analysis',
                'analyses_count': len(analyses),
                'timeliness_metrics': {
                    'average_response_time': float(np.mean(response_times)),
                    'max_response_time': float(np.max(response_times)),
                    'response_time_std': float(np.std(response_times)),
                    'average_confidence': float(np.mean([a['confidence'] for a in analyses]))
                },
                'consistency_metrics': {
                    'sentiment_consistency': len(set(a['sentiment'] for a in analyses)) == 1,
                    'score_std': float(np.std([a['market_score'] for a in analyses])),
                    'trends_consistency': float(np.std([a['trends_count'] for a in analyses]))
                },
                'detailed_analyses': analyses,
                'evaluation_timestamp': datetime.now().isoformat()
            }
            
            self.logger.info("Market analysis timeliness evaluation completed")
            return evaluation_results
            
        except Exception as e:
            self.logger.error(f"Error evaluating market analysis: {e}")
            return {'error': str(e)}

    async def run_comprehensive_evaluation(self) -> Dict[str, Any]:
        """Run comprehensive evaluation across all models."""
        try:
            self.logger.info("Starting comprehensive model evaluation")
            
            # Run all evaluations
            evaluations = {
                'yield_prediction': await self.evaluate_yield_prediction_accuracy(),
                'risk_assessment': await self.evaluate_risk_assessment_consistency(),
                'portfolio_optimization': await self.evaluate_portfolio_optimization_efficiency(),
                'market_analysis': await self.evaluate_market_analysis_timeliness()
            }
            
            # Calculate overall system health
            overall_health = self._calculate_system_health(evaluations)
            
            comprehensive_results = {
                'evaluation_timestamp': datetime.now().isoformat(),
                'evaluation_type': 'comprehensive',
                'models_evaluated': len(evaluations),
                'individual_evaluations': evaluations,
                'system_health': overall_health,
                'recommendations': self._generate_recommendations(evaluations)
            }
            
            # Store evaluation results
            if self.db_manager:
                await self.db_manager.store_ai_prediction(
                    'model_evaluation',
                    {'evaluation_type': 'comprehensive'},
                    comprehensive_results,
                    overall_health['overall_score']
                )
            
            self.logger.info("Comprehensive evaluation completed successfully")
            return comprehensive_results
            
        except Exception as e:
            self.logger.error(f"Error in comprehensive evaluation: {e}")
            return {'error': str(e)}

    def _analyze_by_confidence(self, predictions: List[float], actual: List[float], 
                             confidence: List[float]) -> Dict[str, Any]:
        """Analyze prediction accuracy by confidence levels."""
        confidence_bins = {'high': [], 'medium': [], 'low': []}
        
        for pred, act, conf in zip(predictions, actual, confidence):
            error = abs(pred - act)
            if conf >= 0.8:
                confidence_bins['high'].append(error)
            elif conf >= 0.6:
                confidence_bins['medium'].append(error)
            else:
                confidence_bins['low'].append(error)
        
        analysis = {}
        for level, errors in confidence_bins.items():
            if errors:
                analysis[level] = {
                    'count': len(errors),
                    'average_error': float(np.mean(errors)),
                    'error_std': float(np.std(errors))
                }
            else:
                analysis[level] = {'count': 0, 'average_error': 0, 'error_std': 0}
        
        return analysis

    def _calculate_optimization_efficiency(self, optimization, target_risk: int) -> Dict[str, float]:
        """Calculate optimization efficiency metrics."""
        # Risk alignment (how close to target risk)
        risk_alignment = 1 - abs(optimization.risk_score - target_risk) / 10
        
        # Diversification score (based on number and distribution of allocations)
        diversification = min(len(optimization.allocations) / 5, 1.0)
        
        # Return efficiency (Sharpe ratio based)
        return_efficiency = min(optimization.sharpe_ratio / 2, 1.0) if optimization.sharpe_ratio > 0 else 0
        
        return {
            'risk_alignment': float(max(0, risk_alignment)),
            'diversification': float(diversification),
            'return_efficiency': float(max(0, return_efficiency)),
            'overall_efficiency': float((risk_alignment + diversification + return_efficiency) / 3)
        }

    def _calculate_system_health(self, evaluations: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall system health score."""
        health_scores = []
        model_status = {}
        
        for model_name, evaluation in evaluations.items():
            if 'error' not in evaluation:
                # Extract relevant health indicators
                if model_name == 'yield_prediction':
                    correlation = evaluation.get('metrics', {}).get('correlation_coefficient', 0)
                    health_scores.append(max(0, correlation))
                    model_status[model_name] = 'healthy' if correlation > 0.5 else 'degraded'
                
                elif model_name == 'risk_assessment':
                    consistency = evaluation.get('consistency_metrics', {}).get('level_consistency_rate', 0)
                    health_scores.append(consistency)
                    model_status[model_name] = 'healthy' if consistency > 0.8 else 'degraded'
                
                elif model_name == 'portfolio_optimization':
                    avg_sharpe = evaluation.get('overall_metrics', {}).get('average_sharpe_ratio', 0)
                    health_scores.append(min(avg_sharpe / 2, 1.0))
                    model_status[model_name] = 'healthy' if avg_sharpe > 0.5 else 'degraded'
                
                elif model_name == 'market_analysis':
                    avg_response = evaluation.get('timeliness_metrics', {}).get('average_response_time', 10)
                    health_scores.append(max(0, 1 - avg_response / 10))
                    model_status[model_name] = 'healthy' if avg_response < 5 else 'degraded'
            else:
                model_status[model_name] = 'error'
        
        overall_score = np.mean(health_scores) if health_scores else 0
        
        return {
            'overall_score': float(overall_score),
            'health_status': 'healthy' if overall_score > 0.7 else 'degraded' if overall_score > 0.3 else 'poor',
            'models_healthy': sum(1 for status in model_status.values() if status == 'healthy'),
            'models_total': len(model_status),
            'model_status': model_status
        }

    def _generate_recommendations(self, evaluations: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on evaluation results."""
        recommendations = []
        
        for model_name, evaluation in evaluations.items():
            if 'error' in evaluation:
                recommendations.append(f"Fix {model_name} model - currently returning errors")
            
            elif model_name == 'yield_prediction':
                mae = evaluation.get('metrics', {}).get('mean_absolute_error', 0)
                if mae > 2.0:
                    recommendations.append("Improve yield prediction accuracy - high mean absolute error")
            
            elif model_name == 'risk_assessment':
                consistency = evaluation.get('consistency_metrics', {}).get('level_consistency_rate', 0)
                if consistency < 0.8:
                    recommendations.append("Improve risk assessment consistency across multiple runs")
            
            elif model_name == 'portfolio_optimization':
                avg_sharpe = evaluation.get('overall_metrics', {}).get('average_sharpe_ratio', 0)
                if avg_sharpe < 0.5:
                    recommendations.append("Optimize portfolio allocation algorithm for better risk-adjusted returns")
            
            elif model_name == 'market_analysis':
                avg_response = evaluation.get('timeliness_metrics', {}).get('average_response_time', 0)
                if avg_response > 5:
                    recommendations.append("Improve market analysis response time for better user experience")
        
        if not recommendations:
            recommendations.append("All models performing within acceptable parameters")
        
        return recommendations

    async def cleanup(self):
        """Cleanup resources."""
        try:
            if self.db_manager:
                await self.db_manager.close()
            self.logger.info("Evaluator cleanup completed")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

async def main():
    """Main evaluation function."""
    evaluator = ModelEvaluator()
    
    try:
        await evaluator.initialize()
        
        # Run comprehensive evaluation
        results = await evaluator.run_comprehensive_evaluation()
        
        print("Evaluation Results:")
        print(json.dumps(results, indent=2, default=str))
        
    except Exception as e:
        print(f"Evaluation failed: {e}")
    finally:
        await evaluator.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
