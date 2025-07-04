import { LiFi, ChainId, Token, Route, RouteOptions, ConfigUpdate } from '@lifi/sdk';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';

export interface CrossChainRoute {
  id: string;
  fromChainId: ChainId;
  toChainId: ChainId;
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  estimate: {
    executionDuration: number;
    fromAmountUSD: string;
    toAmountUSD: string;
    gasCosts: Array<{
      type: string;
      price: string;
      estimate: string;
      limit: string;
    }>;
  };
  steps: Array<{
    type: string;
    tool: string;
    action: any;
    estimate: any;
  }>;
}

export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  route?: Route;
  error?: string;
  status?: string;
}

export class LiFiIntegration {
  private lifi: LiFi;
  private providers: Map<ChainId, ethers.providers.JsonRpcProvider>;

  constructor() {
    // Initialize LI.FI SDK with production configuration
    this.lifi = new LiFi({
      integrator: 'flowbridge-metamask-hackathon',
      apiUrl: 'https://li.quest/v1',
      rpcs: {
        [ChainId.ETH]: [process.env.ETHEREUM_RPC_URL!],
        [ChainId.POL]: [process.env.POLYGON_RPC_URL!],
        [ChainId.ARB]: [process.env.ARBITRUM_RPC_URL!],
        [ChainId.OPT]: [process.env.OPTIMISM_RPC_URL!],
        [ChainId.BAS]: [process.env.BASE_RPC_URL!],
        [ChainId.AVA]: [process.env.AVALANCHE_RPC_URL!]
      }
    });

    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const rpcUrls = {
      [ChainId.ETH]: process.env.ETHEREUM_RPC_URL!,
      [ChainId.POL]: process.env.POLYGON_RPC_URL!,
      [ChainId.ARB]: process.env.ARBITRUM_RPC_URL!,
      [ChainId.OPT]: process.env.OPTIMISM_RPC_URL!,
      [ChainId.BAS]: process.env.BASE_RPC_URL!,
      [ChainId.AVA]: process.env.AVALANCHE_RPC_URL!
    };

    for (const [chainId, rpcUrl] of Object.entries(rpcUrls)) {
      this.providers.set(parseInt(chainId) as ChainId, new ethers.providers.JsonRpcProvider(rpcUrl));
    }
  }

  async findOptimalRoute(
    fromChainId: ChainId,
    toChainId: ChainId,
    fromToken: Token,
    toToken: Token,
    amount: string,
    options?: Partial<RouteOptions>
  ): Promise<CrossChainRoute | null> {
    try {
      const routeOptions: RouteOptions = {
        slippage: options?.slippage || 0.03, // 3% default slippage
        order: options?.order || 'RECOMMENDED',
        allowSwitchChain: options?.allowSwitchChain ?? true,
        integrator: 'flowbridge-metamask-hackathon',
        ...options
      };

      const routeRequest = {
        fromChainId,
        toChainId,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromAmount: amount,
        options: routeOptions
      };

      logger.info(`Finding route from ${fromChainId} to ${toChainId} for ${amount} ${fromToken.symbol}`);

      const result = await this.lifi.getRoutes(routeRequest);

      if (!result.routes || result.routes.length === 0) {
        logger.warn('No routes found for the given parameters');
        return null;
      }

      // Select the best route based on criteria
      const bestRoute = this.selectBestRoute(result.routes);

      const crossChainRoute: CrossChainRoute = {
        id: bestRoute.id,
        fromChainId: bestRoute.fromChainId,
        toChainId: bestRoute.toChainId,
        fromToken: bestRoute.fromToken,
        toToken: bestRoute.toToken,
        fromAmount: bestRoute.fromAmount,
        toAmount: bestRoute.toAmount,
        estimate: {
          executionDuration: bestRoute.estimate.executionDuration,
          fromAmountUSD: bestRoute.estimate.fromAmountUSD,
          toAmountUSD: bestRoute.estimate.toAmountUSD,
          gasCosts: bestRoute.estimate.gasCosts
        },
        steps: bestRoute.steps.map(step => ({
          type: step.type,
          tool: step.tool,
          action: step.action,
          estimate: step.estimate
        }))
      };

      logger.info(`Found optimal route: ${bestRoute.id} with ${bestRoute.steps.length} steps`);
      return crossChainRoute;

    } catch (error) {
      logger.error('Error finding optimal route:', error);
      return null;
    }
  }

  async executeRoute(
    route: CrossChainRoute,
    signer: ethers.Signer,
    options?: {
      updateCallback?: (update: any) => void;
      infiniteApproval?: boolean;
    }
  ): Promise<ExecutionResult> {
    try {
      logger.info(`Executing cross-chain route: ${route.id}`);

      // Convert back to LI.FI Route format
      const lifiRoute: Route = {
        id: route.id,
        fromChainId: route.fromChainId,
        toChainId: route.toChainId,
        fromToken: route.fromToken,
        toToken: route.toToken,
        fromAmount: route.fromAmount,
        toAmount: route.toAmount,
        estimate: route.estimate as any,
        steps: route.steps as any
      };

      const execution = await this.lifi.executeRoute({
        route: lifiRoute,
        signer,
        updateCallback: options?.updateCallback || ((update) => {
          logger.info(`Route execution update:`, update);
        }),
        infiniteApproval: options?.infiniteApproval || false
      });

      logger.info(`Route execution completed successfully: ${execution.transactionHash}`);

      return {
        success: true,
        transactionHash: execution.transactionHash,
        route: lifiRoute,
        status: 'completed'
      };

    } catch (error) {
      logger.error('Error executing route:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        status: 'failed'
      };
    }
  }

  async getRouteStatus(routeId: string, txHash: string): Promise<{
    status: string;
    steps: Array<{
      id: string;
      status: string;
      txHash?: string;
    }>;
  }> {
    try {
      const status = await this.lifi.getStatus({
        txHash,
        bridge: 'across', // This would be determined by the route
        fromChain: ChainId.ETH, // This would come from route data
        toChain: ChainId.POL // This would come from route data
      });

      return {
        status: status.status,
        steps: status.substatus?.map(sub => ({
          id: sub.id || '',
          status: sub.status,
          txHash: sub.txHash
        })) || []
      };

    } catch (error) {
      logger.error(`Error getting route status for ${routeId}:`, error);
      return {
        status: 'unknown',
        steps: []
      };
    }
  }

  async getSupportedChains(): Promise<Array<{
    id: ChainId;
    name: string;
    nativeToken: Token;
    metamask?: {
      chainId: string;
      chainName: string;
      nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
      };
      rpcUrls: string[];
      blockExplorerUrls: string[];
    };
  }>> {
    try {
      const chains = await this.lifi.getChains();
      
      return chains.map(chain => ({
        id: chain.id,
        name: chain.name,
        nativeToken: chain.nativeToken,
        metamask: chain.metamask
      }));

    } catch (error) {
      logger.error('Error getting supported chains:', error);
      return [];
    }
  }

  async getSupportedTokens(chainId: ChainId): Promise<Token[]> {
    try {
      const tokens = await this.lifi.getTokens({ chains: [chainId] });
      return tokens.tokens[chainId] || [];

    } catch (error) {
      logger.error(`Error getting supported tokens for chain ${chainId}:`, error);
      return [];
    }
  }

  async getTokenBalances(
    walletAddress: string,
    chainId: ChainId,
    tokenAddresses?: string[]
  ): Promise<Array<{
    token: Token;
    balance: string;
    balanceUSD: string;
  }>> {
    try {
      const balances = await this.lifi.getTokenBalances(walletAddress, {
        chains: [chainId],
        tokens: tokenAddresses
      });

      return balances.map(balance => ({
        token: balance.token,
        balance: balance.amount,
        balanceUSD: balance.amountUSD || '0'
      }));

    } catch (error) {
      logger.error(`Error getting token balances for ${walletAddress}:`, error);
      return [];
    }
  }

  async estimateGasCosts(route: CrossChainRoute): Promise<{
    totalGasCostUSD: string;
    stepGasCosts: Array<{
      stepIndex: number;
      gasCostUSD: string;
      gasLimit: string;
      gasPrice: string;
    }>;
  }> {
    try {
      let totalCost = 0;
      const stepCosts = [];

      for (let i = 0; i < route.estimate.gasCosts.length; i++) {
        const gasCost = route.estimate.gasCosts[i];
        const costUSD = parseFloat(gasCost.estimate);
        totalCost += costUSD;

        stepCosts.push({
          stepIndex: i,
          gasCostUSD: gasCost.estimate,
          gasLimit: gasCost.limit,
          gasPrice: gasCost.price
        });
      }

      return {
        totalGasCostUSD: totalCost.toString(),
        stepGasCosts: stepCosts
      };

    } catch (error) {
      logger.error('Error estimating gas costs:', error);
      return {
        totalGasCostUSD: '0',
        stepGasCosts: []
      };
    }
  }

  async findCheapestRoute(
    fromChainId: ChainId,
    toChainId: ChainId,
    fromToken: Token,
    toToken: Token,
    amount: string
  ): Promise<CrossChainRoute | null> {
    try {
      const routes = await this.lifi.getRoutes({
        fromChainId,
        toChainId,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromAmount: amount,
        options: {
          order: 'CHEAPEST',
          slippage: 0.03
        }
      });

      if (!routes.routes || routes.routes.length === 0) {
        return null;
      }

      // Return the cheapest route (first one when ordered by CHEAPEST)
      const cheapestRoute = routes.routes[0];
      
      return {
        id: cheapestRoute.id,
        fromChainId: cheapestRoute.fromChainId,
        toChainId: cheapestRoute.toChainId,
        fromToken: cheapestRoute.fromToken,
        toToken: cheapestRoute.toToken,
        fromAmount: cheapestRoute.fromAmount,
        toAmount: cheapestRoute.toAmount,
        estimate: cheapestRoute.estimate as any,
        steps: cheapestRoute.steps as any
      };

    } catch (error) {
      logger.error('Error finding cheapest route:', error);
      return null;
    }
  }

  async findFastestRoute(
    fromChainId: ChainId,
    toChainId: ChainId,
    fromToken: Token,
    toToken: Token,
    amount: string
  ): Promise<CrossChainRoute | null> {
    try {
      const routes = await this.lifi.getRoutes({
        fromChainId,
        toChainId,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromAmount: amount,
        options: {
          order: 'FASTEST',
          slippage: 0.03
        }
      });

      if (!routes.routes || routes.routes.length === 0) {
        return null;
      }

      const fastestRoute = routes.routes[0];
      
      return {
        id: fastestRoute.id,
        fromChainId: fastestRoute.fromChainId,
        toChainId: fastestRoute.toChainId,
        fromToken: fastestRoute.fromToken,
        toToken: fastestRoute.toToken,
        fromAmount: fastestRoute.fromAmount,
        toAmount: fastestRoute.toAmount,
        estimate: fastestRoute.estimate as any,
        steps: fastestRoute.steps as any
      };

    } catch (error) {
      logger.error('Error finding fastest route:', error);
      return null;
    }
  }

  private selectBestRoute(routes: Route[]): Route {
    // Score routes based on multiple factors
    const scoredRoutes = routes.map(route => {
      let score = 0;

      // Factor 1: Execution time (lower is better)
      const timeScore = 100 - Math.min(route.estimate.executionDuration / 60, 100);
      score += timeScore * 0.3;

      // Factor 2: Gas costs (lower is better)
      const totalGasCost = route.estimate.gasCosts.reduce((sum, cost) => {
        return sum + parseFloat(cost.estimate || '0');
      }, 0);
      const gasScore = 100 - Math.min(totalGasCost / 10, 100);
      score += gasScore * 0.4;

      // Factor 3: Output amount (higher is better)
      const outputScore = (parseFloat(route.toAmount) / parseFloat(route.fromAmount)) * 100;
      score += Math.min(outputScore, 100) * 0.3;

      return { route, score };
    });

    // Return the highest scoring route
    const bestScoredRoute = scoredRoutes.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return bestScoredRoute.route;
  }

  async getAvailableBridges(fromChainId: ChainId, toChainId: ChainId): Promise<Array<{
    name: string;
    key: string;
    supportedChains: ChainId[];
    fees: {
      min: string;
      max: string;
    };
  }>> {
    try {
      const tools = await this.lifi.getTools();
      
      return tools.bridges
        .filter(bridge => 
          bridge.supportedChains.includes(fromChainId) && 
          bridge.supportedChains.includes(toChainId)
        )
        .map(bridge => ({
          name: bridge.name,
          key: bridge.key,
          supportedChains: bridge.supportedChains,
          fees: {
            min: bridge.fees?.min || '0',
            max: bridge.fees?.max || '0'
          }
        }));

    } catch (error) {
      logger.error('Error getting available bridges:', error);
      return [];
    }
  }

  async updateRouteConfig(config: Partial<ConfigUpdate>): Promise<void> {
    try {
      await this.lifi.updateConfig(config);
      logger.info('LI.FI configuration updated successfully');
    } catch (error) {
      logger.error('Error updating LI.FI configuration:', error);
      throw error;
    }
  }
}
