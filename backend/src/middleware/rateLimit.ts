import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom key generator for user-based rate limiting
const createKeyGenerator = (useUser: boolean = false) => {
  return (req: Request): string => {
    if (useUser && (req as any).user) {
      return `user:${(req as any).user.userId}`;
    }
    return `ip:${req.ip}`;
  };
};

// Custom rate limit handler
const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn('Rate limit exceeded:', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    user: (req as any).user?.userId || 'anonymous'
  });

  res.status(429).json({
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil((res.getHeader('X-RateLimit-Reset') as number || Date.now() + 60000) / 1000 - Date.now() / 1000)
  });
};

// Authentication rate limiting (stricter)
export const rateLimitAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 authentication attempts per window
  message: 'Too many authentication attempts from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(false),
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// General API rate limiting
export const rateLimitStrict = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(false),
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// User-specific rate limiting (after authentication)
export const rateLimitUser = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // limit each authenticated user to 200 requests per minute
  message: 'Too many requests from this user, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(true),
  handler: rateLimitHandler
});

// AI/ML endpoint rate limiting (more restrictive)
export const rateLimitAI = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit AI requests to 20 per minute per user
  message: 'Too many AI requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(true),
  handler: rateLimitHandler
});

// Expensive operations rate limiting
export const rateLimitExpensive = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit expensive operations to 10 per 5 minutes per user
  message: 'Too many expensive operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(true),
  handler: rateLimitHandler
});

// Portfolio operations rate limiting
export const rateLimitPortfolio = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit portfolio operations to 30 per minute per user
  message: 'Too many portfolio operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(true),
  handler: rateLimitHandler
});

// Transaction/blockchain operations rate limiting
export const rateLimitTransaction = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit transaction operations to 10 per minute per user
  message: 'Too many transaction requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(true),
  handler: rateLimitHandler
});
