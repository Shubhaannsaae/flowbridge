import cors from 'cors';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Allowed origins based on environment
const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];

  // Add production origins
  if (process.env.NODE_ENV === 'production') {
    origins.push(
      'https://flowbridge.app',
      'https://www.flowbridge.app',
      'https://app.flowbridge.app'
    );
  }

  // Add custom origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    const customOrigins = process.env.ALLOWED_ORIGINS.split(',');
    origins.push(...customOrigins);
  }

  return origins;
};

const allowedOrigins = getAllowedOrigins();

// CORS configuration
export const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Create CORS middleware
export const corsMiddleware = cors(corsOptions);

// Development-only CORS (allows all origins)
export const corsDevMiddleware = cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-API-Key'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 200
});

// Security headers middleware
export function securityHeaders(req: Request, res: any, next: any): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content security policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';"
  );

  next();
}

// Request logging middleware
export function requestLogger(req: Request, res: any, next: any): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length') || '0'
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request Error:', logData);
    } else {
      logger.info('HTTP Request:', logData);
    }
  });

  next();
}
