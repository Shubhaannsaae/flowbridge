import { Request, Response } from 'express';
import { Portfolio } from '../models/Portfolio';
import { YieldStrategy } from '../models/YieldStrategy';
import { YieldOptimizer } from '../services/ai/YieldOptimizer';
import { RebalancingEngine } from '../services/defi/RebalancingEngine';
import { logger } from '../utils/logger';

export class PortfolioController {
  private yieldOptimizer: YieldOptimizer;
  private rebalancingEngine: RebalancingEngine;

  constructor() {
    this.yieldOptimizer = new YieldOptimizer();
    this.rebalancingEngine = new RebalancingEngine();
  }

  async getPortfolio(req: Request, res: Response): Promise<Response> {
    try {
      const { address } = req.params;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: address.toLowerCase() },
        include: [YieldStrategy]
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const strategies = await YieldStrategy.findAll({
        where: { portfolioId: portfolio.id }
      });

      const totalValue = await this.calculateTotalValue(portfolio);
      const totalYield = await this.calculateTotalYield(portfolio);

      return res.json({
        success: true,
        portfolio: {
          id: portfolio.id,
          walletAddress: portfolio.walletAddress,
          totalDeposited: portfolio.totalDeposited,
          totalValue: totalValue,
          totalYield: totalYield,
          cardLiquidityReserve: portfolio.cardLiquidityReserve,
          riskLevel: portfolio.riskLevel,
          autoRebalanceEnabled: portfolio.autoRebalanceEnabled,
          strategies: strategies.map(s => ({
            id: s.id,
            protocol: s.protocol,
            allocation: s.allocation,
            currentAPY: s.currentAPY,
            riskScore: s.riskScore,
            deployedAmount: s.deployedAmount
          }))
        }
      });

    } catch (error) {
      logger.error('Get portfolio error:', error);
      return res.status(500).json({ error: 'Failed to retrieve portfolio' });
    }
  }

  async createPortfolio(req: Request, res: Response): Promise<Response> {
    try {
      const { walletAddress, riskLevel, cardLiquidityReserve } = req.body;
      const userId = (req as any).user.userId;

      const existingPortfolio = await Portfolio.findOne({
        where: { userId, walletAddress: walletAddress.toLowerCase() }
      });

      if (existingPortfolio) {
        return res.status(400).json({ error: 'Portfolio already exists for this address' });
      }

      const portfolio = await Portfolio.create({
        userId,
        walletAddress: walletAddress.toLowerCase(),
        totalDeposited: '0',
        cardLiquidityReserve: cardLiquidityReserve || '100',
        riskLevel: riskLevel || 5,
        autoRebalanceEnabled: false,
        createdAt: new Date()
      });

      logger.info(`Portfolio created for user ${userId}, address ${walletAddress}`);

      return res.status(201).json({
        success: true,
        portfolio: {
          id: portfolio.id,
          walletAddress: portfolio.walletAddress,
          riskLevel: portfolio.riskLevel,
          cardLiquidityReserve: portfolio.cardLiquidityReserve
        }
      });

    } catch (error) {
      logger.error('Create portfolio error:', error);
      return res.status(500).json({ error: 'Failed to create portfolio' });
    }
  }

  async rebalance(req: Request, res: Response): Promise<Response> {
    try {
      const { portfolioId } = req.body;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { id: portfolioId, userId }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      // Get AI optimization recommendation
      const optimization = await this.yieldOptimizer.optimizePortfolio(
        portfolio.walletAddress,
        {
          riskLevel: portfolio.riskLevel,
          cardLiquidityReserve: parseFloat(portfolio.cardLiquidityReserve),
          minImprovementThreshold: 0.01 // 1% minimum improvement
        }
      );

      if (optimization.status === 'no_action_needed') {
        return res.json({
          success: true,
          message: 'No rebalancing needed',
          reason: optimization.reason
        });
      }

      // Execute rebalancing
      const result = await this.rebalancingEngine.executeRebalancing(
        portfolio.walletAddress,
        optimization.strategy
      );

      if (result.success) {
        // Update portfolio strategies
        await this.updatePortfolioStrategies(portfolio.id, optimization.strategy);
        
        logger.info(`Portfolio rebalanced successfully for ${portfolio.walletAddress}`);

        return res.json({
          success: true,
          message: 'Portfolio rebalanced successfully',
          expectedImprovement: optimization.expectedImprovement,
          transactionHash: result.transactionHash
        });
      } else {
        return res.status(500).json({
          error: 'Rebalancing failed',
          reason: result.error
        });
      }

    } catch (error) {
      logger.error('Rebalance error:', error);
      return res.status(500).json({ error: 'Rebalancing failed' });
    }
  }

  private async calculateTotalValue(portfolio: Portfolio): Promise<number> {
    const strategies = await YieldStrategy.findAll({
      where: { portfolioId: portfolio.id }
    });

    const totalDeployed = strategies.reduce((sum, s) => sum + parseFloat(s.deployedAmount), 0);
    const cardReserve = parseFloat(portfolio.cardLiquidityReserve);
    
    return totalDeployed + cardReserve;
  }

  private async calculateTotalYield(portfolio: Portfolio): Promise<number> {
    const strategies = await YieldStrategy.findAll({
      where: { portfolioId: portfolio.id }
    });

    return strategies.reduce((sum, s) => {
      const amount = parseFloat(s.deployedAmount);
      const apy = s.currentAPY / 100;
      const timeDeployed = (Date.now() - s.createdAt.getTime()) / (365 * 24 * 60 * 60 * 1000);
      return sum + (amount * apy * timeDeployed);
    }, 0);
  }

  private async updatePortfolioStrategies(portfolioId: string, newStrategies: any[]): Promise<void> {
    // Remove old strategies
    await YieldStrategy.destroy({ where: { portfolioId } });

    // Create new strategies
    const strategiesToCreate = newStrategies.map(s => ({
      portfolioId,
      protocol: s.protocol,
      allocation: s.allocation,
      currentAPY: s.expectedAPY,
      riskScore: s.riskScore,
      deployedAmount: s.amount.toString(),
      createdAt: new Date()
    }));

    await YieldStrategy.bulkCreate(strategiesToCreate);
  }
}
