import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json

@dataclass
class YieldOpportunity:
    protocol: str
    pool_name: str
    apy: float
    tvl: float
    risk_score: int
    category: str
    chain: str
    token_symbols: List[str]
    contract_address: str
    minimum_deposit: float
    lock_period: int
    last_updated: datetime

class YieldScanner:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # API endpoints for yield data
        self.defillama_yields_api = "https://yields.llama.fi"
        self.yearn_api = "https://api.yearn.finance/v1"
        self.beefy_api = "https://api.beefy.finance"
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'FlowBridge-AI/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def scan_yield_opportunities(self, 
                                     min_apy: float = 1.0, 
                                     min_tvl: float = 100000,
                                     chains: List[str] = None) -> List[YieldOpportunity]:
        """Scan for yield opportunities across multiple protocols."""
        try:
            if not chains:
                chains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche']
            
            tasks = [
                self._scan_defillama_yields(min_apy, min_tvl, chains),
                self._scan_yearn_yields(min_apy, min_tvl),
                self._scan_beefy_yields(min_apy, min_tvl, chains)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            all_opportunities = []
            for result in results:
                if isinstance(result, list):
                    all_opportunities.extend(result)
                elif isinstance(result, Exception):
                    self.logger.error(f"Error scanning yields: {result}")
            
            # Remove duplicates and sort by APY
            unique_opportunities = self._deduplicate_opportunities(all_opportunities)
            return sorted(unique_opportunities, key=lambda x: x.apy, reverse=True)
            
        except Exception as e:
            self.logger.error(f"Error scanning yield opportunities: {e}")
            return []

    async def _scan_defillama_yields(self, min_apy: float, min_tvl: float, chains: List[str]) -> List[YieldOpportunity]:
        """Scan DeFiLlama yield data."""
        try:
            url = f"{self.defillama_yields_api}/pools"
            async with self.session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"DeFiLlama yields API error: {response.status}")
                    return []
                
                data = await response.json()
                opportunities = []
                
                for pool in data.get('data', []):
                    apy = pool.get('apy', 0)
                    tvl = pool.get('tvlUsd', 0)
                    chain = pool.get('chain', '').lower()
                    
                    if (apy >= min_apy and 
                        tvl >= min_tvl and 
                        chain in chains and
                        pool.get('exposure', '') != 'multi'):  # Avoid complex multi-asset exposure
                        
                        # Calculate risk score based on various factors
                        risk_score = self._calculate_risk_score(pool)
                        
                        opportunity = YieldOpportunity(
                            protocol=pool.get('project', 'Unknown'),
                            pool_name=pool.get('symbol', ''),
                            apy=apy,
                            tvl=tvl,
                            risk_score=risk_score,
                            category=self._categorize_pool(pool),
                            chain=chain,
                            token_symbols=pool.get('symbol', '').split('-'),
                            contract_address=pool.get('pool', ''),
                            minimum_deposit=0,  # DeFiLlama doesn't provide this
                            lock_period=0,  # Most pools have no lock period
                            last_updated=datetime.now()
                        )
                        opportunities.append(opportunity)
                
                return opportunities[:50]  # Limit to top 50
                
        except Exception as e:
            self.logger.error(f"Error scanning DeFiLlama yields: {e}")
            return []

    async def _scan_yearn_yields(self, min_apy: float, min_tvl: float) -> List[YieldOpportunity]:
        """Scan Yearn vault yields."""
        try:
            url = f"{self.yearn_api}/chains/ethereum/vaults/all"
            async with self.session.get(url) as response:
                if response.status != 200:
                    self.logger.error(f"Yearn API error: {response.status}")
                    return []
                
                data = await response.json()
                opportunities = []
                
                for vault in data:
                    apy_data = vault.get('apy', {})
                    net_apy = apy_data.get('net_apy', 0)
                    tvl = vault.get('tvl', {}).get('tvl', 0)
                    
                    if net_apy and net_apy * 100 >= min_apy and tvl >= min_tvl:
                        opportunity = YieldOpportunity(
                            protocol='Yearn',
                            pool_name=vault.get('name', ''),
                            apy=net_apy * 100,
                            tvl=tvl,
                            risk_score=3,  # Yearn vaults are generally medium risk
                            category='yield_farming',
                            chain='ethereum',
                            token_symbols=[vault.get('token', {}).get('symbol', '')],
                            contract_address=vault.get('address', ''),
                            minimum_deposit=0,
                            lock_period=0,
                            last_updated=datetime.now()
                        )
                        opportunities.append(opportunity)
                
                return opportunities
                
        except Exception as e:
            self.logger.error(f"Error scanning Yearn yields: {e}")
            return []

    async def _scan_beefy_yields(self, min_apy: float, min_tvl: float, chains: List[str]) -> List[YieldOpportunity]:
        """Scan Beefy Finance yields."""
        try:
            # Get Beefy vaults
            vaults_url = f"{self.beefy_api}/vaults"
            async with self.session.get(vaults_url) as response:
                if response.status != 200:
                    return []
                
                vaults = await response.json()
            
            # Get APY data
            apy_url = f"{self.beefy_api}/apy"
            async with self.session.get(apy_url) as response:
                if response.status != 200:
                    return []
                
                apy_data = await response.json()
            
            # Get TVL data
            tvl_url = f"{self.beefy_api}/tvl"
            async with self.session.get(tvl_url) as response:
                if response.status != 200:
                    return []
                
                tvl_data = await response.json()
            
            opportunities = []
            
            for vault in vaults:
                vault_id = vault.get('id', '')
                chain = vault.get('chain', '').lower()
                
                if chain not in chains:
                    continue
                
                apy = apy_data.get(vault_id, 0) * 100 if vault_id in apy_data else 0
                tvl = tvl_data.get(vault_id, 0) if vault_id in tvl_data else 0
                
                if apy >= min_apy and tvl >= min_tvl:
                    # Parse token symbols from vault name
                    tokens = vault.get('name', '').split('-')[:2]  # Usually format like "TOKEN1-TOKEN2"
                    
                    opportunity = YieldOpportunity(
                        protocol='Beefy',
                        pool_name=vault.get('name', ''),
                        apy=apy,
                        tvl=tvl,
                        risk_score=self._calculate_beefy_risk_score(vault),
                        category='yield_farming',
                        chain=chain,
                        token_symbols=tokens,
                        contract_address=vault.get('earnContractAddress', ''),
                        minimum_deposit=0,
                        lock_period=0,
                        last_updated=datetime.now()
                    )
                    opportunities.append(opportunity)
            
            return opportunities[:30]  # Limit to top 30
            
        except Exception as e:
            self.logger.error(f"Error scanning Beefy yields: {e}")
            return []

    async def get_yield_trends(self, pool_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get historical yield trends for a specific pool."""
        try:
            url = f"{self.defillama_yields_api}/chart/{pool_id}"
            async with self.session.get(url) as response:
                if response.status != 200:
                    return []
                
                data = await response.json()
                trends = []
                
                for entry in data.get('data', []):
                    trends.append({
                        'timestamp': datetime.fromisoformat(entry.get('timestamp', '')),
                        'apy': entry.get('apy', 0),
                        'tvl': entry.get('tvlUsd', 0)
                    })
                
                # Filter to requested timeframe
                if days < len(trends):
                    trends = trends[-days:]
                
                return trends
                
        except Exception as e:
            self.logger.error(f"Error getting yield trends for {pool_id}: {e}")
            return []

    async def scan_staking_opportunities(self, chains: List[str] = None) -> List[YieldOpportunity]:
        """Scan for staking opportunities."""
        try:
            if not chains:
                chains = ['ethereum', 'polygon', 'avalanche']
            
            opportunities = []
            
            # Ethereum staking (simplified - would need to check actual staking providers)
            if 'ethereum' in chains:
                eth_staking = YieldOpportunity(
                    protocol='Ethereum Staking',
                    pool_name='ETH 2.0 Staking',
                    apy=4.5,  # Approximate current rate
                    tvl=50000000000,  # ~$50B staked
                    risk_score=2,  # Low risk
                    category='staking',
                    chain='ethereum',
                    token_symbols=['ETH'],
                    contract_address='',
                    minimum_deposit=32,  # 32 ETH minimum for direct staking
                    lock_period=0,  # Until withdrawals enabled
                    last_updated=datetime.now()
                )
                opportunities.append(eth_staking)
            
            # Polygon staking
            if 'polygon' in chains:
                matic_staking = YieldOpportunity(
                    protocol='Polygon Staking',
                    pool_name='MATIC Staking',
                    apy=6.8,  # Approximate current rate
                    tvl=2000000000,  # ~$2B staked
                    risk_score=3,  # Medium risk
                    category='staking',
                    chain='polygon',
                    token_symbols=['MATIC'],
                    contract_address='',
                    minimum_deposit=1,  # 1 MATIC minimum
                    lock_period=3,  # ~3 days unbonding
                    last_updated=datetime.now()
                )
                opportunities.append(matic_staking)
            
            return opportunities
            
        except Exception as e:
            self.logger.error(f"Error scanning staking opportunities: {e}")
            return []

    def _calculate_risk_score(self, pool_data: Dict[str, Any]) -> int:
        """Calculate risk score for a pool (1-10, where 10 is highest risk)."""
        score = 5  # Base score
        
        # TVL factor
        tvl = pool_data.get('tvlUsd', 0)
        if tvl > 100000000:  # > $100M
            score -= 1
        elif tvl < 1000000:  # < $1M
            score += 2
        
        # Age factor
        age_days = pool_data.get('poolMeta', {}).get('ageDays', 0)
        if age_days > 365:  # > 1 year
            score -= 1
        elif age_days < 30:  # < 1 month
            score += 2
        
        # Protocol factor
        project = pool_data.get('project', '').lower()
        if project in ['aave', 'compound', 'uniswap', 'curve']:
            score -= 1  # Blue chip protocols
        
        # IL risk for LP tokens
        if 'lp' in pool_data.get('symbol', '').lower():
            score += 1
        
        return max(1, min(10, score))

    def _calculate_beefy_risk_score(self, vault_data: Dict[str, Any]) -> int:
        """Calculate risk score for Beefy vault."""
        score = 4  # Beefy is generally medium risk
        
        # Strategy type
        strategy = vault_data.get('stratType', '').lower()
        if 'lp' in strategy:
            score += 1  # LP strategies have IL risk
        
        # Platform
        platform = vault_data.get('platformId', '').lower()
        if platform in ['pancakeswap', 'quickswap']:
            score += 1  # Higher risk platforms
        
        return max(1, min(10, score))

    def _categorize_pool(self, pool_data: Dict[str, Any]) -> str:
        """Categorize the pool type."""
        project = pool_data.get('project', '').lower()
        symbol = pool_data.get('symbol', '').lower()
        
        if project in ['aave', 'compound']:
            return 'lending'
        elif project in ['uniswap', 'curve', 'balancer']:
            return 'dex'
        elif 'lp' in symbol or '-' in symbol:
            return 'liquidity_provision'
        elif project in ['yearn', 'convex']:
            return 'yield_farming'
        else:
            return 'other'

    def _deduplicate_opportunities(self, opportunities: List[YieldOpportunity]) -> List[YieldOpportunity]:
        """Remove duplicate opportunities based on contract address and pool name."""
        seen = set()
        unique_opportunities = []
        
        for opp in opportunities:
            key = (opp.contract_address, opp.pool_name)
            if key not in seen:
                seen.add(key)
                unique_opportunities.append(opp)
        
        return unique_opportunities
