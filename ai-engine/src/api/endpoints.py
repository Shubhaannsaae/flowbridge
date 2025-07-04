from flask import request, jsonify, Blueprint
import asyncio
from functools import wraps
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from models.yield_predictor import YieldPredictor
from models.risk_assessor import RiskAssessor
from models.portfolio_optimizer import PortfolioOptimizer
from models.market_analyzer import MarketAnalyzer
from data.collectors.defi_data import DeFiDataCollector
from data.collectors.price_feeds import PriceFeedCollector
from data.collectors.yield_scanner import YieldScanner
from data.processors.data_cleaner import DataCleaner
from data.processors.feature_extractor import FeatureExtractor
from data.processors.normalizer import DataNormalizer

def async_route(f):
    """Decorator to handle async routes in Flask."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(f(*args, **kwargs))
        finally:
            loop.close()
    return wrapper

def create_endpoints(app, db_manager, cache_manager, logger):
    """Create and register API endpoints."""
    
    # Initialize AI models
    yield_predictor = YieldPredictor()
    risk_assessor = RiskAssessor()
    portfolio_optimizer = PortfolioOptimizer()
    market_analyzer = MarketAnalyzer()
    
    # Initialize data processors
    data_cleaner = DataCleaner()
    feature_extractor = FeatureExtractor()
    data_normalizer = DataNormalizer()
    
    # Yield Prediction Endpoints
    @app.route('/api/v1/yield/predict', methods=['POST'])
    def predict_yield():
        """Predict yield for a protocol."""
        try:
            data = request.get_json()
            
            if not data or 'protocol_data' not in data:
                return jsonify({'error': 'Protocol data is required'}), 400
            
            protocol_data = data['protocol_data']
            timeframe_days = data.get('timeframe_days', 7)
            
            # Predict yield using AI
            prediction = yield_predictor.predict_yield(protocol_data, timeframe_days)
            
            return jsonify({
                'success': True,
                'prediction': {
                    'protocol': prediction.protocol,
                    'predicted_apy': prediction.predicted_apy,
                    'confidence': prediction.confidence,
                    'trend': prediction.trend,
                    'risk_score': prediction.risk_score,
                    'timeframe_days': prediction.timeframe_days
                }
            })
            
        except Exception as e:
            logger.error(f"Error in yield prediction: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/api/v1/yield/optimize', methods=['POST'])
    def optimize_yield():
        """Optimize yield allocation."""
        try:
            data = request.get_json()
            
            if not data or 'portfolio_data' not in data:
                return jsonify({'error': 'Portfolio data is required'}), 400
            
            portfolio_data = data['portfolio_data']
            preferences = data.get('preferences', {})
            
            # Optimize yield allocation
            optimization = yield_predictor.optimize_yield(portfolio_data, preferences)
            
            return jsonify({
                'success': True,
                'optimization': optimization
            })
            
        except Exception as e:
            logger.error(f"Error in yield optimization: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    # Risk Assessment Endpoints
    @app.route('/api/v1/risk/assess-portfolio', methods=['POST'])
    def assess_portfolio_risk():
        """Assess portfolio risk."""
        try:
            data = request.get_json()
            
            if not data or 'portfolio_data' not in data:
                return jsonify({'error': 'Portfolio data is required'}), 400
            
            portfolio_data = data['portfolio_data']
            
            # Assess risk using AI
            assessment = risk_assessor.assess_portfolio_risk(portfolio_data)
            
            return jsonify({
                'success': True,
                'assessment': {
                    'overall_risk_score': assessment.overall_risk_score,
                    'risk_level': assessment.risk_level.value,
                    'risk_factors': assessment.risk_factors,
                    'recommendations': assessment.recommendations,
                    'confidence': assessment.confidence
                }
            })
            
        except Exception as e:
            logger.error(f"Error in portfolio risk assessment: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/api/v1/risk/assess-protocol', methods=['POST'])
    def assess_protocol_risk():
        """Assess protocol-specific risk."""
        try:
            data = request.get_json()
            
            if not data or 'protocol_data' not in data:
                return jsonify({'error': 'Protocol data is required'}), 400
            
            protocol_data = data['protocol_data']
            
            # Assess protocol risk
            assessment = risk_assessor.assess_protocol_risk(protocol_data)
            
            return jsonify({
                'success': True,
                'assessment': assessment
            })
            
        except Exception as e:
            logger.error(f"Error in protocol risk assessment: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    # Portfolio Optimization Endpoints
    @app.route('/api/v1/portfolio/optimize', methods=['POST'])
    def optimize_portfolio():
        """Optimize portfolio allocation."""
        try:
            data = request.get_json()
            
            if not data or 'portfolio_data' not in data:
                return jsonify({'error': 'Portfolio data is required'}), 400
            
            portfolio_data = data['portfolio_data']
            preferences = data.get('preferences', {})
            
            # Optimize portfolio
            optimization = portfolio_optimizer.optimize_portfolio(portfolio_data, preferences)
            
            return jsonify({
                'success': True,
                'optimization': {
                    'allocations': optimization.allocations,
                    'expected_return': optimization.expected_return,
                    'risk_score': optimization.risk_score,
                    'sharpe_ratio': optimization.sharpe_ratio,
                    'rebalancing_frequency': optimization.rebalancing_frequency,
                    'confidence': optimization.confidence
                }
            })
            
        except Exception as e:
            logger.error(f"Error in portfolio optimization: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/api/v1/portfolio/rebalance', methods=['POST'])
    def suggest_rebalancing():
        """Suggest portfolio rebalancing."""
        try:
            data = request.get_json()
            
            required_fields = ['current_portfolio', 'target_portfolio']
            if not data or not all(field in data for field in required_fields):
                return jsonify({'error': 'Current and target portfolio data required'}), 400
            
            current_portfolio = data['current_portfolio']
            target_portfolio = data['target_portfolio']
            
            # Get rebalancing suggestions
            suggestions = portfolio_optimizer.suggest_rebalancing(current_portfolio, target_portfolio)
            
            return jsonify({
                'success': True,
                'rebalancing': suggestions
            })
            
        except Exception as e:
            logger.error(f"Error in rebalancing suggestions: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    # Market Analysis Endpoints
    @app.route('/api/v1/market/analyze', methods=['POST'])
    def analyze_market():
        """Analyze market conditions."""
        try:
            data = request.get_json()
            
            if not data or 'market_data' not in data:
                return jsonify({'error': 'Market data is required'}), 400
            
            market_data = data['market_data']
            
            # Analyze market conditions
            analysis = market_analyzer.analyze_market_conditions(market_data)
            
            return jsonify({
                'success': True,
                'analysis': {
                    'overall_sentiment': analysis.overall_sentiment.value,
                    'market_score': analysis.market_score,
                    'key_trends': analysis.key_trends,
                    'risk_factors': analysis.risk_factors,
                    'opportunities': analysis.opportunities,
                    'confidence': analysis.confidence
                }
            })
            
        except Exception as e:
            logger.error(f"Error in market analysis: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/api/v1/market/predict', methods=['POST'])
    def predict_market_direction():
        """Predict market direction."""
        try:
            data = request.get_json()
            
            if not data or 'historical_data' not in data:
                return jsonify({'error': 'Historical data is required'}), 400
            
            historical_data = data['historical_data']
            timeframe = data.get('timeframe', '30d')
            
            # Predict market direction
            prediction = market_analyzer.predict_market_direction(historical_data, timeframe)
            
            return jsonify({
                'success': True,
                'prediction': prediction
            })
            
        except Exception as e:
            logger.error(f"Error in market prediction: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    # Data Collection Endpoints
    @app.route('/api/v1/data/defi-protocols', methods=['GET'])
    @async_route
    async def get_defi_protocols():
        """Get DeFi protocol data."""
        try:
            protocols = request.args.getlist('protocols')
            
            async with DeFiDataCollector() as collector:
                protocol_data = await collector.collect_protocol_data(protocols if protocols else None)
            
            # Clean the data
            cleaned_data = []
            for protocol in protocol_data:
                cleaned_protocol = {
                    'name': protocol.name,
                    'chain': protocol.chain,
                    'tvl': float(protocol.tvl),
                    'apy': float(protocol.apy),
                    'category': protocol.category,
                    'contract_address': protocol.contract_address,
                    'last_updated': protocol.last_updated.isoformat()
                }
                cleaned_data.append(cleaned_protocol)
            
            return jsonify({
                'success': True,
                'protocols': cleaned_data,
                'count': len(cleaned_data)
            })
            
        except Exception as e:
            logger.error(f"Error getting DeFi protocols: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/api/v1/data/prices', methods=['GET'])
    @async_route
    async def get_prices():
        """Get price data for tokens."""
        try:
            symbols = request.args.getlist('symbols')
            
            if not symbols:
                return jsonify({'error': 'Token symbols are required'}), 400
            
            async with PriceFeedCollector() as collector:
                price_data = await collector.get_token_prices(symbols)
            
            # Convert to JSON-serializable format
            prices = {}
            for symbol, data in price_data.items():
                prices[symbol] = {
                    'symbol': data.symbol,
                    'price': data.price,
                    'price_change_24h': data.price_change_24h,
                    'volume_24h': data.volume_24h,
                    'market_cap': data.market_cap,
                    'timestamp': data.timestamp.isoformat()
                }
            
            return jsonify({
                'success': True,
                'prices': prices
            })
            
        except Exception as e:
            logger.error(f"Error getting prices: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/api/v1/data/yield-opportunities', methods=['GET'])
    @async_route
    async def get_yield_opportunities():
        """Get yield opportunities."""
        try:
            min_apy = float(request.args.get('min_apy', 1.0))
            min_tvl = float(request.args.get('min_tvl', 100000))
            chains = request.args.getlist('chains')
            
            async with YieldScanner() as scanner:
                opportunities = await scanner.scan_yield_opportunities(
                    min_apy=min_apy,
                    min_tvl=min_tvl,
                    chains=chains if chains else None
                )
            
            # Convert to JSON-serializable format
            opportunities_data = []
            for opp in opportunities:
                opp_data = {
                    'protocol': opp.protocol,
                    'pool_name': opp.pool_name,
                    'apy': opp.apy,
                    'tvl': opp.tvl,
                    'risk_score': opp.risk_score,
                    'category': opp.category,
                    'chain': opp.chain,
                    'token_symbols': opp.token_symbols,
                    'contract_address': opp.contract_address,
                    'minimum_deposit': opp.minimum_deposit,
                    'lock_period': opp.lock_period,
                    'last_updated': opp.last_updated.isoformat()
                }
                opportunities_data.append(opp_data)
            
            return jsonify({
                'success': True,
                'opportunities': opportunities_data,
                'count': len(opportunities_data)
            })
            
        except Exception as e:
            logger.error(f"Error getting yield opportunities: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    # Data Processing Endpoints
    @app.route('/api/v1/process/clean-data', methods=['POST'])
    def clean_data():
        """Clean and validate data."""
        try:
            data = request.get_json()
            
            if not data or 'data' not in data:
                return jsonify({'error': 'Data is required'}), 400
            
            data_type = data.get('type', 'price')
            raw_data = data['data']
            
            if data_type == 'price':
                cleaned_data = data_cleaner.clean_price_data(raw_data)
            elif data_type == 'yield':
                cleaned_data = data_cleaner.clean_yield_data(raw_data)
            else:
                return jsonify({'error': 'Invalid data type'}), 400
            
            # Convert DataFrame to dict for JSON response
            if hasattr(cleaned_data, 'to_dict'):
                cleaned_data = cleaned_data.to_dict('records')
            
            return jsonify({
                'success': True,
                'cleaned_data': cleaned_data
            })
            
        except Exception as e:
            logger.error(f"Error cleaning data: {e}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'error': 'Method not allowed'}), 405

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({'error': 'Internal server error'}), 500
