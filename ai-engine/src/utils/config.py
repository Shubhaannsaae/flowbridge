import os
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

@dataclass
class DatabaseConfig:
    host: str
    port: int
    username: str
    password: str
    database: str
    ssl_mode: bool = False

@dataclass
class RedisConfig:
    host: str
    port: int
    password: Optional[str] = None
    database: int = 0

@dataclass
class GeminiConfig:
    api_key: str
    model_name: str = 'gemini-pro'
    temperature: float = 0.3
    max_output_tokens: int = 1024
    timeout: int = 30

class Config:
    """Configuration management for the AI engine."""
    
    def __init__(self, config_file: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self._config = {}
        self._load_environment_variables()
        
        if config_file and os.path.exists(config_file):
            self._load_config_file(config_file)
        
        self._validate_required_config()

    def _load_environment_variables(self):
        """Load configuration from environment variables."""
        # Environment
        self._config['ENVIRONMENT'] = os.getenv('ENVIRONMENT', 'development')
        self._config['DEBUG'] = os.getenv('DEBUG', 'false').lower() == 'true'
        
        # Flask/API
        self._config['HOST'] = os.getenv('HOST', '0.0.0.0')
        self._config['PORT'] = int(os.getenv('PORT', 5000))
        self._config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
        
        # Database
        self._config['DATABASE_URL'] = os.getenv('DATABASE_URL')
        self._config['DB_HOST'] = os.getenv('DB_HOST', 'localhost')
        self._config['DB_PORT'] = int(os.getenv('DB_PORT', 5432))
        self._config['DB_USER'] = os.getenv('DB_USER', 'flowbridge')
        self._config['DB_PASSWORD'] = os.getenv('DB_PASSWORD', '')
        self._config['DB_NAME'] = os.getenv('DB_NAME', 'flowbridge_ai')
        self._config['DB_SSL'] = os.getenv('DB_SSL', 'false').lower() == 'true'
        
        # Redis
        self._config['REDIS_URL'] = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self._config['REDIS_HOST'] = os.getenv('REDIS_HOST', 'localhost')
        self._config['REDIS_PORT'] = int(os.getenv('REDIS_PORT', 6379))
        self._config['REDIS_PASSWORD'] = os.getenv('REDIS_PASSWORD')
        self._config['REDIS_DB'] = int(os.getenv('REDIS_DB', 0))
        
        # AI/ML Configuration
        self._config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
        self._config['GEMINI_MODEL'] = os.getenv('GEMINI_MODEL', 'gemini-pro')
        self._config['AI_TEMPERATURE'] = float(os.getenv('AI_TEMPERATURE', 0.3))
        self._config['AI_MAX_TOKENS'] = int(os.getenv('AI_MAX_TOKENS', 1024))
        self._config['AI_TIMEOUT'] = int(os.getenv('AI_TIMEOUT', 30))
        
        # External APIs
        self._config['COINGECKO_API_KEY'] = os.getenv('COINGECKO_API_KEY')
        self._config['DEFILLAMA_API_KEY'] = os.getenv('DEFILLAMA_API_KEY')
        
        # CORS
        cors_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000')
        self._config['ALLOWED_ORIGINS'] = [origin.strip() for origin in cors_origins.split(',')]
        
        # API Keys for validation
        api_keys = os.getenv('VALID_API_KEYS', '')
        self._config['VALID_API_KEYS'] = [key.strip() for key in api_keys.split(',') if key.strip()]
        
        # Logging
        self._config['LOG_LEVEL'] = os.getenv('LOG_LEVEL', 'INFO')
        self._config['LOG_FILE'] = os.getenv('LOG_FILE', 'ai_engine.log')
        
        # Model Training
        self._config['MODEL_CACHE_DIR'] = os.getenv('MODEL_CACHE_DIR', './models')
        self._config['DATA_CACHE_TTL'] = int(os.getenv('DATA_CACHE_TTL', 3600))
        
        # Rate Limiting
        self._config['RATE_LIMIT_REQUESTS'] = int(os.getenv('RATE_LIMIT_REQUESTS', 100))
        self._config['RATE_LIMIT_WINDOW'] = int(os.getenv('RATE_LIMIT_WINDOW', 3600))

    def _load_config_file(self, config_file: str):
        """Load configuration from JSON file."""
        try:
            with open(config_file, 'r') as f:
                file_config = json.load(f)
                self._config.update(file_config)
            self.logger.info(f"Loaded configuration from {config_file}")
        except Exception as e:
            self.logger.warning(f"Failed to load config file {config_file}: {e}")

    def _validate_required_config(self):
        """Validate that required configuration is present."""
        required_keys = [
            'GEMINI_API_KEY',
        ]
        
        missing_keys = []
        for key in required_keys:
            if not self._config.get(key):
                missing_keys.append(key)
        
        if missing_keys:
            raise ValueError(f"Missing required configuration: {', '.join(missing_keys)}")

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        return self._config.get(key, default)

    def set(self, key: str, value: Any):
        """Set configuration value."""
        self._config[key] = value

    def get_database_config(self) -> DatabaseConfig:
        """Get database configuration."""
        if self._config.get('DATABASE_URL'):
            # Parse DATABASE_URL if provided
            url = self._config['DATABASE_URL']
            # This is a simplified parser - in production, use urllib.parse
            if 'postgresql://' in url or 'postgres://' in url:
                parts = url.replace('postgresql://', '').replace('postgres://', '').split('@')
                if len(parts) == 2:
                    user_pass = parts[0].split(':')
                    host_port_db = parts[1].split('/')
                    host_port = host_port_db[0].split(':')
                    
                    return DatabaseConfig(
                        host=host_port[0],
                        port=int(host_port[1]) if len(host_port) > 1 else 5432,
                        username=user_pass[0],
                        password=user_pass[1] if len(user_pass) > 1 else '',
                        database=host_port_db[1] if len(host_port_db) > 1 else '',
                        ssl_mode=True
                    )
        
        return DatabaseConfig(
            host=self._config['DB_HOST'],
            port=self._config['DB_PORT'],
            username=self._config['DB_USER'],
            password=self._config['DB_PASSWORD'],
            database=self._config['DB_NAME'],
            ssl_mode=self._config['DB_SSL']
        )

    def get_redis_config(self) -> RedisConfig:
        """Get Redis configuration."""
        return RedisConfig(
            host=self._config['REDIS_HOST'],
            port=self._config['REDIS_PORT'],
            password=self._config['REDIS_PASSWORD'],
            database=self._config['REDIS_DB']
        )

    def get_gemini_config(self) -> GeminiConfig:
        """Get Gemini AI configuration."""
        return GeminiConfig(
            api_key=self._config['GEMINI_API_KEY'],
            model_name=self._config['GEMINI_MODEL'],
            temperature=self._config['AI_TEMPERATURE'],
            max_output_tokens=self._config['AI_MAX_TOKENS'],
            timeout=self._config['AI_TIMEOUT']
        )

    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self._config['ENVIRONMENT'] == 'development'

    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self._config['ENVIRONMENT'] == 'production'

    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self._config['ENVIRONMENT'] == 'testing'

    def get_database_url(self) -> str:
        """Get complete database URL."""
        if self._config.get('DATABASE_URL'):
            return self._config['DATABASE_URL']
        
        db_config = self.get_database_config()
        password_part = f":{db_config.password}" if db_config.password else ""
        ssl_part = "?sslmode=require" if db_config.ssl_mode else ""
        
        return f"postgresql://{db_config.username}{password_part}@{db_config.host}:{db_config.port}/{db_config.database}{ssl_part}"

    def get_allowed_origins(self) -> List[str]:
        """Get allowed CORS origins."""
        return self._config['ALLOWED_ORIGINS']

    def get_api_keys(self) -> List[str]:
        """Get valid API keys for authentication."""
        return self._config['VALID_API_KEYS']

    def update_from_dict(self, config_dict: Dict[str, Any]):
        """Update configuration from dictionary."""
        self._config.update(config_dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary (excluding sensitive data)."""
        safe_config = self._config.copy()
        
        # Remove sensitive information
        sensitive_keys = [
            'GEMINI_API_KEY', 'DB_PASSWORD', 'REDIS_PASSWORD', 
            'SECRET_KEY', 'COINGECKO_API_KEY', 'DEFILLAMA_API_KEY',
            'DATABASE_URL', 'VALID_API_KEYS'
        ]
        
        for key in sensitive_keys:
            if key in safe_config:
                safe_config[key] = '[REDACTED]'
        
        return safe_config

# Global configuration instance
_config_instance = None

def get_config() -> Config:
    """Get global configuration instance."""
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance

def init_config(config_file: Optional[str] = None) -> Config:
    """Initialize global configuration."""
    global _config_instance
    _config_instance = Config(config_file)
    return _config_instance
