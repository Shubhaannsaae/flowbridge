import { Request, Response } from 'express';
import { YieldAggregator } from '../services/defi/YieldAggregator';
import { ProtocolScanner } from '../services/defi/ProtocolScanner';
import { Portfolio } from '../models/Portfolio';
import { YieldStrategy } from '../models/YieldStrategy';
import { logger } from '../utils/logger';

export class YieldController {
  private yieldAggregator: YieldAggregator;
  private protocolScanner: ProtocolScanner;

  constructor() {
    this.yieldAggregator = new YieldAggregator();
    this.protocolScanner = new ProtocolScanner();
  }

  async getYieldData(req: Request, res: Response): Promise<Response> {
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

      // Get current yield data for user's strategies
      const strategies = await YieldStrategy.findAll({
        where: { portfolioId: portfolio.id }
      });

      const yieldData = await Promise.all(
        strategies.map(async (strategy) => {
          const currentYield = await this.yieldAggregator.getProtocolYield(strategy.protocol);
          return {
            protocol: strategy.protocol,
            allocation: strategy.allocation,
            deployedAmount: strategy.deployedAmount,
            currentAPY: currentYield.apy,
            expectedDaily: (parseFloat(strategy.deployedAmount) * currentYield.apy) / 365 / 100,
            riskScore: currentYield.riskScore,
            tvl: currentYield.tvl,
            lastUpdated: currentYield.lastUpdated
          };
        })
      );

      const totalExpectedDaily = yieldData.reduce((sum, d) => sum + d.expectedDaily, 0);
      const weightedAPY = yieldData.reduce((sum, d) => {
        const weight = parseFloat(d.deployedAmount) / parseFloat(portfolio.totalDeposited);
        return sum + (d.currentAPY * weight);
      }, 0);

      return res.json({
        success: true,
        yieldData: {
          strategies: yieldData,
          totalExpectedDaily,
          weightedAPY,
          totalDeployed: portfolio.totalDeposited,
          cardReserve: portfolio.cardLiquidityReserve
        }
      });

    } catch (error) {
      logger.error('Get yield data error:', error);
      return res.status(500).json({ error: 'Failed to retrieve yield data' });
    }
  }

  async getAvailableProtocols(req: Request, res: Response): Promise<Response> {
    try {
      const { chain } = req.query;
      
      const protocols = await this.protocolScanner.scanAllProtocols(chain as string);
      
      const formattedProtocols = protocols.map(p => ({
        name: p.name,
        chain: p.chain,
        apy: p.currentAPY,
        tvl: p.tvl,
        riskScore: p.riskScore,
        category: p.category,
        minDeposit: p.minDeposit,
        withdrawalTime: p.withdrawalTime,
        audited: p.audited
      }));

      return res.json({
        success: true,
        protocols: formattedProtocols,
        totalProtocols: formattedProtocols.length,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get available protocols error:', error);
      return res.status(500).json({ error: 'Failed to retrieve protocols' });
    }
  }

  async getHistoricalYield(req: Request, res: Response): Promise<Response> {
    try {
      const { address, days = 30 } = req.params;
      const userId = (req as any).user.userId;

      const portfolio = await Portfolio.findOne({
        where: { userId, walletAddress: address.toLowerCase() }
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }

      const historicalData = await this.yieldAggregator.getHistoricalYield(
        portfolio.id,
        parseInt(days as string)
      );

      const processedData = historicalData.map(data => ({
        date: data.date,
        totalValue: data.totalValue,
        yieldEarned: data.yieldEarned,
        apy: data.apy,
        strategies: data.strategies
      }));

      return res.json({
        success: true,
        historicalData: processedData,
        period: `${days} days`,
        totalReturn: this.calculateTotalReturn(processedData),
        averageAPY: this.calculateAverageAPY(processedData)
      });

    } catch (error) {
      logger.error('Get historical yield error:', error);
      return res.status(500).json({ error: 'Failed to retrieve historical data' });
    }
  }

  private calculateTotalReturn(data: any[]): number {
    if (data.length < 2) return 0;
    const initial = data[0].totalValue;
    const final = data[data.length - 1].totalValue;
    return ((final - initial) / initial) * 100;
  }

  private calculateAverageAPY(data: any[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, d) => acc + d.apy, 0);
    return sum / data.length;
  }
}
