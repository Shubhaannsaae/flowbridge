import os
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
import google.generativeai as genai
from dataclasses import dataclass

@dataclass
class OptimizationResult:
    allocations: List[Dict[str, Any]]
    expected_return: float
    risk_score: float
    sharpe_ratio: float
    rebalancing_frequency: str
    confidence: float

class PortfolioOptimizer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        self.logger = logging.getLogger(__name__)

    def optimize_portfolio(self, portfolio_data: Dict[str, Any], preferences: Dict[str, Any]) -> OptimizationResult:
        """Optimize portfolio allocation using modern portfolio theory principles."""
        try:
            prompt = self._build_optimization_prompt(portfolio_data, preferences)
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048
                )
            )
            
            result = self._parse_optimization_response(response.text)
            
            return OptimizationResult(
                allocations=result['allocations'],
                expected_return=result['expected_return'],
                risk_score=result['risk_score'],
                sharpe_ratio=result['sharpe_ratio'],
                rebalancing_frequency=result['rebalancing_frequency'],
                confidence=result['confidence']
            )
            
        except Exception as e:
            self.logger.error(f"Error optimizing portfolio: {e}")
            raise

    def calculate_efficient_frontier(self, assets: List[Dict[str, Any]], constraints: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate efficient frontier for given assets."""
        try:
            prompt = f"""
            Calculate the efficient frontier for these DeFi assets:
            
            Assets: {json.dumps(assets, indent=2)}
            Constraints: {json.dumps(constraints, indent=2)}
            
            Generate efficient frontier points with different risk-return profiles:
            {{
                "efficient_frontier": [
                    {{
                        "risk": 0.15,
                        "return": 0.08,
                        "allocations": {{
                            "USDC": 40,
                            "ETH": 35,
                            "BTC": 25
                        }}
                    }}
                ],
                "optimal_portfolio": {{
                    "max_sharpe": {{
                        "risk": 0.18,
                        "return": 0.12,
                        "sharpe_ratio": 0.67,
                        "allocations": {{"USDC": 30, "ETH": 45, "BTC": 25}}
                    }},
                    "min_variance": {{
                        "risk": 0.12,
                        "return": 0.06,
                        "allocations": {{"USDC": 60, "ETH": 25, "BTC": 15}}
                    }}
                }},
                "correlation_matrix": {{
                    "USDC-ETH": 0.1,
                    "USDC-BTC": 0.05,
                    "ETH-BTC": 0.7
                }}
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
            self.logger.error(f"Error calculating efficient frontier: {e}")
            raise

    def suggest_rebalancing(self, current_portfolio: Dict[str, Any], target_portfolio: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest rebalancing strategy."""
        try:
            prompt = f"""
            Analyze current vs target portfolio and suggest rebalancing strategy:
            
            Current Portfolio: {json.dumps(current_portfolio, indent=2)}
            Target Portfolio: {json.dumps(target_portfolio, indent=2)}
            
            Provide rebalancing strategy:
            {{
                "rebalancing_needed": true,
                "total_deviation": 15.5,
                "trades_required": [
                    {{
                        "action": "sell",
                        "asset": "ETH",
                        "amount": 500,
                        "percentage": 5,
                        "reason": "overweight"
                    }},
                    {{
                        "action": "buy",
                        "asset": "USDC",
                        "amount": 300,
                        "percentage": 3,
                        "reason": "underweight"
                    }}
                ],
                "estimated_costs": {{
                    "gas_fees": 50,
                    "slippage": 25,
                    "total": 75
                }},
                "optimal_timing": "immediate",
                "priority_level": "medium",
                "expected_improvement": {{
                    "risk_reduction": 0.02,
                    "return_increase": 0.005
                }}
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
            self.logger.error(f"Error suggesting rebalancing: {e}")
            raise

    def optimize_for_yield(self, portfolio_data: Dict[str, Any], yield_targets: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize portfolio specifically for yield generation."""
        try:
            prompt = f"""
            Optimize this portfolio for maximum yield while respecting risk constraints:
            
            Portfolio Data: {json.dumps(portfolio_data, indent=2)}
            Yield Targets: {json.dumps(yield_targets, indent=2)}
            
            Consider:
            - Yield farming opportunities
            - Staking rewards
            - Liquidity provision
            - Risk-adjusted returns
            
            Provide yield optimization strategy:
            {{
                "yield_strategies": [
                    {{
                        "protocol": "Aave",
                        "strategy": "lending",
                        "allocation": 30,
                        "expected_apy": 5.5,
                        "risk_score": 3,
                        "lockup_period": 0
                    }},
                    {{
                        "protocol": "Uniswap V3",
                        "strategy": "liquidity_provision",
                        "allocation": 25,
                        "expected_apy": 12.0,
                        "risk_score": 6,
                        "lockup_period": 0
                    }}
                ],
                "total_expected_yield": 8.7,
                "risk_adjusted_yield": 7.2,
                "diversification_score": 8,
                "liquidity_score": 7,
                "recommendations": [
                    "Focus on blue-chip protocols",
                    "Maintain 20% in stablecoins",
                    "Monitor IL risk in LP positions"
                ]
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
            self.logger.error(f"Error optimizing for yield: {e}")
            raise

    def _build_optimization_prompt(self, portfolio_data: Dict[str, Any], preferences: Dict[str, Any]) -> str:
        """Build optimization prompt for Gemini AI."""
        return f"""
        You are an expert DeFi portfolio optimizer using modern portfolio theory principles.
        
        Portfolio Data: {json.dumps(portfolio_data, indent=2)}
        User Preferences: {json.dumps(preferences, indent=2)}
        
        Optimize the portfolio considering:
        1. Risk-return trade-off
        2. Correlation between assets
        3. User risk tolerance
        4. Liquidity requirements
        5. Gas costs and fees
        6. Yield optimization
        
        Provide optimization results in JSON format:
        {{
            "allocations": [
                {{
                    "asset": "ETH",
                    "protocol": "Lido",
                    "percentage": 35.0,
                    "amount": 3500,
                    "expected_return": 6.5,
                    "risk_score": 5,
                    "reasoning": "Core holding with staking yield"
                }},
                {{
                    "asset": "USDC",
                    "protocol": "Aave",
                    "percentage": 40.0,
                    "amount": 4000,
                    "expected_return": 4.2,
                    "risk_score": 2,
                    "reasoning": "Stable yield with low risk"
                }}
            ],
            "expected_return": 8.5,
            "risk_score": 4.2,
            "sharpe_ratio": 1.45,
            "max_drawdown": 0.18,
            "volatility": 0.22,
            "rebalancing_frequency": "monthly",
            "confidence": 0.85,
            "diversification_ratio": 0.78,
            "reasoning": "Balanced allocation focusing on risk-adjusted returns"
        }}
        """

    def _parse_optimization_response(self, response_text: str) -> Dict[str, Any]:
        """Parse optimization response from Gemini AI."""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response_text[json_start:json_end]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ['allocations', 'expected_return', 'risk_score', 'sharpe_ratio', 'rebalancing_frequency', 'confidence']
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
