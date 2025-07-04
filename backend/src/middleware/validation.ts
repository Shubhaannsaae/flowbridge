import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { logger } from '../utils/logger';

export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: ValidationError) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
      location: error.type === 'field' ? error.location : undefined
    }));

    logger.warn('Validation failed:', {
      path: req.path,
      method: req.method,
      errors: formattedErrors,
      ip: req.ip
    });

    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formattedErrors
    });
    return;
  }

  next();
}

export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Sanitize common XSS attempts
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    
    return value;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
}

export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        res.status(415).json({
          error: 'Unsupported content type',
          code: 'UNSUPPORTED_CONTENT_TYPE',
          allowed: allowedTypes
        });
        return;
      }
    }

    next();
  };
}

export function validateRequestSize(maxSize: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxSize
      });
      return;
    }

    next();
  };
}
