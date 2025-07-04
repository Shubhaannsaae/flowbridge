import { Request, Response } from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export class AuthController {
  async authenticate(req: Request, res: Response): Promise<Response> {
    try {
      const { address, signature, message, timestamp } = req.body;

      if (!address || !signature || !message || !timestamp) {
        return res.status(400).json({ 
          error: 'Missing required fields: address, signature, message, timestamp' 
        });
      }

      // Verify timestamp is recent (within 5 minutes)
      const now = Date.now();
      if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
        return res.status(400).json({ error: 'Message timestamp too old' });
      }

      // Verify signature
      const expectedMessage = `FlowBridge Authentication\nTimestamp: ${timestamp}\nAddress: ${address}`;
      if (message !== expectedMessage) {
        return res.status(400).json({ error: 'Invalid message format' });
      }

      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Find or create user
      let user = await User.findOne({ where: { address: address.toLowerCase() } });
      if (!user) {
        user = await User.create({
          address: address.toLowerCase(),
          createdAt: new Date(),
          lastLogin: new Date()
        });
      } else {
        await user.update({ lastLogin: new Date() });
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, address: user.address },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      logger.info(`User authenticated: ${address}`);

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          address: user.address,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      logger.error('Authentication error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }

  async verify(req: Request, res: Response): Promise<Response> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await User.findByPk(decoded.userId);

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          address: user.address,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      logger.error('Token verification error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}
