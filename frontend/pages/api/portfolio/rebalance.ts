// FlowBridge Frontend - Portfolio Rebalancing API
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { getProvider } from '../../../utils/web3';

interface RebalanceRequest {
  portfolioId: string;
  newAllocations: Record<string, string>; // strategyId -> percentage
  slippageTolerance: number;
  gasPrice?: string;
  forceRebalance?: boolean;
}

interface RebalanceResponse {
  success: boolean;
  data?: {
    rebalanceId: string;
    portfolioId: string;
    oldAllocations: Record<string, string>;
    newAllocations: Record<string, string>;
    transactionHashes: string[];
    estimatedGasCost: string;
    expectedAPYImprovement: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    createdAt: string;
  };
  error?: string;
}

interface RebalanceExecution {
  id: string;
  portfolioId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  oldAllocations: Record<string, string>;
  newAllocations: Record<string, string>;
  transactionHashes: string[];
  gasUsed: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// Mock rebalance executions storage
const rebalanceExecutions: RebalanceExecution[] = [];

// Verify JWT token
function verifyToken(authorization: string | undefined): { address: string; chainId: number } | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authorization.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    return { address: decoded.address, chainId: decoded.chainId };
  } catch (error) {
    return null;
  }
}

// Calculate rebalancing requirements
function calculateRebalanceRequirements(
  currentAllocations: Record<string, string>,
  targetAllocations: Record<string, string>,
  totalValue: number,
  threshold: number = 2.0
): { needsRebalance: boolean; movements: Array<{ from: string; to: string; amount: number }> } {
  const movements: Array<{ from: string; to: string; amount: number }> = [];
  let needsRebalance = false;

  // Calculate differences
  const differences: Record<string, number> = {};
  for (const strategyId in targetAllocations) {
    const current = parseFloat(currentAllocations[strategyId] || '0');
    const target = parseFloat(targetAllocations[strategyId]);
    const diff = target - current;
    
    if (Math.abs(diff) > threshold) {
      needsRebalance = true;
      differences[strategyId] = diff;
    }
  }

  // Calculate movements needed
  const surplus: Array<{ strategyId: string; amount: number }> = [];
  const deficit: Array<{ strategyId: string; amount: number }> = [];

  for (const [strategyId, diff] of Object.entries(differences)) {
    const amount = Math.abs(diff) * totalValue / 100;
    if (diff > 0) {
      deficit.push({ strategyId, amount });
    } else {
      surplus.push({ strategyId, amount });
    }
  }

  // Match surplus with deficit
  for (const surplusItem of surplus) {
    for (const deficitItem of deficit) {
      if (surplusItem.amount > 0 && deficitItem.amount > 0) {
        const moveAmount = Math.min(surplusItem.amount, deficitItem.amount);
        movements.push({
          from: surplusItem.strategyId,
          to: deficitItem.strategyId,
          amount: moveAmount
        });
        surplusItem.amount -= moveAmount;
        deficitItem.amount -= moveAmount;
      }
    }
  }

  return { needsRebalance, movements };
}

// Estimate gas costs for rebalancing
async function estimateRebalanceGasCosts(
  chainId: number,
  movements: Array<{ from: string; to: string; amount: number }>
): Promise<string> {
  try {
    const provider = getProvider(chainId);
    if (!provider) {
      throw new Error('Provider not available');
    }

    const gasPrice = await provider.getGasPrice();
    
    // Estimate gas per transaction (withdrawal + deposit)
    const gasPerMovement = 150000; // Conservative estimate
    const totalGas = movements.length * gasPerMovement;
    
    const gasCostWei = gasPrice.mul(totalGas);
    const gasCostEth = ethers.utils.formatEther(gasCostWei);
    
    // Convert to USD (simplified - would use real price feed)
    const ethPriceUSD = 2500; // Mock price
    const gasCostUSD = parseFloat(gasCostEth) * ethPriceUSD;
    
    return gasCostUSD.toFixed(2);
  } catch (error) {
    console.error('Gas estimation error:', error);
    return '50.00'; // Fallback estimate
  }
}

// Execute rebalancing transactions
async function executeRebalancing(
  rebalanceId: string,
  movements: Array<{ from: string; to: string; amount: number }>,
  chainId: number,
  gasPrice?: string
): Promise<string[]> {
  // In production, this would:
  // 1. Execute withdrawal transactions from source strategies
  // 2. Execute deposit transactions to target strategies
  // 3. Handle transaction failures and rollbacks
  // 4. Update database with transaction hashes and status
  
  // For now, return mock transaction hashes
  const transactionHashes: string[] = [];
  
  for (const movement of movements) {
    // Mock transaction hash
    const txHash = `0x${Math.random().toString(16).substring(2)}${'0'.repeat(64)}`.substring(0, 66);
    transactionHashes.push(txHash);
    
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return transactionHashes;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RebalanceResponse | { success: boolean; data?: any; error?: string }>
) {
  try {
    // Verify authentication
    const auth = verifyToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (req.method === 'POST') {
      // Initiate portfolio rebalancing
      const {
        portfolioId,
        newAllocations,
        slippageTolerance,
        gasPrice,
        forceRebalance = false
      }: RebalanceRequest = req.body;

      // Validate required fields
      if (!portfolioId || !newAllocations) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: portfolioId, newAllocations'
        });
      }

      // Validate allocations sum to 100%
      const totalAllocation = Object.values(newAllocations)
        .reduce((sum, percentage) => sum + parseFloat(percentage), 0);
      
      if (Math.abs(totalAllocation - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'Allocations must sum to 100%'
        });
      }

      // Validate slippage tolerance
      if (slippageTolerance < 0 || slippageTolerance > 10) {
        return res.status(400).json({
          success: false,
          error: 'Slippage tolerance must be between 0 and 10%'
        });
      }

      // Get current allocations (mock data)
      const currentAllocations: Record<string, string> = {
        'strategy_1': '40.0',
        'strategy_2': '35.0',
        'strategy_3': '25.0',
      };

      // Calculate rebalancing requirements
      const totalValue = 25000; // Mock total portfolio value
      const rebalanceThreshold = forceRebalance ? 0 : 2.0;
      
      const { needsRebalance, movements } = calculateRebalanceRequirements(
        currentAllocations,
        newAllocations,
        totalValue,
        rebalanceThreshold
      );

      if (!needsRebalance && !forceRebalance) {
        return res.status(200).json({
          success: false,
          error: 'Portfolio is already within rebalancing threshold'
        });
      }

      // Estimate gas costs
      const estimatedGasCost = await estimateRebalanceGasCosts(auth.chainId, movements);

      // Create rebalance execution record
      const rebalanceId = `rebalance_${Date.now()}`;
      const rebalanceExecution: RebalanceExecution = {
        id: rebalanceId,
        portfolioId,
        status: 'pending',
        oldAllocations: currentAllocations,
        newAllocations,
        transactionHashes: [],
        gasUsed: '0',
        createdAt: new Date().toISOString(),
      };

      rebalanceExecutions.push(rebalanceExecution);

      // Start rebalancing execution (async)
      setImmediate(async () => {
        try {
          // Update status to executing
          rebalanceExecution.status = 'executing';
          
          // Execute rebalancing transactions
          const transactionHashes = await executeRebalancing(
            rebalanceId,
            movements,
            auth.chainId,
            gasPrice
          );
          
          // Update execution record
          rebalanceExecution.transactionHashes = transactionHashes;
          rebalanceExecution.status = 'completed';
          rebalanceExecution.completedAt = new Date().toISOString();
          rebalanceExecution.gasUsed = estimatedGasCost;
          
        } catch (error) {
          console.error('Rebalancing execution error:', error);
          rebalanceExecution.status = 'failed';
          rebalanceExecution.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          rebalanceId,
          portfolioId,
          oldAllocations: currentAllocations,
          newAllocations,
          transactionHashes: [], // Will be populated as transactions execute
          estimatedGasCost,
          expectedAPYImprovement: '0.25', // Mock improvement
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
      });
    }

    if (req.method === 'GET') {
      // Get rebalancing status
      const { rebalanceId, portfolioId } = req.query;

      if (rebalanceId && typeof rebalanceId === 'string') {
        // Get specific rebalance execution
        const execution = rebalanceExecutions.find(r => r.id === rebalanceId);
        if (!execution) {
          return res.status(404).json({
            success: false,
            error: 'Rebalance execution not found'
          });
        }

        return res.status(200).json({
          success: true,
          data: execution
        });
      }

      if (portfolioId && typeof portfolioId === 'string') {
        // Get rebalance history for portfolio
        const executions = rebalanceExecutions
          .filter(r => r.portfolioId === portfolioId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return res.status(200).json({
          success: true,
          data: executions
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Either rebalanceId or portfolioId is required'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Rebalance API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
