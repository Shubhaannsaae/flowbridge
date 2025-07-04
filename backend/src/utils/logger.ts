import winston from 'winston';
import path from 'path';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine log level based on environment
const getLogLevel = (): string => {
  if (process.env.NODE_ENV === 'production') {
    return 'info';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'warn';
  }
  return process.env.LOG_LEVEL || 'debug';
};

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: getLogLevel(),
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

// Add file transports for production
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || './logs';
  
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
  
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  );
  
  // HTTP log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}

// Create the logger
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: getLogLevel(),
  format: winston.format.errors({ stack: true }),
  transports,
  exitOnError: false
});

// Create specialized loggers
export const httpLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'http',
  format: fileFormat,
  transports: [
    new winston.transports.Console({
      level: 'http',
      format: consoleFormat
    })
  ]
});

export const auditLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'info',
  format: fileFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'audit.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 20
    })
  ]
});

// Performance logger for tracking execution times
export class PerformanceLogger {
  private static timers: Map<string, number> = new Map();

  static start(label: string): void {
    this.timers.set(label, Date.now());
  }

  static end(label: string, additionalInfo?: any): void {
    const startTime = this.timers.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      logger.info(`Performance: ${label} completed in ${duration}ms`, additionalInfo);
      this.timers.delete(label);
    }
  }

  static measure<T>(label: string, fn: () => T): T;
  static async measure<T>(label: string, fn: () => Promise<T>): Promise<T>;
  static measure<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.start(label);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => this.end(label));
      } else {
        this.end(label);
        return result;
      }
    } catch (error) {
      this.end(label, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}

// Security event logger
export const securityLogger = {
  authFailure: (ip: string, userAgent: string, reason: string) => {
    auditLogger.warn('Authentication failure', {
      type: 'auth_failure',
      ip,
      userAgent,
      reason,
      timestamp: new Date().toISOString()
    });
  },

  suspiciousActivity: (userId: string, activity: string, details: any) => {
    auditLogger.warn('Suspicious activity detected', {
      type: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  },

  rateLimitExceeded: (ip: string, endpoint: string) => {
    auditLogger.warn('Rate limit exceeded', {
      type: 'rate_limit_exceeded',
      ip,
      endpoint,
      timestamp: new Date().toISOString()
    });
  },

  dataAccess: (userId: string, resource: string, action: string) => {
    auditLogger.info('Data access event', {
      type: 'data_access',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString()
    });
  }
};

// Transaction logger for blockchain events
export const transactionLogger = {
  transactionSubmitted: (txHash: string, from: string, to: string, value: string) => {
    logger.info('Transaction submitted', {
      type: 'transaction_submitted',
      txHash,
      from,
      to,
      value,
      timestamp: new Date().toISOString()
    });
  },

  transactionConfirmed: (txHash: string, blockNumber: number, gasUsed: string) => {
    logger.info('Transaction confirmed', {
      type: 'transaction_confirmed',
      txHash,
      blockNumber,
      gasUsed,
      timestamp: new Date().toISOString()
    });
  },

  transactionFailed: (txHash: string, reason: string) => {
    logger.error('Transaction failed', {
      type: 'transaction_failed',
      txHash,
      reason,
      timestamp: new Date().toISOString()
    });
  }
};

// Business logic logger
export const businessLogger = {
  portfolioCreated: (userId: string, portfolioId: string, initialAmount: string) => {
    logger.info('Portfolio created', {
      type: 'portfolio_created',
      userId,
      portfolioId,
      initialAmount,
      timestamp: new Date().toISOString()
    });
  },

  yieldStrategyDeployed: (portfolioId: string, protocol: string, amount: string) => {
    logger.info('Yield strategy deployed', {
      type: 'yield_strategy_deployed',
      portfolioId,
      protocol,
      amount,
      timestamp: new Date().toISOString()
    });
  },

  rebalancingExecuted: (portfolioId: string, strategies: any[], totalGasCost: string) => {
    logger.info('Portfolio rebalancing executed', {
      type: 'rebalancing_executed',
      portfolioId,
      strategiesCount: strategies.length,
      totalGasCost,
      timestamp: new Date().toISOString()
    });
  }
};

// Helper function to create child loggers
export function createChildLogger(service: string): winston.Logger {
  return logger.child({ service });
}

export default logger;
