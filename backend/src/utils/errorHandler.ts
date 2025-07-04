import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'sequelize';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger, securityLogger } from './logger';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;
}

export class CustomError extends Error implements AppError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

export class Web3Error extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 500, true, 'WEB3_ERROR', details);
  }
}

export class ExternalServiceError extends CustomError {
  constructor(service: string, message: string) {
    super(`${service} service error: ${message}`, 502, true, 'EXTERNAL_SERVICE_ERROR');
  }
}

function isAppError(error: any): error is AppError {
  return error.isOperational !== undefined;
}

function handleSequelizeError(error: any): CustomError {
  if (error.name === 'SequelizeValidationError') {
    const details = error.errors.map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return new ValidationError('Database validation failed', details);
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return new ConflictError('Resource already exists');
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new ValidationError('Invalid reference to related resource');
  }

  if (error.name === 'SequelizeConnectionError') {
    return new CustomError('Database connection error', 503, true, 'DATABASE_ERROR');
  }

  return new CustomError('Database error', 500, true, 'DATABASE_ERROR');
}

function handleJWTError(error: JsonWebTokenError | TokenExpiredError): CustomError {
  if (error instanceof TokenExpiredError) {
    return new AuthenticationError('Token expired');
  }

  if (error instanceof JsonWebTokenError) {
    return new AuthenticationError('Invalid token');
  }

  return new AuthenticationError('Authentication failed');
}

function handleWeb3Error(error: any): CustomError {
  // Handle common Web3/ethers errors
  if (error.code === 'NETWORK_ERROR') {
    return new Web3Error('Network connection failed', { originalError: error.message });
  }

  if (error.code === 'INSUFFICIENT_FUNDS') {
    return new Web3Error('Insufficient funds for transaction', { originalError: error.message });
  }

  if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return new Web3Error('Cannot estimate gas limit', { originalError: error.message });
  }

  if (error.code === 'TRANSACTION_REPLACED') {
    return new Web3Error('Transaction was replaced', { originalError: error.message });
  }

  return new Web3Error('Blockchain interaction failed', { originalError: error.message });
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let customError: CustomError;

  // Handle different types of errors
  if (isAppError(error)) {
    customError = error as CustomError;
  } else if (error instanceof ValidationError) {
    customError = handleSequelizeError(error);
  } else if (error instanceof JsonWebTokenError || error instanceof TokenExpiredError) {
    customError = handleJWTError(error);
  } else if (error.message && (error.message.includes('ethers') || error.message.includes('web3'))) {
    customError = handleWeb3Error(error);
  } else {
    // Generic error handling
    customError = new CustomError(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      500,
      false,
      'INTERNAL_ERROR'
    );
  }

  // Log the error
  const errorLog = {
    message: customError.message,
    statusCode: customError.statusCode,
    code: customError.code,
    stack: customError.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.userId || 'anonymous',
    timestamp: new Date().toISOString()
  };

  if (customError.statusCode >= 500) {
    logger.error('Internal server error:', errorLog);
  } else if (customError.statusCode === 401 || customError.statusCode === 403) {
    securityLogger.authFailure(req.ip, req.get('User-Agent') || '', customError.message);
    logger.warn('Authentication/Authorization error:', errorLog);
  } else {
    logger.warn('Client error:', errorLog);
  }

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(customError);
  }

  // Prepare error response
  const errorResponse: any = {
    error: customError.message,
    code: customError.code,
    timestamp: new Date().toISOString()
  };

  // Include additional details in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = customError.stack;
    if (customError.details) {
      errorResponse.details = customError.details;
    }
  }

  // Include validation details for client errors
  if (customError.statusCode < 500 && customError.details) {
    errorResponse.details = customError.details;
  }

  res.status(customError.statusCode).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function handleUncaughtExceptions(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Gracefully shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });

    // Gracefully shutdown
    process.exit(1);
  });
}

export function gracefulShutdown(server: any): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close((err: any) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }

      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
