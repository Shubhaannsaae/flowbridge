// FlowBridge Frontend - MetaMask Authentication API
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { isValidAddress, recoverMessageSigner } from '../../../utils/web3';

interface AuthRequest {
  address: string;
  signature: string;
  message: string;
  chainId: number;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    address: string;
    chainId: number;
    nonce: string;
  };
  error?: string;
}

// In-memory nonce storage (use Redis/DB in production)
const nonceStore = new Map<string, { nonce: string; timestamp: number }>();

// Generate authentication challenge
function generateAuthChallenge(address: string): string {
  const nonce = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  
  // Store nonce with 5-minute expiration
  nonceStore.set(address.toLowerCase(), { nonce, timestamp });
  
  // Clean expired nonces
  for (const [addr, data] of nonceStore.entries()) {
    if (timestamp - data.timestamp > 300000) { // 5 minutes
      nonceStore.delete(addr);
    }
  }
  
  return `FlowBridge Authentication\n\nSign this message to authenticate with FlowBridge.\n\nNonce: ${nonce}\nTimestamp: ${new Date(timestamp).toISOString()}`;
}

// Verify authentication signature
async function verifyAuthSignature(
  address: string, 
  signature: string, 
  message: string
): Promise<boolean> {
  try {
    const addressLower = address.toLowerCase();
    const storedData = nonceStore.get(addressLower);
    
    if (!storedData) {
      return false;
    }
    
    // Check if nonce is expired (5 minutes)
    if (Date.now() - storedData.timestamp > 300000) {
      nonceStore.delete(addressLower);
      return false;
    }
    
    // Verify message contains correct nonce
    if (!message.includes(storedData.nonce)) {
      return false;
    }
    
    // Verify signature
    const recoveredAddress = await recoverMessageSigner(message, signature);
    const isValid = recoveredAddress.toLowerCase() === addressLower;
    
    // Remove used nonce
    if (isValid) {
      nonceStore.delete(addressLower);
    }
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Generate JWT token
function generateJWTToken(address: string, chainId: number): string {
  const payload = {
    address: address.toLowerCase(),
    chainId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse | { message: string }>
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Generate authentication challenge
      const { address } = req.query;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Address parameter required' 
        });
      }
      
      if (!isValidAddress(address)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Ethereum address' 
        });
      }
      
      const message = generateAuthChallenge(address);
      
      return res.status(200).json({
        success: true,
        message,
      });
    }
    
    if (req.method === 'POST') {
      // Verify authentication
      const { address, signature, message, chainId }: AuthRequest = req.body;
      
      // Validate required fields
      if (!address || !signature || !message || !chainId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: address, signature, message, chainId'
        });
      }
      
      if (!isValidAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address'
        });
      }
      
      // Verify signature
      const isValidSignature = await verifyAuthSignature(address, signature, message);
      
      if (!isValidSignature) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature or expired nonce'
        });
      }
      
      // Generate JWT token
      const token = generateJWTToken(address, chainId);
      
      return res.status(200).json({
        success: true,
        token,
        user: {
          address: address.toLowerCase(),
          chainId,
          nonce: Math.random().toString(36).substring(2, 15),
        }
      });
    }
    
    return res.status(405).json({ message: 'Method not allowed' });
    
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
