import { ethers } from 'ethers';
import { LiFiIntegration } from './LiFiIntegration';
import { CircleCCTP } from './CircleCCTP';
import { ChainManager } from './ChainManager';
import { logger } from '../../utils/logger';

export interface BridgeTransaction {
  id: string;
  type: 'lifi' | 'cctp' | 'native';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  sourceChain: number;
  destinationChain: number;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  sourceHash?: string;
  destinationHash?: string;
  bridgeHash?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedCompletionTime?: Date;
  actualCompletionTime?: Date;
  fees: {
    bridgeFee: string;
    gasFee: string;
    totalFee: string;
  };
  user: string;
  metadata?: any;
}

export interface BridgeStatus {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    txHash?: string;
    timestamp?: Date;
    estimatedTime?: number;
  }>;
  timeRemaining?: number;
  errorMessage?: string;
}

export interface BridgeMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageCompletionTime: number;
  totalVolume: string;
  popularRoutes: Array<{
    sourceChain: number;
    destinationChain: number;
    count: number;
    volume: string;
  }>;
  bridgeUtilization: Array<{
    bridge: string;
    transactionCount: number;
    successRate: number;
    averageTime: number;
  }>;
}

export class BridgeMonitor {
  private lifiIntegration: LiFiIntegration;
  private circleCCTP: CircleCCTP;
  private chainManager: ChainManager;
  private activeTransactions: Map<string, BridgeTransaction>;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.lifiIntegration = new LiFiIntegration();
    this.circleCCTP = new CircleCCTP();
    this.chainManager = new ChainManager();
    this.activeTransactions = new Map();
    this.startMonitoring();
  }

  async trackTransaction(transaction: BridgeTransaction): Promise<void> {
    try {
      this.activeTransactions.set(transaction.id, transaction);
      logger.info(`Tracking bridge transaction: ${transaction.id}`);
      
      // Start monitoring this specific transaction
      this.monitorSingleTransaction(transaction.id);

    } catch (error) {
      logger.error(`Error tracking transaction ${transaction.id}:`, error);
    }
  }

  async getTransactionStatus(transactionId: string): Promise<BridgeStatus | null> {
    try {
      const transaction = this.activeTransactions.get(transactionId);
      if (!transaction) {
        return null;
      }

      let status: BridgeStatus;

      switch (transaction.type) {
        case 'lifi':
          status = await this.getLiFiTransactionStatus(transaction);
          break;
        case 'cctp':
          status = await this.getCCTPTransactionStatus(transaction);
          break;
        case 'native':
          status = await this.getNativeTransactionStatus(transaction);
          break;
        default:
          throw new Error(`Unknown transaction type: ${transaction.type}`);
      }

      // Update transaction status
      if (status.status !== transaction.status) {
        transaction.status = status.status as any;
        transaction.updatedAt = new Date();
        
        if (status.status === 'completed') {
          transaction.actualCompletionTime = new Date();
        }
        
        this.activeTransactions.set(transactionId, transaction);
      }

      return status;

    } catch (error) {
      logger.error(`Error getting transaction status for ${transactionId}:`, error);
      return null;
    }
  }

  async getAllActiveTransactions(): Promise<BridgeTransaction[]> {
    return Array.from(this.activeTransactions.values())
      .filter(tx => tx.status !== 'completed' && tx.status !== 'failed');
  }

  async getTransactionHistory(
    userAddress?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BridgeTransaction[]> {
    try {
      let transactions = Array.from(this.activeTransactions.values());

      if (userAddress) {
        transactions = transactions.filter(tx => 
          tx.user.toLowerCase() === userAddress.toLowerCase()
        );
      }

      // Sort by creation time (newest first)
      transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return transactions.slice(offset, offset + limit);

    } catch (error) {
      logger.error('Error getting transaction history:', error);
      return [];
    }
  }

  async getBridgeMetrics(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<BridgeMetrics> {
    try {
      const cutoffTime = this.getCutoffTime(timeframe);
      const transactions = Array.from(this.activeTransactions.values())
        .filter(tx => tx.createdAt >= cutoffTime);

      const totalTransactions = transactions.length;
      const successfulTransactions = transactions.filter(tx => tx.status === 'completed').length;
      const failedTransactions = transactions.filter(tx => tx.status === 'failed').length;

      // Calculate average completion time
      const completedTransactions = transactions.filter(tx => 
        tx.status === 'completed' && tx.actualCompletionTime
      );
      
      const averageCompletionTime = completedTransactions.length > 0 
        ? completedTransactions.reduce((sum, tx) => {
            const duration = tx.actualCompletionTime!.getTime() - tx.createdAt.getTime();
            return sum + duration;
          }, 0) / completedTransactions.length / 1000 // Convert to seconds
        : 0;

      // Calculate total volume
      const totalVolume = transactions.reduce((sum, tx) => {
        return sum + parseFloat(tx.amount);
      }, 0).toString();

      // Popular routes
      const routeMap = new Map<string, { count: number; volume: number }>();
      transactions.forEach(tx => {
        const routeKey = `${tx.sourceChain}-${tx.destinationChain}`;
        const existing = routeMap.get(routeKey) || { count: 0, volume: 0 };
        routeMap.set(routeKey, {
          count: existing.count + 1,
          volume: existing.volume + parseFloat(tx.amount)
        });
      });

      const popularRoutes = Array.from(routeMap.entries())
        .map(([route, data]) => {
          const [sourceChain, destinationChain] = route.split('-').map(Number);
          return {
            sourceChain,
            destinationChain,
            count: data.count,
            volume: data.volume.toString()
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Bridge utilization
      const bridgeMap = new Map<string, { count: number; successful: number; totalTime: number }>();
      transactions.forEach(tx => {
        const existing = bridgeMap.get(tx.type) || { count: 0, successful: 0, totalTime: 0 };
        const isSuccessful = tx.status === 'completed';
        const completionTime = tx.actualCompletionTime 
          ? tx.actualCompletionTime.getTime() - tx.createdAt.getTime()
          : 0;

        bridgeMap.set(tx.type, {
          count: existing.count + 1,
          successful: existing.successful + (isSuccessful ? 1 : 0),
          totalTime: existing.totalTime + completionTime
        });
      });

      const bridgeUtilization = Array.from(bridgeMap.entries())
        .map(([bridge, data]) => ({
          bridge,
          transactionCount: data.count,
          successRate: data.count > 0 ? (data.successful / data.count) * 100 : 0,
          averageTime: data.successful > 0 ? data.totalTime / data.successful / 1000 : 0
        }));

      return {
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        averageCompletionTime,
        totalVolume,
        popularRoutes,
        bridgeUtilization
      };

    } catch (error) {
      logger.error('Error calculating bridge metrics:', error);
      throw error;
    }
  }

  async retryFailedTransaction(transactionId: string): Promise<boolean> {
    try {
      const transaction = this.activeTransactions.get(transactionId);
      if (!transaction || transaction.status !== 'failed') {
        return false;
      }

      // Reset transaction status
      transaction.status = 'pending';
      transaction.updatedAt = new Date();
      this.activeTransactions.set(transactionId, transaction);

      // Restart monitoring
      this.monitorSingleTransaction(transactionId);

      logger.info(`Retrying failed transaction: ${transactionId}`);
      return true;

    } catch (error) {
      logger.error(`Error retrying transaction ${transactionId}:`, error);
      return false;
    }
  }

  async cancelTransaction(transactionId: string): Promise<boolean> {
    try {
      const transaction = this.activeTransactions.get(transactionId);
      if (!transaction || transaction.status === 'completed') {
        return false;
      }

      // Check if transaction can be cancelled (only if still pending)
      if (transaction.status === 'pending' && !transaction.sourceHash) {
        transaction.status = 'failed';
        transaction.updatedAt = new Date();
        this.activeTransactions.set(transactionId, transaction);

        logger.info(`Transaction cancelled: ${transactionId}`);
        return true;
      }

      return false;

    } catch (error) {
      logger.error(`Error cancelling transaction ${transactionId}:`, error);
      return false;
    }
  }

  private startMonitoring(): void {
    // Monitor all active transactions every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      const activeTransactions = await this.getAllActiveTransactions();
      
      await Promise.all(
        activeTransactions.map(tx => this.monitorSingleTransaction(tx.id))
      );
    }, 30000);

    logger.info('Bridge monitoring started');
  }

  private async monitorSingleTransaction(transactionId: string): Promise<void> {
    try {
      const status = await this.getTransactionStatus(transactionId);
      if (!status) {
        return;
      }

      // Log status updates
      if (status.status === 'completed') {
        logger.info(`Bridge transaction completed: ${transactionId}`);
      } else if (status.status === 'failed') {
        logger.warn(`Bridge transaction failed: ${transactionId} - ${status.errorMessage}`);
      }

    } catch (error) {
      logger.error(`Error monitoring transaction ${transactionId}:`, error);
    }
  }

  private async getLiFiTransactionStatus(transaction: BridgeTransaction): Promise<BridgeStatus> {
    try {
      if (!transaction.sourceHash) {
        return {
          id: transaction.id,
          status: 'pending',
          currentStep: 0,
          totalSteps: 1,
          steps: [{
            name: 'Waiting for transaction',
            status: 'pending'
          }]
        };
      }

      const status = await this.lifiIntegration.getRouteStatus(transaction.id, transaction.sourceHash);
      
      return {
        id: transaction.id,
        status: status.status,
        currentStep: status.steps.filter(s => s.status === 'completed').length,
        totalSteps: status.steps.length,
        steps: status.steps.map(step => ({
          name: step.id,
          status: step.status as any,
          txHash: step.txHash
        }))
      };

    } catch (error) {
      logger.error(`Error getting LiFi transaction status:`, error);
      return {
        id: transaction.id,
        status: 'failed',
        currentStep: 0,
        totalSteps: 1,
        steps: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getCCTPTransactionStatus(transaction: BridgeTransaction): Promise<BridgeStatus> {
    try {
      if (!transaction.metadata?.messageHash) {
        return {
          id: transaction.id,
          status: 'pending',
          currentStep: 0,
          totalSteps: 3,
          steps: [
            { name: 'Burn USDC', status: 'pending' },
            { name: 'Wait for attestation', status: 'pending' },
            { name: 'Mint USDC', status: 'pending' }
          ]
        };
      }

      const status = await this.circleCCTP.getTransferStatus(transaction.metadata.messageHash);
      
      const steps = [
        {
          name: 'Burn USDC',
          status: transaction.sourceHash ? 'completed' as const : 'pending' as const,
          txHash: transaction.sourceHash
        },
        {
          name: 'Wait for attestation',
          status: status.attestation ? 'completed' as const : 'processing' as const
        },
        {
          name: 'Mint USDC',
          status: transaction.destinationHash ? 'completed' as const : 'pending' as const,
          txHash: transaction.destinationHash
        }
      ];

      const currentStep = steps.filter(s => s.status === 'completed').length;

      return {
        id: transaction.id,
        status: status.status as any,
        currentStep,
        totalSteps: 3,
        steps,
        timeRemaining: status.estimatedCompletionTime 
          ? Math.max(0, status.estimatedCompletionTime - Date.now()) / 1000
          : undefined
      };

    } catch (error) {
      logger.error(`Error getting CCTP transaction status:`, error);
      return {
        id: transaction.id,
        status: 'failed',
        currentStep: 0,
        totalSteps: 3,
        steps: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getNativeTransactionStatus(transaction: BridgeTransaction): Promise<BridgeStatus> {
    try {
      // For native bridges, check transaction receipts directly
      const sourceProvider = await this.chainManager.getProvider(transaction.sourceChain);
      const destinationProvider = await this.chainManager.getProvider(transaction.destinationChain);

      const steps = [];
      let currentStep = 0;

      // Check source transaction
      if (transaction.sourceHash) {
        try {
          const sourceReceipt = await sourceProvider.getTransactionReceipt(transaction.sourceHash);
          steps.push({
            name: 'Source transaction',
            status: sourceReceipt ? 'completed' as const : 'processing' as const,
            txHash: transaction.sourceHash
          });
          if (sourceReceipt) currentStep++;
        } catch (error) {
          steps.push({
            name: 'Source transaction',
            status: 'failed' as const,
            txHash: transaction.sourceHash
          });
        }
      }

      // Check destination transaction
      if (transaction.destinationHash) {
        try {
          const destReceipt = await destinationProvider.getTransactionReceipt(transaction.destinationHash);
          steps.push({
            name: 'Destination transaction',
            status: destReceipt ? 'completed' as const : 'processing' as const,
            txHash: transaction.destinationHash
          });
          if (destReceipt) currentStep++;
        } catch (error) {
          steps.push({
            name: 'Destination transaction',
            status: 'failed' as const,
            txHash: transaction.destinationHash
          });
        }
      }

      const isCompleted = currentStep === steps.length && steps.length > 0;
      const hasFailed = steps.some(s => s.status === 'failed');

      return {
        id: transaction.id,
        status: hasFailed ? 'failed' : (isCompleted ? 'completed' : 'processing'),
        currentStep,
        totalSteps: Math.max(steps.length, 2),
        steps
      };

    } catch (error) {
      logger.error(`Error getting native transaction status:`, error);
      return {
        id: transaction.id,
        status: 'failed',
        currentStep: 0,
        totalSteps: 2,
        steps: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getCutoffTime(timeframe: '24h' | '7d' | '30d'): Date {
    const now = new Date();
    switch (timeframe) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('Bridge monitoring stopped');
  }
}
