import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import json

@dataclass
class PriceData:
    symbol: str
    price: float
    price_change_24h: float
    volume_24h: float
    market_cap: float
    timestamp: datetime

class PriceFeedCollector:
    def __init__(self, coingecko_api_key: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self.session: Optional[aiohttp.ClientSession] = None
        self.coingecko_api_key = coingecko_api_key
        
        # API endpoints
        self.coingecko_api = "https://api.coingecko.com/api/v3"
        self.defillama_api = "https://coins.llama.fi"
        
    async def __aenter__(self):
        headers = {'User-Agent': 'FlowBridge-AI/1.0'}
        if self.coingecko_api_key:
            headers['x-cg-demo-api-key'] = self.coingecko_api_key
            
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers=headers
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def get_token_prices(self, symbols: List[str]) -> Dict[str, PriceData]:
        """Get current prices for specified tokens."""
        try:
            # Convert symbols to CoinGecko IDs
            token_ids = self._symbols_to_coingecko_ids(symbols)
            
            url = f"{self.coingecko_api}/simple/price"
            params = {
                'ids': ','.join(token_ids),
                'vs_currencies': 'usd',
                'include_24hr_change': 'true',
                'include_24hr_vol': 'true',
                'include_market_cap': 'true'
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status != 200:
                    self.logger.error(f"CoinGecko API error: {response.status}")
                    return {}
                
                data = await response.json()
                prices = {}
                
                for token_id, symbol in zip(token_ids, symbols):
                    if token_id in data:
                        price_info = data[token_id]
                        prices[symbol] = PriceData(
                            symbol=symbol,
                            price=price_info.get('usd', 0),
                            price_change_24h=price_info.get('usd_24h_change', 0),
                            volume_24h=price_info.get('usd_24h_vol', 0),
                            market_cap=price_info.get('usd_market_cap', 0),
                            timestamp=datetime.now()
                        )
                
                return prices
                
        except Exception as e:
            self.logger.error(f"Error getting token prices: {e}")
            return {}

    async def get_historical_prices(self, symbol: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get historical price data for a token."""
        try:
            token_id = self._symbol_to_coingecko_id(symbol)
            url = f"{self.coingecko_api}/coins/{token_id}/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': str(days),
                'interval': 'daily' if days > 90 else 'hourly'
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status != 200:
                    self.logger.error(f"CoinGecko historical API error: {response.status}")
                    return []
                
                data = await response.json()
                prices = data.get('prices', [])
                volumes = data.get('total_volumes', [])
                
                historical_data = []
                for i, (timestamp, price) in enumerate(prices):
                    volume = volumes[i][1] if i < len(volumes) else 0
                    historical_data.append({
                        'timestamp': datetime.fromtimestamp(timestamp / 1000),
                        'price': price,
                        'volume': volume
                    })
                
                return historical_data
                
        except Exception as e:
            self.logger.error(f"Error getting historical prices for {symbol}: {e}")
            return []

    async def get_defi_token_prices(self, token_addresses: Dict[str, str]) -> Dict[str, PriceData]:
        """Get prices for DeFi tokens by contract address."""
        try:
            prices = {}
            
            for chain, addresses in token_addresses.items():
                if isinstance(addresses, str):
                    addresses = [addresses]
                
                for address in addresses:
                    url = f"{self.defillama_api}/prices/current/{chain}:{address}"
                    
                    async with self.session.get(url) as response:
                        if response.status != 200:
                            continue
                        
                        data = await response.json()
                        coin_key = f"{chain}:{address}"
                        
                        if 'coins' in data and coin_key in data['coins']:
                            coin_data = data['coins'][coin_key]
                            symbol = coin_data.get('symbol', address[:6])
                            
                            prices[symbol] = PriceData(
                                symbol=symbol,
                                price=coin_data.get('price', 0),
                                price_change_24h=0,  # DeFiLlama doesn't provide 24h change
                                volume_24h=0,
                                market_cap=0,
                                timestamp=datetime.now()
                            )
                
                # Small delay between requests to avoid rate limiting
                await asyncio.sleep(0.1)
            
            return prices
            
        except Exception as e:
            self.logger.error(f"Error getting DeFi token prices: {e}")
            return {}

    async def get_gas_prices(self) -> Dict[str, Dict[str, float]]:
        """Get current gas prices for different chains."""
        try:
            gas_prices = {}
            
            # Ethereum gas prices
            eth_gas = await self._get_ethereum_gas_price()
            if eth_gas:
                gas_prices['ethereum'] = eth_gas
            
            # Polygon gas prices
            polygon_gas = await self._get_polygon_gas_price()
            if polygon_gas:
                gas_prices['polygon'] = polygon_gas
            
            return gas_prices
            
        except Exception as e:
            self.logger.error(f"Error getting gas prices: {e}")
            return {}

    async def _get_ethereum_gas_price(self) -> Optional[Dict[str, float]]:
        """Get Ethereum gas prices."""
        try:
            url = "https://api.etherscan.io/api"
            params = {
                'module': 'gastracker',
                'action': 'gasoracle',
                'apikey': 'YourApiKeyToken'  # Replace with actual API key
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status != 200:
                    return None
                
                data = await response.json()
                result = data.get('result', {})
                
                return {
                    'slow': float(result.get('SafeGasPrice', 0)),
                    'standard': float(result.get('ProposeGasPrice', 0)),
                    'fast': float(result.get('FastGasPrice', 0))
                }
                
        except Exception as e:
            self.logger.error(f"Error getting Ethereum gas price: {e}")
            return None

    async def _get_polygon_gas_price(self) -> Optional[Dict[str, float]]:
        """Get Polygon gas prices."""
        try:
            url = "https://gasstation-mainnet.matic.network/v2"
            
            async with self.session.get(url) as response:
                if response.status != 200:
                    return None
                
                data = await response.json()
                
                return {
                    'slow': float(data.get('safeLow', {}).get('maxFee', 0)),
                    'standard': float(data.get('standard', {}).get('maxFee', 0)),
                    'fast': float(data.get('fast', {}).get('maxFee', 0))
                }
                
        except Exception as e:
            self.logger.error(f"Error getting Polygon gas price: {e}")
            return None

    async def get_market_cap_data(self) -> Dict[str, Any]:
        """Get overall market data."""
        try:
            url = f"{self.coingecko_api}/global"
            
            async with self.session.get(url) as response:
                if response.status != 200:
                    return {}
                
                data = await response.json()
                global_data = data.get('data', {})
                
                return {
                    'total_market_cap': global_data.get('total_market_cap', {}).get('usd', 0),
                    'total_volume_24h': global_data.get('total_volume', {}).get('usd', 0),
                    'market_cap_change_24h': global_data.get('market_cap_change_percentage_24h_usd', 0),
                    'btc_dominance': global_data.get('market_cap_percentage', {}).get('btc', 0),
                    'eth_dominance': global_data.get('market_cap_percentage', {}).get('eth', 0),
                    'defi_market_cap': global_data.get('defi_market_cap', 0),
                    'defi_to_eth_ratio': global_data.get('defi_to_eth_ratio', 0)
                }
                
        except Exception as e:
            self.logger.error(f"Error getting market cap data: {e}")
            return {}

    def _symbols_to_coingecko_ids(self, symbols: List[str]) -> List[str]:
        """Convert token symbols to CoinGecko IDs."""
        symbol_mapping = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'USDC': 'usd-coin',
            'USDT': 'tether',
            'DAI': 'dai',
            'WETH': 'weth',
            'MATIC': 'matic-network',
            'AVAX': 'avalanche-2',
            'OP': 'optimism',
            'ARB': 'arbitrum',
            'LINK': 'chainlink',
            'UNI': 'uniswap',
            'AAVE': 'aave',
            'COMP': 'compound-governance-token',
            'CRV': 'curve-dao-token',
            'YFI': 'yearn-finance'
        }
        
        return [symbol_mapping.get(symbol.upper(), symbol.lower()) for symbol in symbols]

    def _symbol_to_coingecko_id(self, symbol: str) -> str:
        """Convert single token symbol to CoinGecko ID."""
        return self._symbols_to_coingecko_ids([symbol])[0]
