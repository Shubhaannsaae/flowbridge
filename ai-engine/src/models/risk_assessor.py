import os
import json
import logging
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from dataclasses import dataclass
from enum import Enum

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class RiskAssessment:
    overall_risk_score: float
    risk_level: RiskLevel
    risk_factors: List[str]
    recommendations: List[str]
    confidence: float

class RiskAssessor:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        self.logger = logging.getLogger(__name__)

    def assess_portfolio_risk(self, portfolio_data: Dict[str, Any]) -> RiskAssessment:
        """Assess risk for entire portfolio."""
        try:
            prompt = self._build_portfolio_risk_prompt(portfolio_data)
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=1024
                )
            )
            
            result = self._parse_risk_response(response.text)
            
            return RiskAssessment(
                overall_risk_score=result['overall_risk_score'],
                risk_level=RiskLevel(result['risk_level']),
                risk_factors=result['risk_factors'],
                recommendations=result['recommendations'],
                confidence=result['confidence']
            )
            
        except Exception as e:
            self.logger.error(f"Error assessing portfolio risk: {e}")
            raise

    def assess_protocol_risk(self, protocol_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess risk for a specific protocol."""
        try:
            prompt = f"""
            You are an expert DeFi risk analyst. Assess the risk profile of this protocol:
            
            Protocol Data: {json.dumps(protocol_data, indent=2)}
            
            Analyze these risk categories:
            - Smart Contract Risk
            - Liquidity Risk
            - Market Risk
            - Governance Risk
            - Regulatory Risk
            
            Provide assessment in JSON format:
            {{
                "smart_contract_risk": {{
                    "score": 3,
                    "factors": ["audit_status", "code_complexity"],
                    "mitigation": "Use audited protocols only"
                }},
                "liquidity_risk": {{
                    "score": 2,
                    "factors": ["tvl_size", "withdrawal_limits"],
                    "mitigation": "Monitor liquidity depth"
                }},
                "market_risk": {{
                    "score": 4,
                    "factors": ["price_volatility", "correlation"],
                    "mitigation": "Diversify across assets"
                }},
                "governance_risk": {{
                    "score": 3,
                    "factors": ["centralization", "voting_power"],
                    "mitigation": "Monitor governance proposals"
                }},
                "regulatory_risk": {{
                    "score": 5,
                    "factors": ["jurisdiction", "compliance"],
                    "mitigation": "Stay informed on regulations"
                }},
                "overall_score": 3.4,
                "risk_level": "medium",
                "key_concerns": ["high_volatility", "audit_pending"],
                "recommendations": ["Limit allocation", "Monitor closely"]
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=1536
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error assessing protocol risk: {e}")
            raise

    def calculate_correlation_risk(self, holdings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate correlation risk between portfolio holdings."""
        try:
            prompt = f"""
            Analyze correlation risk between these DeFi holdings:
            
            Holdings: {json.dumps(holdings, indent=2)}
            
            Calculate correlation matrix and risk metrics:
            {{
                "correlation_matrix": {{
                    "ETH-USDC": 0.3,
                    "ETH-BTC": 0.8,
                    "USDC-DAI": 0.95
                }},
                "diversification_score": 6.5,
                "concentration_risk": {{
                    "level": "medium",
                    "max_allocation": 35,
                    "recommendations": ["Reduce ETH exposure", "Add uncorrelated assets"]
                }},
                "hedging_suggestions": [
                    {{
                        "asset": "stablecoins",
                        "allocation": 20,
                        "reason": "Reduce volatility"
                    }}
                ]
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1024
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error calculating correlation risk: {e}")
            raise

    def assess_market_risk(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess current market risk conditions."""
        try:
            prompt = f"""
            Analyze current DeFi market risk conditions:
            
            Market Data: {json.dumps(market_data, indent=2)}
            
            Assess:
            - Volatility levels
            - Liquidity conditions
            - Systemic risks
            - Sentiment indicators
            
            Provide analysis in JSON format:
            {{
                "market_volatility": {{
                    "level": "high",
                    "vix_equivalent": 45,
                    "trend": "increasing"
                }},
                "liquidity_conditions": {{
                    "overall": "healthy",
                    "concerns": ["concentrated_exchanges"],
                    "depth_score": 7
                }},
                "systemic_risks": [
                    {{
                        "risk": "regulatory_uncertainty",
                        "probability": 0.3,
                        "impact": "high"
                    }}
                ],
                "sentiment": {{
                    "score": 6.5,
                    "trend": "neutral",
                    "indicators": ["fear_greed_index", "social_sentiment"]
                }},
                "recommendations": [
                    "Increase cash position",
                    "Reduce leverage",
                    "Diversify across chains"
                ]
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=1536
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error assessing market risk: {e}")
            raise

    def _build_portfolio_risk_prompt(self, portfolio_data: Dict[str, Any]) -> str:
        """Build risk assessment prompt for portfolio."""
        return f"""
        You are an expert DeFi risk analyst. Assess the overall risk of this portfolio:
        
        Portfolio Data: {json.dumps(portfolio_data, indent=2)}
        
        Analyze:
        1. Asset concentration risk
        2. Protocol risk distribution
        3. Smart contract exposure
        4. Liquidity risk
        5. Market correlation risk
        
        Provide comprehensive risk assessment in JSON format:
        {{
            "overall_risk_score": 6.5,
            "risk_level": "medium",
            "risk_factors": [
                "high_eth_concentration",
                "single_protocol_exposure",
                "liquidity_risk"
            ],
            "risk_breakdown": {{
                "concentration_risk": 7,
                "protocol_risk": 5,
                "smart_contract_risk": 4,
                "liquidity_risk": 6,
                "market_risk": 8
            }},
            "recommendations": [
                "Diversify across more protocols",
                "Reduce single asset concentration",
                "Increase stablecoin allocation"
            ],
            "confidence": 0.88,
            "risk_mitigation": [
                "Set stop losses",
                "Regular rebalancing",
                "Monitor protocol health"
            ]
        }}
        """

    def _parse_risk_response(self, response_text: str) -> Dict[str, Any]:
        """Parse risk assessment response from Gemini AI."""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response_text[json_start:json_end]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ['overall_risk_score', 'risk_level', 'risk_factors', 'recommendations', 'confidence']
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            return result
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON in AI response: {e}")

    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """Parse JSON response from Gemini AI."""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response_text[json_start:json_end]
            return json.loads(json_str)
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON in AI response: {e}")
