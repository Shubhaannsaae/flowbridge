import os
import json
import logging
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from dataclasses import dataclass
from enum import Enum

class MarketTrend(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    VOLATILE = "volatile"

@dataclass
class MarketAnalysis:
    overall_sentiment: MarketTrend
    market_score: float
    key_trends: List[str]
    risk_factors: List[str]
    opportunities: List[str]
    confidence: float

class MarketAnalyzer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        self.logger = logging.getLogger(__name__)

    def analyze_market_conditions(self, market_data: Dict[str, Any]) -> MarketAnalysis:
        """Analyze current market conditions and sentiment."""
        try:
            prompt = self._build_market_analysis_prompt(market_data)
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1536
                )
            )
            
            result = self._parse_market_response(response.text)
            
            return MarketAnalysis(
                overall_sentiment=MarketTrend(result['overall_sentiment']),
                market_score=result['market_score'],
                key_trends=result['key_trends'],
                risk_factors=result['risk_factors'],
                opportunities=result['opportunities'],
                confidence=result['confidence']
            )
            
        except Exception as e:
            self.logger.error(f"Error analyzing market conditions: {e}")
            raise

    def analyze_defi_trends(self, defi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze DeFi-specific market trends."""
        try:
            prompt = f"""
            Analyze current DeFi market trends and conditions:
            
            DeFi Data: {json.dumps(defi_data, indent=2)}
            
            Analyze:
            - Total Value Locked (TVL) trends
            - Protocol adoption rates
            - Yield trends across protocols
            - New protocol launches
            - Cross-chain activity
            - Governance developments
            
            Provide comprehensive DeFi analysis:
            {{
                "tvl_analysis": {{
                    "total_tvl": 45000000000,
                    "tvl_change_7d": 5.2,
                    "tvl_change_30d": -2.1,
                    "trend": "recovering",
                    "key_drivers": ["institutional_adoption", "new_protocols"]
                }},
                "protocol_trends": [
                    {{
                        "category": "lending",
                        "trend": "growth",
                        "top_protocols": ["Aave", "Compound"],
                        "innovation": "real_world_assets"
                    }},
                    {{
                        "category": "dex",
                        "trend": "consolidation",
                        "top_protocols": ["Uniswap", "Curve"],
                        "innovation": "concentrated_liquidity"
                    }}
                ],
                "yield_environment": {{
                    "average_lending_rate": 4.5,
                    "average_farming_rate": 8.2,
                    "trend": "declining",
                    "outlook": "stabilizing"
                }},
                "cross_chain_activity": {{
                    "bridge_volume": 1200000000,
                    "active_chains": 12,
                    "trend": "increasing",
                    "leading_bridges": ["LayerZero", "Wormhole"]
                }},
                "risks": [
                    "regulatory_uncertainty",
                    "smart_contract_risks",
                    "market_concentration"
                ],
                "opportunities": [
                    "institutional_adoption",
                    "real_world_asset_tokenization",
                    "improved_user_experience"
                ]
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error analyzing DeFi trends: {e}")
            raise

    def predict_market_direction(self, historical_data: Dict[str, Any], timeframe: str = "30d") -> Dict[str, Any]:
        """Predict market direction based on historical data."""
        try:
            prompt = f"""
            Predict market direction for the next {timeframe} based on historical data:
            
            Historical Data: {json.dumps(historical_data, indent=2)}
            Prediction Timeframe: {timeframe}
            
            Consider:
            - Technical indicators
            - Fundamental factors
            - Market sentiment
            - Macro economic factors
            - DeFi-specific metrics
            
            Provide market prediction:
            {{
                "direction_prediction": {{
                    "trend": "bullish",
                    "confidence": 0.72,
                    "price_target_range": {{
                        "low": 45000,
                        "high": 52000
                    }},
                    "probability_distribution": {{
                        "bullish": 0.45,
                        "neutral": 0.35,
                        "bearish": 0.20
                    }}
                }},
                "key_factors": [
                    {{
                        "factor": "institutional_adoption",
                        "impact": "positive",
                        "weight": 0.3
                    }},
                    {{
                        "factor": "regulatory_clarity",
                        "impact": "positive",
                        "weight": 0.25
                    }}
                ],
                "technical_analysis": {{
                    "rsi": 58,
                    "moving_averages": "bullish_crossover",
                    "support_levels": [42000, 40000],
                    "resistance_levels": [48000, 52000]
                }},
                "scenario_analysis": {{
                    "bull_case": {{
                        "probability": 0.3,
                        "target": 60000,
                        "drivers": ["institutional_inflows", "regulatory_approval"]
                    }},
                    "base_case": {{
                        "probability": 0.5,
                        "target": 48000,
                        "drivers": ["steady_adoption", "stable_rates"]
                    }},
                    "bear_case": {{
                        "probability": 0.2,
                        "target": 35000,
                        "drivers": ["regulatory_crackdown", "macro_uncertainty"]
                    }}
                }}
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.4,
                    max_output_tokens=1536
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error predicting market direction: {e}")
            raise

    def analyze_sector_rotation(self, sector_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze sector rotation patterns in DeFi."""
        try:
            prompt = f"""
            Analyze sector rotation patterns in DeFi markets:
            
            Sector Data: {json.dumps(sector_data, indent=2)}
            
            Analyze these DeFi sectors:
            - Lending/Borrowing
            - DEX/AMM
            - Yield Farming
            - Derivatives
            - Insurance
            - Infrastructure
            
            Provide sector rotation analysis:
            {{
                "sector_performance": {{
                    "lending": {{
                        "performance_7d": 5.2,
                        "performance_30d": -2.1,
                        "trend": "recovery",
                        "outlook": "positive"
                    }},
                    "dex": {{
                        "performance_7d": 8.1,
                        "performance_30d": 12.5,
                        "trend": "strong_growth",
                        "outlook": "positive"
                    }}
                }},
                "rotation_signals": [
                    {{
                        "from_sector": "yield_farming",
                        "to_sector": "lending",
                        "strength": "moderate",
                        "drivers": ["safer_yields", "market_uncertainty"]
                    }}
                ],
                "emerging_sectors": [
                    {{
                        "sector": "real_world_assets",
                        "growth_rate": 45.2,
                        "potential": "high",
                        "risks": ["regulatory", "adoption"]
                    }}
                ],
                "recommendations": [
                    "Overweight stable yield sectors",
                    "Underweight high-risk farming",
                    "Monitor RWA developments"
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
            self.logger.error(f"Error analyzing sector rotation: {e}")
            raise

    def _build_market_analysis_prompt(self, market_data: Dict[str, Any]) -> str:
        """Build market analysis prompt for Gemini AI."""
        return f"""
        You are an expert cryptocurrency and DeFi market analyst. Analyze current market conditions:
        
        Market Data: {json.dumps(market_data, indent=2)}
        
        Provide comprehensive market analysis considering:
        1. Price action and technical indicators
        2. Volume and liquidity trends
        3. Market sentiment indicators
        4. Fundamental developments
        5. Macro economic factors
        6. DeFi-specific metrics
        
        Analysis in JSON format:
        {{
            "overall_sentiment": "bullish",
            "market_score": 7.5,
            "key_trends": [
                "institutional_adoption_increasing",
                "defi_tvl_recovering",
                "cross_chain_activity_growing"
            ],
            "sentiment_indicators": {{
                "fear_greed_index": 68,
                "social_sentiment": "positive",
                "institutional_flow": "inflow",
                "retail_interest": "moderate"
            }},
            "technical_analysis": {{
                "trend": "uptrend",
                "momentum": "strong",
                "volatility": "moderate",
                "key_levels": {{
                    "support": [42000, 40000],
                    "resistance": [48000, 52000]
                }}
            }},
            "fundamental_factors": [
                "regulatory_clarity_improving",
                "adoption_metrics_strong",
                "innovation_continuing"
            ],
            "risk_factors": [
                "macro_uncertainty",
                "regulatory_risks",
                "market_concentration"
            ],
            "opportunities": [
                "institutional_products",
                "defi_innovation",
                "cross_chain_solutions"
            ],
            "confidence": 0.82,
            "outlook": {{
                "short_term": "positive",
                "medium_term": "positive",
                "long_term": "very_positive"
            }}
        }}
        """

    def _parse_market_response(self, response_text: str) -> Dict[str, Any]:
        """Parse market analysis response from Gemini AI."""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response_text[json_start:json_end]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ['overall_sentiment', 'market_score', 'key_trends', 'risk_factors', 'opportunities', 'confidence']
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
