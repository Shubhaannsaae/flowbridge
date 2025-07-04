from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import asyncio
from contextlib import asynccontextmanager
import sys
import os

# Add src to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from utils.config import Config
from utils.logger import setup_logger
from data.storage.database import DatabaseManager
from data.storage.cache import CacheManager
from api.middleware import setup_middleware
from api.endpoints import create_endpoints

class FlowBridgeAIApp:
    def __init__(self):
        self.app = Flask(__name__)
        self.config = Config()
        self.logger = setup_logger('flowbridge_ai')
        self.db_manager = None
        self.cache_manager = None
        
        # Setup Flask app
        self._configure_app()
        self._setup_cors()
        self._setup_middleware()
        self._setup_routes()
        
    def _configure_app(self):
        """Configure Flask application."""
        self.app.config.update({
            'SECRET_KEY': self.config.get('SECRET_KEY', 'dev-secret-key'),
            'DEBUG': self.config.get('DEBUG', False),
            'TESTING': self.config.get('TESTING', False),
            'JSON_SORT_KEYS': False,
            'JSONIFY_PRETTYPRINT_REGULAR': True
        })
        
    def _setup_cors(self):
        """Setup CORS configuration."""
        allowed_origins = self.config.get('ALLOWED_ORIGINS', ['http://localhost:3000'])
        
        CORS(self.app, 
             origins=allowed_origins,
             methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
             allow_headers=['Content-Type', 'Authorization', 'X-API-Key'],
             supports_credentials=True)
        
    def _setup_middleware(self):
        """Setup application middleware."""
        setup_middleware(self.app, self.config, self.logger)
        
    def _setup_routes(self):
        """Setup API routes."""
        # Health check endpoint
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'service': 'FlowBridge AI Engine',
                'version': '1.0.0'
            })
        
        # Create API endpoints
        create_endpoints(self.app, self.db_manager, self.cache_manager, self.logger)
        
    async def initialize_services(self):
        """Initialize database and cache services."""
        try:
            # Initialize database
            db_connection_string = self.config.get('DATABASE_URL')
            if db_connection_string:
                self.db_manager = DatabaseManager(db_connection_string)
                await self.db_manager.initialize()
                self.logger.info("Database service initialized")
            
            # Initialize cache
            redis_url = self.config.get('REDIS_URL', 'redis://localhost:6379')
            self.cache_manager = CacheManager(redis_url)
            await self.cache_manager.initialize()
            self.logger.info("Cache service initialized")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize services: {e}")
            raise
            
    async def cleanup_services(self):
        """Cleanup services on shutdown."""
        try:
            if self.db_manager:
                await self.db_manager.close()
                self.logger.info("Database service closed")
                
            if self.cache_manager:
                await self.cache_manager.close()
                self.logger.info("Cache service closed")
                
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

def create_app():
    """Application factory function."""
    ai_app = FlowBridgeAIApp()
    
    # Setup startup and shutdown handlers
    @ai_app.app.before_first_request
    def startup():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(ai_app.initialize_services())
    
    import atexit
    atexit.register(lambda: asyncio.run(ai_app.cleanup_services()))
    
    return ai_app.app

if __name__ == '__main__':
    app = create_app()
    
    # Get configuration
    config = Config()
    host = config.get('HOST', '0.0.0.0')
    port = config.get('PORT', 5000)
    debug = config.get('DEBUG', False)
    
    # Run the application
    app.run(host=host, port=port, debug=debug, threaded=True)
