from flask import request, jsonify, g
import time
import functools
from datetime import datetime, timedelta
import hashlib
import hmac
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def setup_middleware(app, config, logger):
    """Setup all middleware for the Flask application."""
    
    # Request timing middleware
    @app.before_request
    def before_request():
        g.start_time = time.time()
        g.request_id = generate_request_id()
        
    @app.after_request
    def after_request(response):
        # Add request timing
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            response.headers['X-Response-Time'] = f"{duration:.3f}s"
        
        # Add request ID
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id
        
        # Add CORS headers if not already present
        if 'Access-Control-Allow-Origin' not in response.headers:
            response.headers['Access-Control-Allow-Origin'] = '*'
        
        # Security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Log request
        log_request(request, response, logger)
        
        return response
    
    # Rate limiting
    setup_rate_limiting(app, config, logger)
    
    # Authentication middleware
    setup_authentication(app, config, logger)
    
    # Request validation middleware
    setup_request_validation(app, logger)

def generate_request_id():
    """Generate unique request ID."""
    return hashlib.md5(f"{time.time()}{id(request)}".encode()).hexdigest()[:8]

def log_request(request, response, logger):
    """Log HTTP requests."""
    try:
        duration = time.time() - g.start_time if hasattr(g, 'start_time') else 0
        
        log_data = {
            'method': request.method,
            'path': request.path,
            'status': response.status_code,
            'duration': f"{duration:.3f}s",
            'ip': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'request_id': g.request_id if hasattr(g, 'request_id') else 'unknown'
        }
        
        if response.status_code >= 400:
            logger.warning(f"HTTP {response.status_code}: {log_data}")
        else:
            logger.info(f"HTTP {response.status_code}: {log_data}")
            
    except Exception as e:
        logger.error(f"Error logging request: {e}")

def setup_rate_limiting(app, config, logger):
    """Setup rate limiting middleware."""
    
    # In-memory rate limit store (use Redis in production)
    rate_limit_store = {}
    
    def clean_rate_limit_store():
        """Clean expired entries from rate limit store."""
        current_time = time.time()
        expired_keys = [
            key for key, data in rate_limit_store.items()
            if current_time - data['reset_time'] > 3600  # Clean entries older than 1 hour
        ]
        for key in expired_keys:
            del rate_limit_store[key]
    
    @app.before_request
    def rate_limit():
        # Skip rate limiting for health checks
        if request.path == '/health':
            return
        
        # Get rate limit configuration
        rate_limit_requests = int(config.get('RATE_LIMIT_REQUESTS', 100))
        rate_limit_window = int(config.get('RATE_LIMIT_WINDOW', 3600))  # 1 hour
        
        # Identify client (IP + User Agent for basic fingerprinting)
        client_id = hashlib.md5(
            f"{request.remote_addr}{request.headers.get('User-Agent', '')}".encode()
        ).hexdigest()
        
        current_time = time.time()
        
        # Clean old entries periodically
        if len(rate_limit_store) % 100 == 0:
            clean_rate_limit_store()
        
        # Check rate limit
        if client_id in rate_limit_store:
            client_data = rate_limit_store[client_id]
            
            # Reset window if expired
            if current_time - client_data['reset_time'] >= rate_limit_window:
                client_data['requests'] = 0
                client_data['reset_time'] = current_time
            
            # Check if limit exceeded
            if client_data['requests'] >= rate_limit_requests:
                logger.warning(f"Rate limit exceeded for client {client_id[:8]}")
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'limit': rate_limit_requests,
                    'window': rate_limit_window,
                    'reset_time': client_data['reset_time'] + rate_limit_window
                }), 429
            
            # Increment counter
            client_data['requests'] += 1
        else:
            # New client
            rate_limit_store[client_id] = {
                'requests': 1,
                'reset_time': current_time
            }

def setup_authentication(app, config, logger):
    """Setup authentication middleware."""
    
    def require_api_key(f):
        """Decorator to require API key authentication."""
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            api_key = request.headers.get('X-API-Key')
            
            if not api_key:
                return jsonify({'error': 'API key required'}), 401
            
            # Validate API key
            valid_api_keys = config.get('VALID_API_KEYS', [])
            if api_key not in valid_api_keys:
                logger.warning(f"Invalid API key attempted: {api_key[:8]}...")
                return jsonify({'error': 'Invalid API key'}), 401
            
            return f(*args, **kwargs)
        return decorated_function
    
    def verify_signature(f):
        """Decorator to verify request signature."""
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            signature = request.headers.get('X-Signature')
            timestamp = request.headers.get('X-Timestamp')
            
            if not signature or not timestamp:
                return jsonify({'error': 'Signature and timestamp required'}), 401
            
            # Check timestamp (prevent replay attacks)
            try:
                request_time = float(timestamp)
                current_time = time.time()
                
                if abs(current_time - request_time) > 300:  # 5 minutes tolerance
                    return jsonify({'error': 'Request expired'}), 401
            except ValueError:
                return jsonify({'error': 'Invalid timestamp'}), 401
            
            # Verify signature
            secret_key = config.get('SECRET_KEY', '').encode()
            body = request.get_data()
            expected_signature = hmac.new(
                secret_key,
                f"{timestamp}{body.decode()}".encode(),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                logger.warning("Invalid request signature")
                return jsonify({'error': 'Invalid signature'}), 401
            
            return f(*args, **kwargs)
        return decorated_function
    
    # Store authentication decorators in app config for use in endpoints
    app.config['require_api_key'] = require_api_key
    app.config['verify_signature'] = verify_signature

def setup_request_validation(app, logger):
    """Setup request validation middleware."""
    
    @app.before_request
    def validate_request():
        # Skip validation for GET requests and health checks
        if request.method == 'GET' or request.path == '/health':
            return
        
        # Validate Content-Type for POST requests
        if request.method in ['POST', 'PUT', 'PATCH']:
            content_type = request.headers.get('Content-Type', '')
            
            if not content_type.startswith('application/json'):
                return jsonify({
                    'error': 'Content-Type must be application/json'
                }), 400
        
        # Validate JSON payload
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                if request.content_length and request.content_length > 0:
                    request.get_json(force=True)
            except Exception as e:
                logger.warning(f"Invalid JSON in request: {e}")
                return jsonify({
                    'error': 'Invalid JSON payload'
                }), 400
        
        # Check request size
        max_content_length = 10 * 1024 * 1024  # 10MB
        if request.content_length and request.content_length > max_content_length:
            return jsonify({
                'error': 'Request too large',
                'max_size': f"{max_content_length // (1024*1024)}MB"
            }), 413

def setup_error_handlers(app, logger):
    """Setup global error handlers."""
    
    @app.errorhandler(400)
    def bad_request(error):
        logger.warning(f"Bad request: {error}")
        return jsonify({'error': 'Bad request'}), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        logger.warning(f"Unauthorized: {error}")
        return jsonify({'error': 'Unauthorized'}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        logger.warning(f"Forbidden: {error}")
        return jsonify({'error': 'Forbidden'}), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'error': 'Method not allowed'}), 405
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    @app.errorhandler(500)
    def internal_server_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(Exception)
    def handle_exception(error):
        logger.error(f"Unhandled exception: {error}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

def cors_preflight_handler():
    """Handle CORS preflight requests."""
    def handle_preflight():
        response = jsonify({'status': 'OK'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key, X-Signature, X-Timestamp'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response
    
    return handle_preflight

def setup_monitoring_middleware(app, logger):
    """Setup monitoring and metrics middleware."""
    
    # Request metrics (in production, use proper metrics collection)
    request_metrics = {
        'total_requests': 0,
        'requests_by_method': {},
        'requests_by_status': {},
        'average_response_time': 0,
        'errors': 0
    }
    
    @app.before_request
    def start_timer():
        g.start_time = time.time()
    
    @app.after_request
    def record_metrics(response):
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            
            # Update metrics
            request_metrics['total_requests'] += 1
            
            method = request.method
            request_metrics['requests_by_method'][method] = request_metrics['requests_by_method'].get(method, 0) + 1
            
            status = response.status_code
            request_metrics['requests_by_status'][status] = request_metrics['requests_by_status'].get(status, 0) + 1
            
            # Update average response time
            total_requests = request_metrics['total_requests']
            current_avg = request_metrics['average_response_time']
            request_metrics['average_response_time'] = ((current_avg * (total_requests - 1)) + duration) / total_requests
            
            if status >= 400:
                request_metrics['errors'] += 1
        
        return response
    
    # Metrics endpoint
    @app.route('/metrics', methods=['GET'])
    def get_metrics():
        return jsonify(request_metrics)
