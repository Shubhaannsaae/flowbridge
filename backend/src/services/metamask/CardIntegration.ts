import { MetaMaskSDK } from '@metamask/sdk';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';

export interface CardTransaction {
  id: string;
  amount: string;
  currency: string;
  merchant: string;
  category: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  type: 'purchase' | 'refund' | 'fee';
  cardId: string;
  location?: string;
  metadata?: any;
}

export interface CardBalance {
  available: string;
  pending: string;
  total: string;
  currency: string;
  lastUpdated: Date;
}

export interface SpendingPattern {
  dailyAverage: number;
  weeklyAverage: number;
  monthlyTotal: number;
  categoryBreakdown: Record<string, number>;
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentage: number;
  };
  predictedNextWeek: number;
  requiresRebalancing: boolean;
}

export class CardIntegration {
  private sdk: MetaMaskSDK;
  private provider: ethers.providers.Web3Provider | null = null;

  constructor() {
    this.sdk = new MetaMaskSDK({
      dappMetadata: {
        name: 'FlowBridge - AI Yield Optimizer',
        url: process.env.FRONTEND_URL || 'https://flowbridge.app',
        iconUrl: `${process.env.FRONTEND_URL}/favicon.ico`,
        base64Icon: undefined
      },
      modals: {
        install: ({ link }) => ({ link }),
        otp: () => ({})
      },
      logging: {
        developerMode: process.env.NODE_ENV === 'development',
        sdk: process.env.NODE_ENV === 'development'
      },
      checkInstallationImmediately: false,
      preferDesktop: true
    });
  }

  async connectWallet(): Promise<string[]> {
    try {
      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      this.provider = new ethers.providers.Web3Provider(ethereum as any);
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      logger.info(`MetaMask wallet connected: ${accounts[0]}`);
      return accounts;

    } catch (error) {
      logger.error('Error connecting MetaMask wallet:', error);
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCardTransactions(
    userAddress: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 50
  ): Promise<CardTransaction[]> {
    try {
      if (!this.provider) {
        await this.connectWallet();
      }

      // Get MetaMask Card transactions through the SDK
      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      // Request card transaction data from MetaMask
      const cardData = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: 'npm:@metamask/card-snap',
          request: {
            method: 'getTransactions',
            params: {
              address: userAddress,
              fromDate: fromDate?.toISOString(),
              toDate: toDate?.toISOString(),
              limit
            }
          }
        }
      }) as any;

      if (!cardData || !cardData.transactions) {
        return [];
      }

      const transactions: CardTransaction[] = cardData.transactions.map((tx: any) => ({
        id: tx.id,
        amount: tx.amount.toString(),
        currency: tx.currency || 'USD',
        merchant: tx.merchant || 'Unknown',
        category: tx.category || 'Other',
        timestamp: new Date(tx.timestamp),
        status: tx.status || 'completed',
        type: tx.type || 'purchase',
        cardId: tx.cardId,
        location: tx.location,
        metadata: tx.metadata
      }));

      logger.info(`Retrieved ${transactions.length} card transactions for ${userAddress}`);
      return transactions;

    } catch (error) {
      logger.error('Error getting card transactions:', error);
      throw new Error(`Failed to get card transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCardBalance(userAddress: string): Promise<CardBalance> {
    try {
      if (!this.provider) {
        await this.connectWallet();
      }

      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      // Request card balance from MetaMask
      const balanceData = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: 'npm:@metamask/card-snap',
          request: {
            method: 'getBalance',
            params: {
              address: userAddress
            }
          }
        }
      }) as any;

      if (!balanceData) {
        throw new Error('No balance data received');
      }

      const balance: CardBalance = {
        available: balanceData.available?.toString() || '0',
        pending: balanceData.pending?.toString() || '0',
        total: balanceData.total?.toString() || '0',
        currency: balanceData.currency || 'USD',
        lastUpdated: new Date()
      };

      logger.info(`Retrieved card balance for ${userAddress}: $${balance.available}`);
      return balance;

    } catch (error) {
      logger.error('Error getting card balance:', error);
      throw new Error(`Failed to get card balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeSpendingPattern(userAddress: string): Promise<SpendingPattern> {
    try {
      const transactions = await this.getCardTransactions(
        userAddress,
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        new Date()
      );

      if (transactions.length === 0) {
        return {
          dailyAverage: 0,
          weeklyAverage: 0,
          monthlyTotal: 0,
          categoryBreakdown: {},
          trends: { direction: 'stable', percentage: 0 },
          predictedNextWeek: 0,
          requiresRebalancing: false
        };
      }

      // Calculate spending metrics
      const purchaseTransactions = transactions.filter(tx => tx.type === 'purchase' && tx.status === 'completed');
      const totalSpent = purchaseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      const daysAnalyzed = Math.min(90, (Date.now() - Math.min(...purchaseTransactions.map(tx => tx.timestamp.getTime()))) / (24 * 60 * 60 * 1000));
      
      const dailyAverage = totalSpent / daysAnalyzed;
      const weeklyAverage = dailyAverage * 7;
      const monthlyTotal = dailyAverage * 30;

      // Category breakdown
      const categoryBreakdown: Record<string, number> = {};
      purchaseTransactions.forEach(tx => {
        categoryBreakdown[tx.category] = (categoryBreakdown[tx.category] || 0) + parseFloat(tx.amount);
      });

      // Calculate trends (compare last 30 days to previous 30 days)
      const last30Days = purchaseTransactions.filter(tx => 
        tx.timestamp >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      const previous30Days = purchaseTransactions.filter(tx => 
        tx.timestamp >= new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) &&
        tx.timestamp < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      const last30Total = last30Days.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      const previous30Total = previous30Days.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (previous30Total > 0) {
        trendPercentage = ((last30Total - previous30Total) / previous30Total) * 100;
        if (Math.abs(trendPercentage) > 5) {
          trendDirection = trendPercentage > 0 ? 'increasing' : 'decreasing';
        }
      }

      // Predict next week spending
      const predictedNextWeek = weeklyAverage * (1 + (trendPercentage / 100));

      // Check if rebalancing is required (if predicted spending > 80% of available balance)
      const balance = await this.getCardBalance(userAddress);
      const requiresRebalancing = predictedNextWeek > (parseFloat(balance.available) * 0.8);

      const pattern: SpendingPattern = {
        dailyAverage,
        weeklyAverage,
        monthlyTotal,
        categoryBreakdown,
        trends: {
          direction: trendDirection,
          percentage: Math.abs(trendPercentage)
        },
        predictedNextWeek,
        requiresRebalancing
      };

      logger.info(`Analyzed spending pattern for ${userAddress}: $${dailyAverage.toFixed(2)}/day average`);
      return pattern;

    } catch (error) {
      logger.error('Error analyzing spending pattern:', error);
      throw new Error(`Failed to analyze spending pattern: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async triggerLiquidityRebalancing(
    userAddress: string,
    options: {
      urgency: 'low' | 'medium' | 'high';
      reason: string;
    }
  ): Promise<{
    success: boolean;
    estimatedTime?: number;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      if (!this.provider) {
        await this.connectWallet();
      }

      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      // Trigger rebalancing through MetaMask Card
      const result = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: 'npm:@metamask/card-snap',
          request: {
            method: 'triggerRebalancing',
            params: {
              address: userAddress,
              urgency: options.urgency,
              reason: options.reason
            }
          }
        }
      }) as any;

      if (result && result.success) {
        logger.info(`Liquidity rebalancing triggered for ${userAddress}: ${options.reason}`);
        return {
          success: true,
          estimatedTime: result.estimatedTime || 300, // 5 minutes default
          transactionHash: result.transactionHash
        };
      } else {
        return {
          success: false,
          error: result?.error || 'Rebalancing failed'
        };
      }

    } catch (error) {
      logger.error('Error triggering liquidity rebalancing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCardLimits(userAddress: string): Promise<{
    daily: { current: number; limit: number };
    monthly: { current: number; limit: number };
    perTransaction: { limit: number };
  }> {
    try {
      if (!this.provider) {
        await this.connectWallet();
      }

      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      const limitsData = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: 'npm:@metamask/card-snap',
          request: {
            method: 'getLimits',
            params: {
              address: userAddress
            }
          }
        }
      }) as any;

      return {
        daily: {
          current: limitsData?.daily?.current || 0,
          limit: limitsData?.daily?.limit || 1000
        },
        monthly: {
          current: limitsData?.monthly?.current || 0,
          limit: limitsData?.monthly?.limit || 10000
        },
        perTransaction: {
          limit: limitsData?.perTransaction?.limit || 500
        }
      };

    } catch (error) {
      logger.error('Error getting card limits:', error);
      throw new Error(`Failed to get card limits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async requestCardTopUp(
    userAddress: string,
    amount: string,
    source: 'yield' | 'manual'
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    estimatedTime?: number;
    error?: string;
  }> {
    try {
      if (!this.provider) {
        await this.connectWallet();
      }

      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      const result = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: 'npm:@metamask/card-snap',
          request: {
            method: 'requestTopUp',
            params: {
              address: userAddress,
              amount,
              source
            }
          }
        }
      }) as any;

      if (result && result.success) {
        logger.info(`Card top-up requested for ${userAddress}: $${amount} from ${source}`);
        return {
          success: true,
          transactionHash: result.transactionHash,
          estimatedTime: result.estimatedTime || 180 // 3 minutes default
        };
      } else {
        return {
          success: false,
          error: result?.error || 'Top-up request failed'
        };
      }

    } catch (error) {
      logger.error('Error requesting card top-up:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async subscribeToCardEvents(
    userAddress: string,
    callback: (event: {
      type: 'transaction' | 'balance_update' | 'limit_change';
      data: any;
    }) => void
  ): Promise<void> {
    try {
      if (!this.provider) {
        await this.connectWallet();
      }

      const ethereum = this.sdk.getProvider();
      if (!ethereum) {
        throw new Error('MetaMask provider not available');
      }

      // Subscribe to card events
      await ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: 'npm:@metamask/card-snap',
          request: {
            method: 'subscribeToEvents',
            params: {
              address: userAddress,
              events: ['transaction', 'balance_update', 'limit_change']
            }
          }
        }
      });

      // Set up event listener
      ethereum.on('message', (message: any) => {
        if (message.type === 'card_event' && message.data.address === userAddress) {
          callback({
            type: message.data.eventType,
            data: message.data.eventData
          });
        }
      });

      logger.info(`Subscribed to card events for ${userAddress}`);

    } catch (error) {
      logger.error('Error subscribing to card events:', error);
      throw new Error(`Failed to subscribe to card events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.sdk) {
        await this.sdk.terminate();
        this.provider = null;
        logger.info('MetaMask SDK disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting MetaMask SDK:', error);
    }
  }
}
