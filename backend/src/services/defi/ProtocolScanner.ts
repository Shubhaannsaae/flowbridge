import axios from 'axios';
import { ethers } from 'ethers';
import { logger } from '../../utils/logger';

export interface ProtocolData {
  name: string;
  chain: string;
  currentAPY: number;
  tvl: number;
  riskScore: number;
  category: string;
  audited: boolean;
  launchDate: string;
  tvlChange24h: number;
  minDeposit: number;
  withdrawalTime: number;
  contractAddress: string;
  tokenAddress: string;
}

export interface ProtocolDetails extends ProtocolData {
  description: string;
  website: string;
  documentation: string;
  governance: string;
  fees: {
    deposit: number;
    withdrawal: number;
    performance: number;
  };
  security: {
    audits: string[];
    bugBounty: boolean;
    insurance: boolean;
  };
}

export class ProtocolScanner {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private defiLlamaAPI: string = 'https://api.llama.fi';
  private defiPulseAPI: string = 'https://data-api.defipulse.com/api/v1';

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const networks = {
      ethereum: process.env.ETHEREUM_RPC_URL!,
      polygon: process.env.POLYGON_RPC_URL!,
      arbitrum: process.env.ARBITRUM_RPC_URL!,
      optimism: process.env.OPTIMISM_RPC_URL!,
      base: process.env.BASE_RPC_URL!,
      avalanche: process.env.AVALANCHE_RPC_URL!
    };

    for (const [network, rpcUrl] of Object.entries(networks)) {
      this.providers.set(network, new ethers.providers.JsonRpcProvider(rpcUrl));
    }
  }

  async scanAllProtocols(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const protocols: ProtocolData[] = [];

      // Get protocols from DeFiLlama
      const defiLlamaProtocols = await this.scanDefiLlamaProtocols(chainFilter);
      protocols.push(...defiLlamaProtocols);

      // Get additional yield farming protocols
      const yieldProtocols = await this.scanYieldProtocols(chainFilter);
      protocols.push(...yieldProtocols);

      // Remove duplicates and sort by TVL
      const uniqueProtocols = this.deduplicateProtocols(protocols);
      
      logger.info(`Scanned ${uniqueProtocols.length} protocols${chainFilter ? ` on ${chainFilter}` : ''}`);
      
      return uniqueProtocols.sort((a, b) => b.tvl - a.tvl);

    } catch (error) {
      logger.error('Error scanning protocols:', error);
      throw new Error('Failed to scan DeFi protocols');
    }
  }

  async getProtocolDetails(protocolName: string): Promise<ProtocolDetails> {
    try {
      // Get basic protocol data
      const basicData = await this.getBasicProtocolData(protocolName);
      
      // Get detailed information
      const detailedInfo = await this.getProtocolDetailedInfo(protocolName);
      
      // Get security information
      const securityInfo = await this.getProtocolSecurityInfo(protocolName);

      const protocolDetails: ProtocolDetails = {
        ...basicData,
        description: detailedInfo.description,
        website: detailedInfo.website,
        documentation: detailedInfo.documentation,
        governance: detailedInfo.governance,
        fees: detailedInfo.fees,
        security: securityInfo
      };

      logger.info(`Retrieved detailed information for ${protocolName}`);
      return protocolDetails;

    } catch (error) {
      logger.error(`Error getting protocol details for ${protocolName}:`, error);
      throw new Error(`Failed to get details for protocol: ${protocolName}`);
    }
  }

  private async scanDefiLlamaProtocols(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const response = await axios.get(`${this.defiLlamaAPI}/protocols`);
      const protocols = response.data;

      const mappedProtocols: ProtocolData[] = [];

      for (const protocol of protocols) {
        if (protocol.category === 'Yield Farming' || protocol.category === 'Lending') {
          const chains = chainFilter ? [chainFilter] : protocol.chains || ['ethereum'];
          
          for (const chain of chains) {
            if (chainFilter && chain !== chainFilter) continue;

            try {
              const protocolData = await this.mapDefiLlamaProtocol(protocol, chain);
              if (protocolData) {
                mappedProtocols.push(protocolData);
              }
            } catch (error) {
              logger.warn(`Failed to map protocol ${protocol.name} on ${chain}:`, error);
            }
          }
        }
      }

      return mappedProtocols;

    } catch (error) {
      logger.error('Error scanning DeFiLlama protocols:', error);
      return [];
    }
  }

  private async scanYieldProtocols(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const yieldProtocols: ProtocolData[] = [];

      // Scan Aave
      const aaveData = await this.scanAaveProtocol(chainFilter);
      if (aaveData) yieldProtocols.push(...aaveData);

      // Scan Compound
      const compoundData = await this.scanCompoundProtocol(chainFilter);
      if (compoundData) yieldProtocols.push(...compoundData);

      // Scan Yearn
      const yearnData = await this.scanYearnProtocol(chainFilter);
      if (yearnData) yieldProtocols.push(...yearnData);

      // Scan Curve
      const curveData = await this.scanCurveProtocol(chainFilter);
      if (curveData) yieldProtocols.push(...curveData);

      return yieldProtocols;

    } catch (error) {
      logger.error('Error scanning yield protocols:', error);
      return [];
    }
  }

  private async mapDefiLlamaProtocol(protocol: any, chain: string): Promise<ProtocolData | null> {
    try {
      // Get TVL for specific chain
      const tvlResponse = await axios.get(`${this.defiLlamaAPI}/tvl/${protocol.slug}`);
      const chainTVL = tvlResponse.data[chain] || 0;

      if (chainTVL < 1000000) return null; // Skip protocols with less than $1M TVL

      // Calculate risk score based on various factors
      const riskScore = this.calculateRiskScore({
        tvl: chainTVL,
        audited: protocol.audits > 0,
        age: Date.now() - new Date(protocol.listedAt * 1000).getTime(),
        category: protocol.category
      });

      return {
        name: protocol.name,
        chain: chain,
        currentAPY: await this.estimateAPY(protocol.name, chain),
        tvl: chainTVL,
        riskScore: riskScore,
        category: protocol.category,
        audited: protocol.audits > 0,
        launchDate: new Date(protocol.listedAt * 1000).toISOString(),
        tvlChange24h: protocol.change_1d || 0,
        minDeposit: 0, // Will be updated with specific protocol data
        withdrawalTime: 0, // Will be updated with specific protocol data
        contractAddress: '', // Will be fetched from chain
        tokenAddress: '' // Will be fetched from chain
      };

    } catch (error) {
      logger.error(`Error mapping DeFiLlama protocol ${protocol.name}:`, error);
      return null;
    }
  }

  private async scanAaveProtocol(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const aaveProtocols: ProtocolData[] = [];
      const chains = chainFilter ? [chainFilter] : ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche'];

      for (const chain of chains) {
        const provider = this.providers.get(chain);
        if (!provider) continue;

        // Aave V3 contract addresses by chain
        const aaveAddresses = this.getAaveAddresses(chain);
        if (!aaveAddresses) continue;

        const poolContract = new ethers.Contract(
          aaveAddresses.lendingPool,
          [
            'function getReservesList() external view returns (address[])',
            'function getReserveData(address asset) external view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint128,uint128,uint128,uint40,uint40,address,address,address,address,uint128))'
          ],
          provider
        );

        try {
          const reserves = await poolContract.getReservesList();
          
          for (const reserve of reserves.slice(0, 10)) { // Limit to top 10 reserves
            try {
              const reserveData = await poolContract.getReserveData(reserve);
              const supplyAPY = this.calculateAaveSupplyAPY(reserveData);
              
              if (supplyAPY > 0.1) { // Only include reserves with >0.1% APY
                aaveProtocols.push({
                  name: `Aave ${await this.getTokenSymbol(reserve, chain)}`,
                  chain: chain,
                  currentAPY: supplyAPY,
                  tvl: await this.getAaveTVL(reserve, chain),
                  riskScore: 3, // Aave is generally low risk
                  category: 'Lending',
                  audited: true,
                  launchDate: '2020-01-01T00:00:00Z',
                  tvlChange24h: 0,
                  minDeposit: 0,
                  withdrawalTime: 0,
                  contractAddress: aaveAddresses.lendingPool,
                  tokenAddress: reserve
                });
              }
            } catch (error) {
              logger.warn(`Failed to process Aave reserve ${reserve}:`, error);
            }
          }
        } catch (error) {
          logger.warn(`Failed to scan Aave on ${chain}:`, error);
        }
      }

      return aaveProtocols;

    } catch (error) {
      logger.error('Error scanning Aave protocol:', error);
      return [];
    }
  }

  private async scanCompoundProtocol(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const compoundProtocols: ProtocolData[] = [];
      const chains = chainFilter ? [chainFilter] : ['ethereum'];

      for (const chain of chains) {
        const provider = this.providers.get(chain);
        if (!provider) continue;

        const compoundAddresses = this.getCompoundAddresses(chain);
        if (!compoundAddresses) continue;

        const comptrollerContract = new ethers.Contract(
          compoundAddresses.comptroller,
          [
            'function getAllMarkets() external view returns (address[])'
          ],
          provider
        );

        try {
          const markets = await comptrollerContract.getAllMarkets();
          
          for (const market of markets.slice(0, 10)) {
            try {
              const cTokenContract = new ethers.Contract(
                market,
                [
                  'function supplyRatePerBlock() external view returns (uint256)',
                  'function totalSupply() external view returns (uint256)',
                  'function exchangeRateStored() external view returns (uint256)'
                ],
                provider
              );

              const supplyRate = await cTokenContract.supplyRatePerBlock();
              const supplyAPY = this.calculateCompoundAPY(supplyRate);
              
              if (supplyAPY > 0.1) {
                compoundProtocols.push({
                  name: `Compound ${await this.getTokenSymbol(market, chain)}`,
                  chain: chain,
                  currentAPY: supplyAPY,
                  tvl: await this.getCompoundTVL(market, chain),
                  riskScore: 4,
                  category: 'Lending',
                  audited: true,
                  launchDate: '2018-09-01T00:00:00Z',
                  tvlChange24h: 0,
                  minDeposit: 0,
                  withdrawalTime: 0,
                  contractAddress: market,
                  tokenAddress: await this.getCompoundUnderlyingToken(market, chain)
                });
              }
            } catch (error) {
              logger.warn(`Failed to process Compound market ${market}:`, error);
            }
          }
        } catch (error) {
          logger.warn(`Failed to scan Compound on ${chain}:`, error);
        }
      }

      return compoundProtocols;

    } catch (error) {
      logger.error('Error scanning Compound protocol:', error);
      return [];
    }
  }

  private async scanYearnProtocol(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const yearnAPI = 'https://api.yearn.finance/v1/chains';
      const response = await axios.get(`${yearnAPI}/${chainFilter || 'ethereum'}/vaults/all`);
      const vaults = response.data;

      const yearnProtocols: ProtocolData[] = vaults
        .filter((vault: any) => vault.apy?.net_apy > 0.001) // Filter active vaults
        .slice(0, 20) // Limit to top 20 vaults
        .map((vault: any) => ({
          name: `Yearn ${vault.name}`,
          chain: chainFilter || 'ethereum',
          currentAPY: vault.apy.net_apy * 100,
          tvl: parseFloat(vault.tvl?.tvl || '0'),
          riskScore: this.calculateYearnRiskScore(vault),
          category: 'Yield Farming',
          audited: true,
          launchDate: vault.inception_time || '2020-01-01T00:00:00Z',
          tvlChange24h: 0,
          minDeposit: 0,
          withdrawalTime: 0,
          contractAddress: vault.address,
          tokenAddress: vault.token.address
        }));

      return yearnProtocols;

    } catch (error) {
      logger.error('Error scanning Yearn protocol:', error);
      return [];
    }
  }

  private async scanCurveProtocol(chainFilter?: string): Promise<ProtocolData[]> {
    try {
      const curveAPI = 'https://api.curve.fi/api';
      const response = await axios.get(`${curveAPI}/getPools/${chainFilter || 'ethereum'}/main`);
      const pools = response.data.data.poolData;

      const curveProtocols: ProtocolData[] = pools
        .filter((pool: any) => pool.gaugeCrvApy && pool.gaugeCrvApy.length > 0)
        .slice(0, 15) // Limit to top 15 pools
        .map((pool: any) => ({
          name: `Curve ${pool.name}`,
          chain: chainFilter || 'ethereum',
          currentAPY: parseFloat(pool.gaugeCrvApy[0]) || 0,
          tvl: parseFloat(pool.usdTotal) || 0,
          riskScore: this.calculateCurveRiskScore(pool),
          category: 'DEX',
          audited: true,
          launchDate: '2020-01-01T00:00:00Z',
          tvlChange24h: 0,
          minDeposit: 0,
          withdrawalTime: 0,
          contractAddress: pool.address,
          tokenAddress: pool.lpTokenAddress
        }));

      return curveProtocols;

    } catch (error) {
      logger.error('Error scanning Curve protocol:', error);
      return [];
    }
  }

  private calculateRiskScore(factors: {
    tvl: number;
    audited: boolean;
    age: number;
    category: string;
  }): number {
    let score = 5; // Base score

    // TVL factor
    if (factors.tvl > 1000000000) score -= 2; // >$1B TVL
    else if (factors.tvl > 100000000) score -= 1; // >$100M TVL
    else if (factors.tvl < 10000000) score += 2; // <$10M TVL

    // Audit factor
    if (!factors.audited) score += 3;

    // Age factor (in milliseconds)
    const ageInDays = factors.age / (1000 * 60 * 60 * 24);
    if (ageInDays < 90) score += 2; // Less than 3 months
    else if (ageInDays > 365) score -= 1; // More than 1 year

    // Category factor
    if (factors.category === 'Lending') score -= 1;
    else if (factors.category === 'Yield Farming') score += 1;

    return Math.max(1, Math.min(10, score));
  }

  private async estimateAPY(protocolName: string, chain: string): Promise<number> {
    // This would fetch real APY data from the protocol's contracts
    // For now, return a reasonable estimate based on protocol type
    const baseAPY = {
      'Aave': 3.5,
      'Compound': 3.0,
      'Yearn': 8.0,
      'Curve': 5.0
    };

    for (const [name, apy] of Object.entries(baseAPY)) {
      if (protocolName.toLowerCase().includes(name.toLowerCase())) {
        return apy + (Math.random() * 4 - 2); // Add some variance
      }
    }

    return 4.0; // Default APY
  }

  private async getBasicProtocolData(protocolName: string): Promise<ProtocolData> {
    // This would fetch from a database or cache
    // For now, return a basic structure
    return {
      name: protocolName,
      chain: 'ethereum',
      currentAPY: 4.0,
      tvl: 10000000,
      riskScore: 5,
      category: 'Lending',
      audited: true,
      launchDate: '2020-01-01T00:00:00Z',
      tvlChange24h: 0,
      minDeposit: 0,
      withdrawalTime: 0,
      contractAddress: '',
      tokenAddress: ''
    };
  }

  private async getProtocolDetailedInfo(protocolName: string): Promise<any> {
    return {
      description: `${protocolName} is a DeFi protocol`,
      website: `https://${protocolName.toLowerCase()}.com`,
      documentation: `https://docs.${protocolName.toLowerCase()}.com`,
      governance: `https://gov.${protocolName.toLowerCase()}.com`,
      fees: {
        deposit: 0,
        withdrawal: 0,
        performance: 0.1
      }
    };
  }

  private async getProtocolSecurityInfo(protocolName: string): Promise<any> {
    return {
      audits: ['Trail of Bits', 'ConsenSys Diligence'],
      bugBounty: true,
      insurance: false
    };
  }

  private deduplicateProtocols(protocols: ProtocolData[]): ProtocolData[] {
    const seen = new Set<string>();
    return protocols.filter(protocol => {
      const key = `${protocol.name}-${protocol.chain}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Helper methods for specific protocols
  private getAaveAddresses(chain: string): any {
    const addresses: Record<string, any> = {
      ethereum: { lendingPool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' },
      polygon: { lendingPool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' },
      arbitrum: { lendingPool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' },
      optimism: { lendingPool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' },
      avalanche: { lendingPool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' }
    };
    return addresses[chain];
  }

  private getCompoundAddresses(chain: string): any {
    const addresses: Record<string, any> = {
      ethereum: { comptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B' }
    };
    return addresses[chain];
  }

  private calculateAaveSupplyAPY(reserveData: any): number {
    // Simplified APY calculation for Aave
    const liquidityRate = reserveData[2]; // currentLiquidityRate
    return (liquidityRate / 1e27) * 100; // Convert from ray to percentage
  }

  private calculateCompoundAPY(supplyRatePerBlock: ethers.BigNumber): number {
    // Compound APY calculation
    const blocksPerDay = 6570; // Ethereum blocks per day
    const daysPerYear = 365;
    const rate = supplyRatePerBlock.toNumber() / 1e18;
    return ((Math.pow(rate * blocksPerDay + 1, daysPerYear) - 1) * 100);
  }

  private calculateYearnRiskScore(vault: any): number {
    let score = 5;
    if (vault.apy.net_apy > 0.2) score += 2; // High APY = higher risk
    if (vault.tvl?.tvl > 100000000) score -= 1; // High TVL = lower risk
    return Math.max(1, Math.min(10, score));
  }

  private calculateCurveRiskScore(pool: any): number {
    let score = 4; // Curve is generally lower risk
    if (parseFloat(pool.usdTotal) < 10000000) score += 1;
    return Math.max(1, Math.min(10, score));
  }

  private async getTokenSymbol(tokenAddress: string, chain: string): Promise<string> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return 'UNKNOWN';

      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function symbol() external view returns (string)'],
        provider
      );

      return await tokenContract.symbol();
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  private async getAaveTVL(reserve: string, chain: string): Promise<number> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return 0;

      // This would calculate actual TVL from Aave contracts
      return 10000000; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  private async getCompoundTVL(market: string, chain: string): Promise<number> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return 0;

      // This would calculate actual TVL from Compound contracts
      return 5000000; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  private async getCompoundUnderlyingToken(market: string, chain: string): Promise<string> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return '';

      const cTokenContract = new ethers.Contract(
        market,
        ['function underlying() external view returns (address)'],
        provider
      );

      return await cTokenContract.underlying();
    } catch (error) {
      return '';
    }
  }
}
