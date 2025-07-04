import os
import json
import logging
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from dataclasses import dataclass

@dataclass
class YieldPrediction:
    protocol: str
    predicted_apy: float
    confidence: float
    trend: str
    risk_score: float
    timeframe_days: int

class YieldPredictor:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        self.logger = logging.getLogger(__name__)

    def predict_yield(self, protocol_data: Dict[str, Any], timeframe_days: int = 7) -> YieldPrediction:
        """Predict yield for a specific protocol using Gemini AI."""
        try:
            prompt = self._build_prediction_prompt(protocol_data, timeframe_days)
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1024,
                    candidate_count=1
                )
            )
            
            result = self._parse_prediction_response(response.text)
            
            return YieldPrediction(
                protocol=protocol_data.get('name', 'Unknown'),
                predicted_apy=result['predicted_apy'],
                confidence=result['confidence'],
                trend=result['trend'],
                risk_score=result['risk_score'],
                timeframe_days=timeframe_days
            )
            
        except Exception as e:
            self.logger.error(f"Error predicting yield: {e}")
            raise

    def optimize_yield(self, portfolio_data: Dict[str, Any], preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize yield allocation across multiple protocols."""
        try:
            prompt = f"""
            You are an expert DeFi yield optimizer. Analyze the portfolio data and user preferences to provide optimal yield allocation.
            
            Portfolio Data: {json.dumps(portfolio_data, indent=2)}
            User Preferences: {json.dumps(preferences, indent=2)}
            
            Provide a JSON response with:
            {{
                "allocations": [
                    {{
                        "protocol": "protocol_name",
                        "percentage": 25.5,
                        "amount": 1000,
                        "expected_apy": 8.5,
                        "risk_score": 3
                    }}
                ],
                "total_expected_apy": 7.2,
                "total_risk_score": 4,
                "rebalancing_frequency": "weekly",
                "reasoning": "Detailed explanation of allocation strategy"
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.4,
                    max_output_tokens=2048
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error optimizing yield: {e}")
            raise

    def analyze_protocol_health(self, protocol_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the health and sustainability of a DeFi protocol."""
        try:
            prompt = f"""
            Analyze this DeFi protocol's health and sustainability:
            
            Protocol Data: {json.dumps(protocol_data, indent=2)}
            
            Provide analysis in JSON format:
            {{
                "health_score": 85,
                "sustainability_score": 75,
                "key_metrics": {{
                    "tvl_trend": "increasing",
                    "user_growth": "stable",
                    "token_distribution": "healthy"
                }},
                "risks": ["smart_contract", "market_risk"],
                "opportunities": ["cross_chain_expansion"],
                "recommendation": "hold/buy/sell/avoid"
            }}
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=1024
                )
            )
            
            return self._parse_json_response(response.text)
            
        except Exception as e:
            self.logger.error(f"Error analyzing protocol health: {e}")
            raise

    def _build_prediction_prompt(self, protocol_data: Dict[str, Any], timeframe_days: int) -> str:
        """Build prediction prompt for Gemini AI."""
        return f"""
        You are an expert DeFi yield predictor. Analyze the protocol data and predict future yield.
        
        Protocol Data: {json.dumps(protocol_data, indent=2)}
        Prediction Timeframe: {timeframe_days} days
        
        Consider these factors:
        - Historical APY trends
        - Protocol TVL changes
        - Market conditions
        - Smart contract risks
        - Token economics
        
        Provide prediction in JSON format:
        {{
            "predicted_apy": 7.5,
            "confidence": 0.85,
            "trend": "increasing/decreasing/stable",
            "risk_score": 4,
            "factors": ["market_conditions", "tvl_growth"],
            "explanation": "Detailed reasoning for prediction"
        }}
        """

    def _parse_prediction_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini AI response for yield prediction."""
        try:
            # Extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response_text[json_start:json_end]
            result = json.loads(json_str)
            
            # Validate required fields
            required_fields = ['predicted_apy', 'confidence', 'trend', 'risk_score']
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
