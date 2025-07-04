import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import json
import time
from datetime import datetime, timedelta

@dataclass
class ProtocolData:
    name: str
    chain: str
    tvl: float
    apy: float
    category: str
    token_address: str
    contract_address: str
    last_updated: datetime

class DeFiDataCollector:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # API endpoints
        self.defillama_api = "https://api.llama.fi"
        self.yearn_api = "https://api.yearn.finance/v1"
        self.aave_api = "https://aave-api-v2.aave.com"
        self.compound_api = "https://api.compound.finance/api/v2"
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'FlowBridge-AI/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def collect_protocol_data(self, protocols: List[str] = None) -> List[ProtocolData]:
        """Collect data for specified protocols or all major protocols."""
        try:
            if not protocols:
                protocols = ['aave', 'compound', 'yearn', 'uniswap', 'curve', 'convex']
            
            tasks = []
            for protocol in protocols:
                if protocol.lower() == 'aave':
                    tasks.append(self._collect_aave_data())
                elif protocol.lower() == 'compound':
                    tasks.append(self._collect_compound_data())
                elif protocol.lower() == 'yearn':
                    tasks.append(self._collect_yearn_data())
                elif protocol.lower() == 'uniswap':
                    tasks.append(self._collect_uniswap_data())
                elif protocol.lower() == 'curve':
                    tasks.append(self._collect_curve_data())
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            all_protocols = []
            for result in results:
                if isinstance(result, list):
                    all_protocols.extend(result)
                elif isinstance(result, Exception):
                    self.logger.error(f"Error collecting protocol data: {result}")
            
            return all_protocols
            
        except Exception as e:
            self.logger.error(f"Error in collect_protocol_data: {e}")
            return []

    async def _collect_aave_data(self) -> List[ProtocolData]:
        """Collect Aave protocol data."""
        try:
            url = f"{self.aave_api}/data/markets-data"
            async with self.session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"Aave API error: {response.status}")
                    return []
                
                data = await response.json()
                protocols = []
                
                for market in data:
                    if market.get('liquidityRate') and float(market['liquidityRate']) > 0:
                        apy = float(market['liquidityRate']) / 1e25 * 100  # Convert from ray to percentage
                        
                        protocol = ProtocolData(
                            name=f"Aave {market.get('symbol', 'Unknown')}",
                            chain='ethereum',
                            tvl=float(market.get('totalLiquidity', 0)),
                            apy=apy,
                            category='lending',
                            token_address=market.get('underlyingAsset', ''),
                            contract_address=market.get('aTokenAddress', ''),
                            last_updated=datetime.now()
                        )
                        protocols.append(protocol)
                
                return protocols
                
        except Exception as e:
            self.logger.error(f"Error collecting Aave data: {e}")
            return []

    async def _collect_compound_data(self) -> List[ProtocolData]:
        """Collect Compound protocol data."""
        try:
            url = f"{self.compound_api}/ctoken"
            async with self.session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"Compound API error: {response.status}")
                    return []
                
                data = await response.json()
                protocols = []
                
                for token in data.get('cToken', []):
                    supply_rate = token.get('supply_rate', {}).get('value', 0)
                    if supply_rate and float(supply_rate) > 0:
                        apy = float(supply_rate) * 100
                        
                        protocol = ProtocolData(
                            name=f"Compound {token.get('underlying_symbol', 'Unknown')}",
                            chain='ethereum',
                            tvl=float(token.get('total_supply', {}).get('value', 0)),
                            apy=apy,
                            category='lending',
                            token_address=token.get('underlying_address', ''),
                            contract_address=token.get('token_address', ''),
                            last_updated=datetime.now()
                        )
                        protocols.append(protocol)
                
                return protocols
                
        except Exception as e:
            self.logger.error(f"Error collecting Compound data: {e}")
            return []

    async def _collect_yearn_data(self) -> List[ProtocolData]:
        """Collect Yearn protocol data."""
        try:
            url = f"{self.yearn_api}/chains/ethereum/vaults/all"
            async with self.session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"Yearn API error: {response.status}")
                    return []
                
                data = await response.json()
                protocols = []
                
                for vault in data:
                    apy_data = vault.get('apy', {})
                    net_apy = apy_data.get('net_apy', 0)
                    
                    if net_apy and float(net_apy) > 0.001:  # Filter out very low APY vaults
                        tvl = vault.get('tvl', {}).get('tvl', 0)
                        
                        protocol = ProtocolData(
                            name=f"Yearn {vault.get('name', 'Unknown')}",
                            chain='ethereum',
                            tvl=float(tvl) if tvl else 0,
                            apy=float(net_apy) * 100,
                            category='yield_farming',
                            token_address=vault.get('token', {}).get('address', ''),
                            contract_address=vault.get('address', ''),
                            last_updated=datetime.now()
                        )
                        protocols.append(protocol)
                
                return protocols[:20]  # Limit to top 20 vaults
                
        except Exception as e:
            self.logger.error(f"Error collecting Yearn data: {e}")
            return []

    async def _collect_uniswap_data(self) -> List[ProtocolData]:
        """Collect Uniswap V3 pool data."""
        try:
            # Using The Graph for Uniswap V3 data
            url = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
            
            query = """
            {
              pools(first: 20, orderBy: totalValueLockedUSD, orderDirection: desc) {
                id
                token0 {
                  id
                  symbol
                }
                token1 {
                  id
                  symbol
                }
                feeTier
                totalValueLockedUSD
                volumeUSD
              }
            }
            """
            
            async with self.session.post(url, json={'query': query}) as response:
                if response.status != 200:
                    self.logger.error(f"Uniswap GraphQL error: {response.status}")
                    return []
                
                data = await response.json()
                pools = data.get('data', {}).get('pools', [])
                protocols = []
                
                for pool in pools:
                    tvl = float(pool.get('totalValueLockedUSD', 0))
                    volume_24h = float(pool.get('volumeUSD', 0))
                    
                    if tvl > 1000000:  # Only pools with >$1M TVL
                        # Estimate APY based on fees (simplified calculation)
                        fee_tier = float(pool.get('feeTier', 3000)) / 1000000  # Convert to percentage
                        estimated_apy = (volume_24h * fee_tier * 365) / tvl * 100 if tvl > 0 else 0
                        
                        token0_symbol = pool.get('token0', {}).get('symbol', '')
                        token1_symbol = pool.get('token1', {}).get('symbol', '')
                        
                        protocol = ProtocolData(
                            name=f"Uniswap V3 {token0_symbol}/{token1_symbol}",
                            chain='ethereum',
                            tvl=tvl,
                            apy=estimated_apy,
                            category='dex',
                            token_address=pool.get('token0', {}).get('id', ''),
                            contract_address=pool.get('id', ''),
                            last_updated=datetime.now()
                        )
                        protocols.append(protocol)
                
                return protocols
                
        except Exception as e:
            self.logger.error(f"Error collecting Uniswap data: {e}")
            return []

    async def _collect_curve_data(self) -> List[ProtocolData]:
        """Collect Curve protocol data."""
        try:
            url = "https://api.curve.fi/api/getPools/ethereum/main"
            async with self.session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"Curve API error: {response.status}")
                    return []
                
                data = await response.json()
                pools = data.get('data', {}).get('poolData', [])
                protocols = []
                
                for pool in pools:
                    apy_data = pool.get('gaugeCrvApy')
                    if apy_data and len(apy_data) > 0:
                        apy = float(apy_data[0]) if apy_data[0] else 0
                        tvl = float(pool.get('usdTotal', 0))
                        
                        if apy > 0 and tvl > 100000:  # Filter meaningful pools
                            protocol = ProtocolData(
                                name=f"Curve {pool.get('name', 'Unknown')}",
                                chain='ethereum',
                                tvl=tvl,
                                apy=apy,
                                category='dex',
                                token_address=pool.get('lpTokenAddress', ''),
                                contract_address=pool.get('address', ''),
                                last_updated=datetime.now()
                            )
                            protocols.append(protocol)
                
                return protocols[:15]  # Limit to top 15 pools
                
        except Exception as e:
            self.logger.error(f"Error collecting Curve data: {e}")
            return []

    async def get_protocol_tvl_history(self, protocol: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get TVL history for a specific protocol."""
        try:
            url = f"{self.defillama_api}/protocol/{protocol.lower()}"
            async with self.session.get(url) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                tvl_data = data.get('tvl', [])
                
                # Filter to last N days
                cutoff_date = datetime.now() - timedelta(days=days)
                cutoff_timestamp = cutoff_date.timestamp()
                
                filtered_data = [
                    {
                        'date': datetime.fromtimestamp(entry['date']),
                        'tvl': entry['totalLiquidityUSD']
                    }
                    for entry in tvl_data
                    if entry['date'] >= cutoff_timestamp
                ]
                
                return filtered_data
                
        except Exception as e:
            self.logger.error(f"Error getting TVL history for {protocol}: {e}")
            return []

    async def get_chain_tvl_data(self, chains: List[str] = None) -> Dict[str, float]:
        """Get TVL data by blockchain."""
        try:
            if not chains:
                chains = ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base']
            
            url = f"{self.defillama_api}/chains"
            async with self.session.get(url) as response:
                if response.status != 200:
                    return {}
                
                data = await response.json()
                chain_tvl = {}
                
                for chain_data in data:
                    chain_name = chain_data.get('name', '')
                    if chain_name in chains:
                        chain_tvl[chain_name.lower()] = float(chain_data.get('tvl', 0))
                
                return chain_tvl
                
        except Exception as e:
            self.logger.error(f"Error getting chain TVL data: {e}")
            return {}
