import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProtocolScanner } from '../defi/ProtocolScanner';
import { MarketAnalytics } from '../data/MarketAnalytics';
import { logger } from '../../utils/logger';

export interface RiskAnalysis {
  overallRiskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  vulnerabilities: RiskFactor[];
  recommendations: string[];
  diversificationScore: number;
  protocolRisks: ProtocolRisk[];
  marketRisk: number;
  confidence: number;
}

export interface RiskFactor {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: number;
}

export interface ProtocolRisk {
  protocol: string;
  riskScore: number;
  factors: string[];
  auditStatus: string;
  tvlStability: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  adjustments?: any[];
}

export class RiskAssessment {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private protocolScanner: ProtocolScanner;
  private marketAnalytics: MarketAnalytics;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.protocolScanner = new ProtocolScanner();
    this.marketAnalytics = new MarketAnalytics();
  }

  async analyzePortfolioRisk(portfolioId: string): Promise<RiskAnalysis> {
    try {
      // Get portfolio data
      const portfolioData = await this.getPortfolioData(portfolioId);
      
      // Get protocol risk data
      const protocolRisks = await Promise.all(
        portfolioData.strategies.map(async (strategy: any) => {
          return await this.assessProtocolRisk(strategy.protocol);
        })
      );

      // Get market risk data
      const marketRisk = await this.marketAnalytics.calculateMarketRisk();

      // Build risk assessment prompt
      const riskPrompt = this.buildRiskAssessmentPrompt(
        portfolioData,
        protocolRisks,
        marketRisk
      );

      const result = await this.model.generateContent(riskPrompt);
      const aiResponse = result.response.text();
      
      const riskAnalysis = this.parseRiskResponse(aiResponse);

      // Calculate diversification score
      const diversificationScore = this.calculateDiversificationScore(portfolioData);

      logger.info(`Risk analysis completed for portfolio ${portfolioId}`);

      return {
        ...riskAnalysis,
        protocolRisks,
        marketRisk: marketRisk.overallRisk,
        diversificationScore
      };

    } catch (error) {
      logger.error('Risk analysis error:', error);
      throw new Error('Failed to analyze portfolio risk');
    }
  }

  async validateStrategy(strategies: any[]): Promise<ValidationResult> {
    try {
      if (!strategies || strategies.length === 0) {
        return {
          isValid: false,
          reason: 'No strategies provided'
        };
      }

      // Check allocation sum
      const totalAllocation = strategies.reduce((sum, s) => sum + s.allocation, 0);
      if (Math.abs(totalAllocation - 100) > 1) {
        return {
          isValid: false,
          reason: `Total allocation is ${totalAllocation}%, must equal 100%`
        };
      }

      // Check individual protocol risks
      for (const strategy of strategies) {
        const protocolRisk = await this.assessProtocolRisk(strategy.protocol);
        
        if (protocolRisk.riskScore > 8) {
          return {
            isValid: false,
            reason: `Protocol ${strategy.protocol} has high risk score: ${protocolRisk.riskScore}`
          };
        }
      }

      // Check concentration risk
      const maxAllocation = Math.max(...strategies.map(s => s.allocation));
      if (maxAllocation > 50) {
        return {
          isValid: false,
          reason: `Single protocol allocation too high: ${maxAllocation}%`
        };
      }

      return { isValid: true };

    } catch (error) {
      logger.error('Strategy validation error:', error);
      return {
        isValid: false,
        reason: 'Validation failed due to error'
      };
    }
  }

  private async assessProtocolRisk(protocolName: string): Promise<ProtocolRisk> {
    try {
      const protocolData = await this.protocolScanner.getProtocolDetails(protocolName);
      
      const riskFactors = [];
      let riskScore = 0;

      // TVL stability check
      if (protocolData.tvlChange24h < -10) {
        riskFactors.push('Significant TVL decline');
        riskScore += 2;
      }

      // Audit status check
      if (!protocolData.audited) {
        riskFactors.push('No security audit');
        riskScore += 3;
      }

      // Age check
      const protocolAge = Date.now() - new Date(protocolData.launchDate).getTime();
      const ageInDays = protocolAge / (1000 * 60 * 60 * 24);
      
      if (ageInDays < 90) {
        riskFactors.push('Protocol less than 3 months old');
        riskScore += 2;
      }

      // TVL size check
      if (protocolData.tvl < 10000000) { // Less than $10M TVL
        riskFactors.push('Low TVL');
        riskScore += 1;
      }

      return {
        protocol: protocolName,
        riskScore: Math.min(riskScore, 10),
        factors: riskFactors,
        auditStatus: protocolData.audited ? 'Audited' : 'Not Audited',
        tvlStability: protocolData.tvlChange24h
      };

    } catch (error) {
      logger.error(`Error assessing protocol risk for ${protocolName}:`, error);
      return {
        protocol: protocolName,
        riskScore: 10, // Max risk if we can't assess
        factors: ['Unable to assess risk'],
        auditStatus: 'Unknown',
        tvlStability: 0
      };
    }
  }

  private buildRiskAssessmentPrompt(
    portfolioData: any,
    protocolRisks: ProtocolRisk[],
    marketRisk: any
  ): string {
    return `
      You are an expert DeFi risk analyst. Analyze the portfolio risk and provide a comprehensive assessment.

      Portfolio Data:
      ${JSON.stringify(portfolioData, null, 2)}

      Protocol Risks:
      ${JSON.stringify(protocolRisks, null, 2)}

      Market Risk Data:
      ${JSON.stringify(marketRisk, null, 2)}

      Provide a comprehensive risk analysis considering:
      1. Protocol-specific risks
      2. Concentration risk
      3. Market correlation risk
      4. Liquidity risk
      5. Smart contract risk

      Response format (JSON only):
      {
        "overallRiskScore": number_0_to_10,
        "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
        "vulnerabilities": [
          {
            "type": "vulnerability_type",
            "severity": "LOW|MEDIUM|HIGH|CRITICAL",
            "description": "detailed_description",
            "impact": number_0_to_10
          }
        ],
        "recommendations": ["recommendation1", "recommendation2"],
        "confidence": number_0_to_1
      }
    `;
  }

  private parseRiskResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Error parsing risk assessment response:', error);
      throw new Error('Failed to parse risk assessment response');
    }
  }

  private calculateDiversificationScore(portfolioData: any): number {
    if (!portfolioData.strategies || portfolioData.strategies.length === 0) {
      return 0;
    }

    // Calculate Herfindahl-Hirschman Index for concentration
    const allocations = portfolioData.strategies.map((s: any) => s.allocation / 100);
    const hhi = allocations.reduce((sum: number, allocation: number) => sum + allocation * allocation, 0);
    
    // Convert to diversification score (inverse of concentration)
    return Math.max(0, (1 - hhi) * 100);
  }

  private async getPortfolioData(portfolioId: string): Promise<any> {
    // This would fetch actual portfolio data from database
    // For now, return a mock structure
    return {
      id: portfolioId,
      strategies: [],
      totalValue: 0,
      createdAt: new Date().toISOString()
    };
  }
}
