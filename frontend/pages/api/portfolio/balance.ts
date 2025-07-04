// FlowBridge Frontend - Portfolio Balance API
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { isValidAddress, getProvider } from '../../../utils/web3';
import { SUPPORTED_CHAINS, ERC20_ABI } from '../../../utils/constants';

interface BalanceRequest {
  chainId: number;
  tokenAddresses?: string[];
}

interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  usdValue: string;
}

interface BalanceResponse {
  success: boolean;
  data?: {
    address: string;
    chainId: number;
    nativeBalance: string;
    nativeSymbol: string;
    nativeUsdValue: string;
    tokenBalances: TokenBalance[];
    totalUsdValue: string;
    lastUpdated: string;
  };
  error?: string;
}

// Default tokens to check for each chain
const DEFAULT_TOKENS: Record<number, Array<{address: string, symbol: string, name: string}>> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    { address: '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c', symbol: 'USDC', name: 'USD Coin' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD' },
  ],
  [SUPPORTED_CHAINS.POLYGON]: [
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin' },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', name: 'Wrapped Ether' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin' },
  ],
  [SUPPORTED_CHAINS.ARBITRUM]: [
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', name: 'USD Coin' },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', name: 'Wrapped Ether' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin' },
  ],
};

// Verify JWT token
function verifyToken(authorization: string | undefined): { address: string; chainId: number } | null {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authorization.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    return { address: decoded.address, chainId: decoded.chainId };
  } catch (error) {
    return null;
  }
}

// Get token balance using ethers
async function getTokenBalance(
  provider: ethers.providers.Provider,
  tokenAddress: string,
  userAddress: string
): Promise<{ balance: string; decimals: number; symbol: string; name: string }> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const [balance, decimals, symbol, name] = await Promise.all([
      contract.balanceOf(userAddress),
      contract.decimals(),
      contract.symbol(),
      contract.name(),
    ]);
    
    return {
      balance: balance.toString(),
      decimals,
      symbol,
      name,
    };
  } catch (error) {
    console.error(`Error fetching token balance for ${tokenAddress}:`, error);
    throw error;
  }
}

// Get USD price for token (simplified - would use real price API)
async function getTokenPrice(symbol: string): Promise<number> {
  try {
    // In production, integrate with CoinGecko, CoinMarketCap, or DeFi price feeds
    const mockPrices: Record<string, number> = {
      'ETH': 2500,
      'WETH': 2500,
      'USDC': 1,
      'USDT': 1,
      'DAI': 1,
      'MATIC': 0.8,
      'ARB': 1.2,
    };
    
    return mockPrices[symbol.toUpperCase()] || 0;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return 0;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BalanceResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Verify authentication
    const auth = verifyToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { address } = auth;
    const chainId = parseInt(req.query.chainId as string) || auth.chainId;
    const tokenAddresses = req.query.tokenAddresses as string[] | undefined;

    // Validate chain ID
    if (!Object.values(SUPPORTED_CHAINS).includes(chainId)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported chain ID'
      });
    }

    // Get provider for the specified chain
    const provider = getProvider(chainId);
    if (!provider) {
      return res.status(500).json({
        success: false,
        error: 'Unable to connect to blockchain provider'
      });
    }

    // Get native token balance
    const nativeBalance = await provider.getBalance(address);
    const nativeSymbol = chainId === SUPPORTED_CHAINS.POLYGON ? 'MATIC' : 'ETH';
    const nativePrice = await getTokenPrice(nativeSymbol);
    const nativeUsdValue = (parseFloat(ethers.utils.formatEther(nativeBalance)) * nativePrice).toFixed(2);

    // Get token balances
    const tokensToCheck = tokenAddresses || DEFAULT_TOKENS[chainId]?.map(t => t.address) || [];
    const tokenBalances: TokenBalance[] = [];
    let totalUsdValue = parseFloat(nativeUsdValue);

    for (const tokenAddress of tokensToCheck) {
      if (!isValidAddress(tokenAddress)) {
        continue;
      }

      try {
        const tokenData = await getTokenBalance(provider, tokenAddress, address);
        const price = await getTokenPrice(tokenData.symbol);
        const balanceFormatted = ethers.utils.formatUnits(tokenData.balance, tokenData.decimals);
        const usdValue = (parseFloat(balanceFormatted) * price).toFixed(2);

        // Only include tokens with non-zero balance
        if (parseFloat(balanceFormatted) > 0) {
          tokenBalances.push({
            tokenAddress,
            tokenSymbol: tokenData.symbol,
            tokenName: tokenData.name,
            balance: tokenData.balance,
            decimals: tokenData.decimals,
            usdValue,
          });

          totalUsdValue += parseFloat(usdValue);
        }
      } catch (error) {
        console.error(`Failed to fetch balance for token ${tokenAddress}:`, error);
        // Continue with other tokens
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        address,
        chainId,
        nativeBalance: nativeBalance.toString(),
        nativeSymbol,
        nativeUsdValue,
        tokenBalances,
        totalUsdValue: totalUsdValue.toFixed(2),
        lastUpdated: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Balance API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
