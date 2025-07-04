import { Request, Response } from 'express';
import { CardIntegration } from '../services/metamask/CardIntegration';
import { DTKService } from '../services/metamask/DTKService';
import { SpendingTracker } from '../services/metamask/SpendingTracker';
import { BalanceManager } from '../services/metamask/BalanceManager';
import { Portfolio } from '../models/Portfolio';
import { Transaction } from '../models/Transaction';
import { logger } from '../utils/logger';

export class CardController {
  private cardIntegration: CardIntegration;
  private dtkService: DTKService;
  private spendingTracker: SpendingTracker;
  private balanceManager: BalanceManager;

  constructor() {
    this.cardIntegration = new CardIntegration();
    this.dtkService = new DTKService();
    this.spendingTracker = new SpendingTracker();
    this.balanceManager = new BalanceManager();
  }

  async trackSpending(req: Request, res: Response): Promise<Response> {
    try {
      const { address } = req.params;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: address.toLowerCase() }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const spendingData = await this.spendingTracker.getSpendingAnalytics(address);
      
      const analysis = {
        dailyAverage: spendingData.dailyAverage,
        weeklyAverage: spendingData.weeklyAverage,
        monthlyTotal: spendingData.monthlyTotal,
        largestTransaction: spendingData.largestTransaction,
        categories: spendingData.categories,
        trends: spendingData.trends,
        predictedNextWeek: spendingData.predictedNextWeek,
        recommendedReserve: Math.max(
          spendingData.weeklyAverage * 1.5,
          parseFloat(portfolio.cardLiquidityReserve)
        )
      };

      return res.json({
        success: true,
        spendingAnalysis: analysis,
        currentReserve: portfolio.cardLiquidityReserve,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Track spending error:', error);
      return res.status(500).json({ error: 'Failed to track spending' });
    }
  }

  async setupAutomation(req: Request, res: Response): Promise<Response> {
    try {
      const { 
        walletAddress, 
        automationType, 
        preferences 
      } = req.body;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: walletAddress.toLowerCase() }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      let delegationResult;

      switch (automationType) {
        case 'rebalancing':
          delegationResult = await this.dtkService.setupRebalancingDelegation(
            walletAddress,
            preferences
          );
          break;
        
        case 'topup':
          delegationResult = await this.dtkService.setupTopUpDelegation(
            walletAddress,
            preferences
          );
          break;
        
        case 'liquidityManagement':
          delegationResult = await this.dtkService.setupLiquidityManagementDelegation(
            walletAddress,
            preferences
          );
          break;
        
        default:
          return res.status(400).json({ error: 'Invalid automation type' });
      }

      if (delegationResult.success) {
        // Update portfolio settings
        await portfolio.update({
          autoRebalanceEnabled: automationType === 'rebalancing' ? true : portfolio.autoRebalanceEnabled
        });

        logger.info(`${automationType} automation setup for ${walletAddress}`);

        return res.json({
          success: true,
          automation: {
            type: automationType,
            delegationId: delegationResult.delegationId,
            status: 'active',
            preferences: preferences
          }
        });
      } else {
        return res.status(500).json({
          error: 'Failed to setup automation',
          reason: delegationResult.error
        });
      }

    } catch (error) {
      logger.error('Setup automation error:', error);
      return res.status(500).json({ error: 'Failed to setup automation' });
    }
  }

  async getCardBalance(req: Request, res: Response): Promise<Response> {
    try {
      const { address } = req.params;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: address.toLowerCase() }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const balanceData = await this.balanceManager.getCardBalance(address);
      
      return res.json({
        success: true,
        balance: {
          available: balanceData.available,
          reserved: portfolio.cardLiquidityReserve,
          total: parseFloat(balanceData.available) + parseFloat(portfolio.cardLiquidityReserve),
          currency: 'USDC',
          lastUpdated: balanceData.lastUpdated
        }
      });

    } catch (error) {
      logger.error('Get card balance error:', error);
      return res.status(500).json({ error: 'Failed to get card balance' });
    }
  }

  async getTransactionHistory(req: Request, res: Response): Promise<Response> {
    try {
      const { address } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: address.toLowerCase() }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const transactions = await Transaction.findAll({
        where: { portfolioId: portfolio.id },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      const formattedTransactions = transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        fromProtocol: tx.fromProtocol,
        toProtocol: tx.toProtocol,
        status: tx.status,
        transactionHash: tx.transactionHash,
        createdAt: tx.createdAt
      }));

      return res.json({
        success: true,
        transactions: formattedTransactions,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: transactions.length
        }
      });

    } catch (error) {
      logger.error('Get transaction history error:', error);
      return res.status(500).json({ error: 'Failed to get transaction history' });
    }
  }

  async triggerRebalance(req: Request, res: Response): Promise<Response> {
    try {
      const { address } = req.body;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: address.toLowerCase() }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      if (!portfolio.autoRebalanceEnabled) {
        return res.status(400).json({ error: 'Auto-rebalancing not enabled' });
      }

      const result = await this.cardIntegration.triggerLiquidityRebalancing(
        address,
        {
          urgency: 'high',
          reason: 'manual_trigger'
        }
      );

      if (result.success) {
        return res.json({
          success: true,
          message: 'Rebalancing triggered successfully',
          estimatedTime: result.estimatedTime,
          transactionHash: result.transactionHash
        });
      } else {
        return res.status(500).json({
          error: 'Failed to trigger rebalancing',
          reason: result.error
        });
      }

    } catch (error) {
      logger.error('Trigger rebalance error:', error);
      return res.status(500).json({ error: 'Failed to trigger rebalancing' });
    }
  }
}
