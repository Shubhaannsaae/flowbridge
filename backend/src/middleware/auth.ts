import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    address: string;
  };
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Authorization header missing or malformed',
        code: 'MISSING_AUTH_HEADER'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ 
        error: 'Token not provided',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.userId || !decoded.address) {
      res.status(401).json({ 
        error: 'Invalid token payload',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
      return;
    }

    // Verify user exists and is active
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ 
        error: 'User account is deactivated',
        code: 'USER_DEACTIVATED'
      });
      return;
    }

    // Verify address matches
    if (user.address.toLowerCase() !== decoded.address.toLowerCase()) {
      res.status(401).json({ 
        error: 'Address mismatch',
        code: 'ADDRESS_MISMATCH'
      });
      return;
    }

    // Attach user info to request
    (req as AuthenticatedRequest).user = {
      userId: user.id,
      address: user.address
    };

    // Update last activity
    await user.update({ lastLogin: new Date() });

    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`Invalid JWT token: ${error.message}`);
      res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`Expired JWT token: ${error.message}`);
      res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth provided, continue without authentication
    next();
    return;
  }

  // Auth provided, validate it
  authenticate(req, res, next);
}

export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      
      if (!user) {
        res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const userRecord = await User.findByPk(user.userId);
      
      if (!userRecord) {
        res.status(401).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // For now, all users have 'user' role
      // In a more complex system, you'd check actual roles
      const userRole = 'user';
      
      if (!allowedRoles.includes(userRole)) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Role verification error:', error);
      res.status(500).json({ 
        error: 'Authorization service error',
        code: 'AUTHZ_SERVICE_ERROR'
      });
    }
  };
}
