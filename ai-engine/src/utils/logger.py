import logging
import logging.handlers
import os
import sys
from datetime import datetime
from typing import Optional
import json

class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcfromtimestamp(record.created).isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        
        if hasattr(record, 'execution_time'):
            log_entry['execution_time'] = record.execution_time
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)

class ColoredFormatter(logging.Formatter):
    """Colored formatter for console output."""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
        'RESET': '\033[0m'      # Reset
    }
    
    def format(self, record):
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        reset = self.COLORS['RESET']
        
        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%Y-%m-%d %H:%M:%S')
        
        # Create colored log message
        log_message = f"{color}[{timestamp}] {record.levelname:<8} {record.name}: {record.getMessage()}{reset}"
        
        # Add exception info if present
        if record.exc_info:
            log_message += f"\n{self.formatException(record.exc_info)}"
        
        return log_message

def setup_logger(
    name: str = 'ai_engine',
    level: str = 'INFO',
    log_file: Optional[str] = None,
    enable_console: bool = True,
    enable_json: bool = False,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> logging.Logger:
    """Setup logger with file and console handlers."""
    
    logger = logging.getLogger(name)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Set log level
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(numeric_level)
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        
        if enable_json:
            console_handler.setFormatter(JSONFormatter())
        else:
            console_handler.setFormatter(ColoredFormatter())
        
        console_handler.setLevel(numeric_level)
        logger.addHandler(console_handler)
    
    # File handler
    if log_file:
        # Ensure log directory exists
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # Rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count
        )
        
        # Always use JSON format for file logs
        file_handler.setFormatter(JSONFormatter())
        file_handler.setLevel(numeric_level)
        logger.addHandler(file_handler)
    
    # Prevent duplicate logs
    logger.propagate = False
    
    return logger

class RequestLogger:
    """Logger for HTTP requests with timing and context."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def log_request(self, method: str, path: str, status_code: int, 
                   execution_time: float, user_id: Optional[str] = None,
                   request_id: Optional[str] = None):
        """Log HTTP request with context."""
        
        extra = {
            'execution_time': execution_time,
            'method': method,
            'path': path,
            'status_code': status_code
        }
        
        if user_id:
            extra['user_id'] = user_id
        
        if request_id:
            extra['request_id'] = request_id
        
        level = logging.WARNING if status_code >= 400 else logging.INFO
        
        self.logger.log(
            level,
            f"{method} {path} - {status_code} - {execution_time:.3f}s",
            extra=extra
        )

class ModelLogger:
    """Logger for AI model operations."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def log_prediction(self, model_name: str, input_size: int, 
                      execution_time: float, confidence: Optional[float] = None,
                      request_id: Optional[str] = None):
        """Log model prediction."""
        
        extra = {
            'model_name': model_name,
            'input_size': input_size,
            'execution_time': execution_time
        }
        
        if confidence is not None:
            extra['confidence'] = confidence
        
        if request_id:
            extra['request_id'] = request_id
        
        self.logger.info(
            f"Model {model_name} prediction completed - {execution_time:.3f}s",
            extra=extra
        )
    
    def log_error(self, model_name: str, error: Exception,
                  request_id: Optional[str] = None):
        """Log model error."""
        
        extra = {
            'model_name': model_name,
            'error_type': type(error).__name__
        }
        
        if request_id:
            extra['request_id'] = request_id
        
        self.logger.error(
            f"Model {model_name} error: {str(error)}",
            extra=extra,
            exc_info=True
        )

class PerformanceLogger:
    """Logger for performance monitoring."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.start_times = {}
    
    def start_timer(self, operation: str, request_id: Optional[str] = None) -> str:
        """Start timing an operation."""
        import time
        timer_id = f"{operation}_{request_id}_{time.time()}"
        self.start_times[timer_id] = time.time()
        return timer_id
    
    def end_timer(self, timer_id: str, operation: str, 
                  request_id: Optional[str] = None, 
                  log_level: int = logging.INFO):
        """End timing and log the operation."""
        import time
        
        if timer_id not in self.start_times:
            self.logger.warning(f"Timer {timer_id} not found")
            return
        
        execution_time = time.time() - self.start_times[timer_id]
        del self.start_times[timer_id]
        
        extra = {
            'operation': operation,
            'execution_time': execution_time
        }
        
        if request_id:
            extra['request_id'] = request_id
        
        # Log slow operations as warnings
        if execution_time > 5.0:  # 5 seconds threshold
            log_level = logging.WARNING
        
        self.logger.log(
            log_level,
            f"Operation {operation} completed in {execution_time:.3f}s",
            extra=extra
        )

class DatabaseLogger:
    """Logger for database operations."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def log_query(self, query_type: str, table: str, execution_time: float,
                  rows_affected: Optional[int] = None,
                  request_id: Optional[str] = None):
        """Log database query."""
        
        extra = {
            'query_type': query_type,
            'table': table,
            'execution_time': execution_time
        }
        
        if rows_affected is not None:
            extra['rows_affected'] = rows_affected
        
        if request_id:
            extra['request_id'] = request_id
        
        # Log slow queries as warnings
        level = logging.WARNING if execution_time > 1.0 else logging.DEBUG
        
        self.logger.log(
            level,
            f"DB {query_type} on {table} - {execution_time:.3f}s",
            extra=extra
        )
    
    def log_connection_error(self, error: Exception, 
                           request_id: Optional[str] = None):
        """Log database connection error."""
        
        extra = {
            'error_type': type(error).__name__
        }
        
        if request_id:
            extra['request_id'] = request_id
        
        self.logger.error(
            f"Database connection error: {str(error)}",
            extra=extra,
            exc_info=True
        )

# Utility functions for common logging patterns
def log_function_call(logger: logging.Logger):
    """Decorator to log function calls with execution time."""
    import functools
    import time
    
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                logger.debug(
                    f"Function {func.__name__} completed in {execution_time:.3f}s",
                    extra={
                        'function': func.__name__,
                        'execution_time': execution_time
                    }
                )
                
                return result
            
            except Exception as e:
                execution_time = time.time() - start_time
                
                logger.error(
                    f"Function {func.__name__} failed after {execution_time:.3f}s: {str(e)}",
                    extra={
                        'function': func.__name__,
                        'execution_time': execution_time,
                        'error_type': type(e).__name__
                    },
                    exc_info=True
                )
                raise
        
        return wrapper
    return decorator

def get_logger(name: str) -> logging.Logger:
    """Get logger instance."""
    return logging.getLogger(name)

def configure_root_logger(level: str = 'INFO'):
    """Configure root logger to prevent duplicate logs."""
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Remove default handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
