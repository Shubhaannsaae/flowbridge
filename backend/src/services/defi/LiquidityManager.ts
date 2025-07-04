import { ethers } from 'ethers';
import { LiFiIntegration } from '../crosschain/LiFiIntegration';
import { PriceFeeds } from '../data/PriceFeeds';
import { logger } from '../../utils/logger';

export interface LiquidityPool {
  protocol: string;
  chain: string;
  address: string;
  token0: string;
  token1: string;
  reserves: {
    token0: string;
    token1: string;
  };
  totalSupply: string;
  apy: number;
}

export interface LiquidityPosition {
  poolAddress: string;
  liquidity: string;
  tokensOwed0: string;
  tokensOwed1: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
}

export interface LiquidityStrategy {
  action: 'add' | 'remove' | 'rebalance';
  pool: LiquidityPool;
  amount0: string;
  amount1: string;
  minLiquidity: string;
  deadline: number;
}

export class LiquidityManager {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private lifiIntegration: LiFiIntegration;
  private priceFeeds: PriceFeeds;
  
  private uniswapV3Factory: Map<string, string> = new Map([
    ['ethereum', '0x1F98431c8aD98523631AE4a59f267346ea31F984'],
    ['polygon', '0x1F98431c8aD98523631AE4a59f267346ea31F984'],
    ['arbitrum', '0x1F98431c8aD98523631AE4a59f267346ea31F984'],
    ['optimism', '0x1F98431c8aD98523631AE4a59f267346ea31F984'],
    ['base', '0x33128a8fC17869897dcE68Ed026d694621f6FDfD']
  ]);

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
    this.lifiIntegration = new LiFiIntegration();
    this.priceFeeds = new PriceFeeds();
  }

  private initializeProviders(): void {
    const networks = {
      ethereum: process.env.ETHEREUM_RPC_URL!,
      polygon: process.env.POLYGON_RPC_URL!,
      arbitrum: process.env.ARBITRUM_RPC_URL!,
      optimism: process.env.OPTIMISM_RPC_URL!,
      base: process.env.BASE_RPC_URL!
    };

    for (const [network, rpcUrl] of Object.entries(networks)) {
      this.providers.set(network, new ethers.providers.JsonRpcProvider(rpcUrl));
    }
  }

  async findOptimalLiquidityPools(
    token0: string,
    token1: string,
    chains: string[] = ['ethereum']
  ): Promise<LiquidityPool[]> {
    try {
      const pools: LiquidityPool[] = [];

      await Promise.all(
        chains.map(async (chain) => {
          const chainPools = await this.scanUniswapV3Pools(token0, token1, chain);
          pools.push(...chainPools);
        })
      );

      // Sort by APY
      pools.sort((a, b) => b.apy - a.apy);

      logger.info(`Found ${pools.length} liquidity pools for ${token0}/${token1}`);
      return pools;

    } catch (error) {
      logger.error('Error finding optimal liquidity pools:', error);
      throw new Error('Failed to find liquidity pools');
    }
  }

  async addLiquidity(strategy: LiquidityStrategy, userAddress: string): Promise<any> {
    try {
      const provider = this.providers.get(strategy.pool.chain);
      if (!provider) {
        throw new Error(`Provider not found for chain: ${strategy.pool.chain}`);
      }

      // Get the pool contract
      const poolContract = new ethers.Contract(
        strategy.pool.address,
        [
          'function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
          'function liquidity() external view returns (uint128)',
          'function fee() external view returns (uint24)'
        ],
        provider
      );

      // Get current pool state
      const slot0 = await poolContract.slot0();
      const currentTick = slot0[1];
      const fee = await poolContract.fee();

      // Calculate position parameters
      const positionParams = await this.calculatePositionParams(
        strategy.pool,
        strategy.amount0,
        strategy.amount1,
        currentTick,
        fee
      );

      // Prepare transaction data for position manager
      const positionManagerAddress = this.getPositionManagerAddress(strategy.pool.chain);
      const positionManager = new ethers.Contract(
        positionManagerAddress,
        [
          'function mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256)) external payable returns (uint256,uint128,uint256,uint256)',
          'function increaseLiquidity((uint256,uint256,uint256,uint256,uint256,uint256)) external payable returns (uint128,uint256,uint256)'
        ],
        provider
      );

      const mintParams = {
        token0: strategy.pool.token0,
        token1: strategy.pool.token1,
        fee: fee,
        tickLower: positionParams.tickLower,
        tickUpper: positionParams.tickUpper,
        amount0Desired: strategy.amount0,
        amount1Desired: strategy.amount1,
        amount0Min: ethers.utils.parseUnits(strategy.minLiquidity, 18).div(2),
        amount1Min: ethers.utils.parseUnits(strategy.minLiquidity, 18).div(2),
        recipient: userAddress,
        deadline: strategy.deadline
      };

      // This would be executed by the user's wallet
      const transaction = await positionManager.populateTransaction.mint(mintParams);

      logger.info(`Prepared add liquidity transaction for ${strategy.pool.protocol}`);
      
      return {
        success: true,
        transaction: transaction,
        positionParams: positionParams,
        estimatedGas: '300000'
      };

    } catch (error) {
      logger.error('Error adding liquidity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async removeLiquidity(
    poolAddress: string,
    tokenId: string,
    liquidity: string,
    chain: string,
    userAddress: string
  ): Promise<any> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`Provider not found for chain: ${chain}`);
      }

      const positionManagerAddress = this.getPositionManagerAddress(chain);
      const positionManager = new ethers.Contract(
        positionManagerAddress,
        [
          'function decreaseLiquidity((uint256,uint128,uint256,uint256,uint256)) external payable returns (uint256,uint256)',
          'function collect((uint256,address,uint128,uint128)) external payable returns (uint256,uint256)',
          'function burn(uint256) external payable'
        ],
        provider
      );

      const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

      const decreaseParams = {
        tokenId: tokenId,
        liquidity: liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: deadline
      };

      const collectParams = {
        tokenId: tokenId,
        recipient: userAddress,
        amount0Max: ethers.constants.MaxUint128,
        amount1Max: ethers.constants.MaxUint128
      };

      // Prepare transactions
      const decreaseTransaction = await positionManager.populateTransaction.decreaseLiquidity(decreaseParams);
      const collectTransaction = await positionManager.populateTransaction.collect(collectParams);

      logger.info(`Prepared remove liquidity transactions for pool ${poolAddress}`);

      return {
        success: true,
        transactions: [decreaseTransaction, collectTransaction],
        estimatedGas: '400000'
      };

    } catch (error) {
      logger.error('Error removing liquidity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async rebalanceLiquidity(
    currentPosition: LiquidityPosition,
    targetPosition: LiquidityPosition,
    chain: string,
    userAddress: string
  ): Promise<any> {
    try {
      // First remove current liquidity
      const removeResult = await this.removeLiquidity(
        currentPosition.poolAddress,
        '1', // tokenId would come from position
        currentPosition.liquidity,
        chain,
        userAddress
      );

      if (!removeResult.success) {
        throw new Error('Failed to remove current liquidity');
      }

      // Calculate new position parameters based on target
      const newStrategy: LiquidityStrategy = {
        action: 'add',
        pool: await this.getPoolInfo(targetPosition.poolAddress, chain),
        amount0: targetPosition.tokensOwed0,
        amount1: targetPosition.tokensOwed1,
        minLiquidity: ethers.utils.formatUnits(targetPosition.liquidity, 18),
        deadline: Math.floor(Date.now() / 1000) + 1800
      };

      // Add new liquidity
      const addResult = await this.addLiquidity(newStrategy, userAddress);

      logger.info(`Rebalanced liquidity position for user ${userAddress}`);

      return {
        success: true,
        removeTransactions: removeResult.transactions,
        addTransaction: addResult.transaction,
        totalGas: '600000'
      };

    } catch (error) {
      logger.error('Error rebalancing liquidity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async calculateLiquidityAPY(poolAddress: string, chain: string): Promise<number> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return 0;

      // Get pool contract
      const poolContract = new ethers.Contract(
        poolAddress,
        [
          'function fee() external view returns (uint24)',
          'function liquidity() external view returns (uint128)',
          'function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
          'function token0() external view returns (address)',
          'function token1() external view returns (address)'
        ],
        provider
      );

      const fee = await poolContract.fee();
      const liquidity = await poolContract.liquidity();
      const token0 = await poolContract.token0();
      const token1 = await poolContract.token1();

      // Get 24h volume from subgraph or API
      const volume24h = await this.get24hVolume(poolAddress, chain);
      
      // Calculate fee APY
      const feeAPY = (volume24h * (fee / 1000000) * 365) / 
                    (parseFloat(ethers.utils.formatUnits(liquidity, 18)) * 2); // Assuming 2x liquidity value

      // Add any additional incentives (would query specific protocols)
      const incentiveAPY = await this.getIncentiveAPY(poolAddress, chain);

      const totalAPY = feeAPY + incentiveAPY;

      logger.info(`Calculated APY for pool ${poolAddress}: ${totalAPY.toFixed(2)}%`);
      return totalAPY;

    } catch (error) {
      logger.error(`Error calculating liquidity APY for ${poolAddress}:`, error);
      return 0;
    }
  }

  private async scanUniswapV3Pools(
    token0: string,
    token1: string,
    chain: string
  ): Promise<LiquidityPool[]> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return [];

      const factoryAddress = this.uniswapV3Factory.get(chain);
      if (!factoryAddress) return [];

      const factory = new ethers.Contract(
        factoryAddress,
        [
          'function getPool(address,address,uint24) external view returns (address)'
        ],
        provider
      );

      const pools: LiquidityPool[] = [];
      const fees = [100, 500, 3000, 10000]; // Common fee tiers

      await Promise.all(
        fees.map(async (fee) => {
          try {
            const poolAddress = await factory.getPool(token0, token1, fee);
            
            if (poolAddress !== ethers.constants.AddressZero) {
              const poolInfo = await this.getPoolInfo(poolAddress, chain);
              if (poolInfo) {
                pools.push(poolInfo);
              }
            }
          } catch (error) {
            logger.warn(`Error getting pool for fee ${fee}:`, error);
          }
        })
      );

      return pools;

    } catch (error) {
      logger.error(`Error scanning Uniswap V3 pools on ${chain}:`, error);
      return [];
    }
  }

  private async getPoolInfo(poolAddress: string, chain: string): Promise<LiquidityPool | null> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return null;

      const poolContract = new ethers.Contract(
        poolAddress,
        [
          'function token0() external view returns (address)',
          'function token1() external view returns (address)',
          'function fee() external view returns (uint24)',
          'function liquidity() external view returns (uint128)',
          'function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)'
        ],
        provider
      );

      const [token0, token1, fee, liquidity, slot0] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.liquidity(),
        poolContract.slot0()
      ]);

      const apy = await this.calculateLiquidityAPY(poolAddress, chain);

      return {
        protocol: 'Uniswap V3',
        chain: chain,
        address: poolAddress,
        token0: token0,
        token1: token1,
        reserves: {
          token0: liquidity.toString(),
          token1: liquidity.toString()
        },
        totalSupply: liquidity.toString(),
        apy: apy
      };

    } catch (error) {
      logger.error(`Error getting pool info for ${poolAddress}:`, error);
      return null;
    }
  }

  private async calculatePositionParams(
    pool: LiquidityPool,
    amount0: string,
    amount1: string,
    currentTick: number,
    fee: number
  ): Promise<any> {
    // Calculate tick range based on fee tier
    const tickSpacing = this.getTickSpacing(fee);
    const tickLower = Math.floor(currentTick / tickSpacing) * tickSpacing - tickSpacing * 10;
    const tickUpper = Math.ceil(currentTick / tickSpacing) * tickSpacing + tickSpacing * 10;

    return {
      tickLower,
      tickUpper,
      tickSpacing
    };
  }

  private getTickSpacing(fee: number): number {
    switch (fee) {
      case 100: return 1;
      case 500: return 10;
      case 3000: return 60;
      case 10000: return 200;
      default: return 60;
    }
  }

  private getPositionManagerAddress(chain: string): string {
    const addresses: Record<string, string> = {
      ethereum: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      polygon: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      arbitrum: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      optimism: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      base: '0x03a520b32C04BF3bEEf7BF5d0Fa94d84e9cC6F86'
    };
    return addresses[chain] || addresses.ethereum;
  }

  private async get24hVolume(poolAddress: string, chain: string): Promise<number> {
    try {
      // This would query The Graph or similar service for 24h volume
      // For now, return a reasonable estimate
      return 1000000; // $1M daily volume
    } catch (error) {
      logger.warn(`Error getting 24h volume for ${poolAddress}:`, error);
      return 0;
    }
  }

  private async getIncentiveAPY(poolAddress: string, chain: string): Promise<number> {
    try {
      // This would query protocol-specific incentive programs
      // For now, return 0
      return 0;
    } catch (error) {
      logger.warn(`Error getting incentive APY for ${poolAddress}:`, error);
      return 0;
    }
  }
}
