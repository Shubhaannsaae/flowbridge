import { ethers } from 'ethers';
import axios from 'axios';
import { logger } from '../../utils/logger';

export interface CCTPTransfer {
  amount: string;
  sourceDomain: number;
  destinationDomain: number;
  nonce: number;
  sender: string;
  recipient: string;
  destinationCaller: string;
  mintRecipient: string;
  requestVersion: number;
  requestID: string;
  attestation?: string;
}

export interface CCTPRoute {
  sourceDomain: number;
  destinationDomain: number;
  sourceChain: string;
  destinationChain: string;
  estimatedTime: number;
  fee: string;
  supported: boolean;
}

export interface CCTPExecutionResult {
  success: boolean;
  burnTxHash?: string;
  mintTxHash?: string;
  attestation?: string;
  messageHash?: string;
  error?: string;
}

export class CircleCCTP {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private cctpAPI: string = 'https://iris-api.circle.com';
  
  // Circle CCTP contract addresses by chain
  private readonly cctpContracts = {
    ethereum: {
      tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
      messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
      tokenMinter: '0xc4922d64a24675E16e1586e3e3Aa56C06fABe907',
      usdc: '0xA0b86a33E6417c68c1CA1E32BcE04EF3D9C77E4E'
    },
    avalanche: {
      tokenMessenger: '0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982',
      messageTransmitter: '0x8186359aF5F57FbB40c6b14A588d2A59C0C29880',
      tokenMinter: '0x420f5035fd5dC62a167E7e7f08B604335ae272B8',
      usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
    },
    arbitrum: {
      tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
      messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
      tokenMinter: '0xE7Ed1fa7f45D05C508232aa32649D89b73b8bA48',
      usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    },
    optimism: {
      tokenMessenger: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
      messageTransmitter: '0x4d41f22c5a0e5c74090899E5a8Fb597a8842b3e8',
      tokenMinter: '0x33E76C5C31cb928dc6FE6487ab3b2C3f0f6Ad0AB',
      usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
    },
    base: {
      tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
      messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4',
      tokenMinter: '0xc4922d64a24675E16e1586e3e3Aa56C06fABe907',
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    },
    polygon: {
      tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
      messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
      tokenMinter: '0xE7Ed1fa7f45D05C508232aa32649D89b73b8bA48',
      usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    }
  };

  // Domain mappings for CCTP
  private readonly domainMappings = {
    ethereum: 0,
    avalanche: 1,
    optimism: 2,
    arbitrum: 3,
    base: 6,
    polygon: 7
  };

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const networks = {
      ethereum: process.env.ETHEREUM_RPC_URL!,
      avalanche: process.env.AVALANCHE_RPC_URL!,
      optimism: process.env.OPTIMISM_RPC_URL!,
      arbitrum: process.env.ARBITRUM_RPC_URL!,
      base: process.env.BASE_RPC_URL!,
      polygon: process.env.POLYGON_RPC_URL!
    };

    for (const [network, rpcUrl] of Object.entries(networks)) {
      this.providers.set(network, new ethers.providers.JsonRpcProvider(rpcUrl));
    }
  }

  async getRoute(
    sourceChain: string,
    destinationChain: string,
    amount: string
  ): Promise<CCTPRoute> {
    try {
      const sourceDomain = this.domainMappings[sourceChain as keyof typeof this.domainMappings];
      const destinationDomain = this.domainMappings[destinationChain as keyof typeof this.domainMappings];

      if (sourceDomain === undefined || destinationDomain === undefined) {
        throw new Error(`Unsupported chain. Source: ${sourceChain}, Destination: ${destinationChain}`);
      }

      // Check if route is supported
      const supported = this.isRouteSupported(sourceChain, destinationChain);
      
      // Estimate transfer time (typically 15-20 minutes for CCTP)
      const estimatedTime = 18 * 60; // 18 minutes in seconds

      // Calculate fee (CCTP has minimal fees, mostly gas)
      const fee = await this.estimateTransferFee(sourceChain, destinationChain, amount);

      return {
        sourceDomain,
        destinationDomain,
        sourceChain,
        destinationChain,
        estimatedTime,
        fee,
        supported
      };

    } catch (error) {
      logger.error('Error getting CCTP route:', error);
      throw new Error(`Failed to get CCTP route: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async depositForBurn(
    amount: string,
    destinationDomain: number,
    mintRecipient: string,
    burnToken: string,
    sourceChain: string,
    signer: ethers.Signer
  ): Promise<{
    txHash: string;
    messageHash: string;
    nonce: number;
  }> {
    try {
      const contracts = this.cctpContracts[sourceChain as keyof typeof this.cctpContracts];
      if (!contracts) {
        throw new Error(`CCTP not supported on ${sourceChain}`);
      }

      const tokenMessenger = new ethers.Contract(
        contracts.tokenMessenger,
        [
          'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)',
          'function localMinter() external view returns (address)'
        ],
        signer
      );

      // Convert mint recipient to bytes32
      const mintRecipientBytes32 = ethers.utils.hexZeroPad(mintRecipient, 32);

      // Execute deposit for burn
      const tx = await tokenMessenger.depositForBurn(
        amount,
        destinationDomain,
        mintRecipientBytes32,
        burnToken
      );

      const receipt = await tx.wait();
      
      // Extract nonce from logs
      const nonce = await this.extractNonceFromReceipt(receipt, sourceChain);
      
      // Calculate message hash
      const messageHash = await this.calculateMessageHash(receipt, sourceChain);

      logger.info(`CCTP burn transaction completed: ${tx.hash}, nonce: ${nonce}`);

      return {
        txHash: tx.hash,
        messageHash,
        nonce
      };

    } catch (error) {
      logger.error('Error in depositForBurn:', error);
      throw new Error(`Deposit for burn failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAttestation(messageHash: string): Promise<string> {
    try {
      // Poll for attestation from Circle's API
      const maxAttempts = 30; // 15 minutes with 30 second intervals
      const pollInterval = 30000; // 30 seconds

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await axios.get(
            `${this.cctpAPI}/attestations/${messageHash}`,
            {
              headers: {
                'accept': 'application/json'
              }
            }
          );

          if (response.data && response.data.status === 'complete') {
            logger.info(`Attestation received for message hash: ${messageHash}`);
            return response.data.attestation;
          }

          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
        } catch (apiError) {
          if (attempt === maxAttempts - 1) {
            throw apiError;
          }
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      throw new Error('Attestation timeout - attestation not received within expected timeframe');

    } catch (error) {
      logger.error(`Error getting attestation for ${messageHash}:`, error);
      throw new Error(`Failed to get attestation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async receiveMessage(
    message: string,
    attestation: string,
    destinationChain: string,
    signer: ethers.Signer
  ): Promise<string> {
    try {
      const contracts = this.cctpContracts[destinationChain as keyof typeof this.cctpContracts];
      if (!contracts) {
        throw new Error(`CCTP not supported on ${destinationChain}`);
      }

      const messageTransmitter = new ethers.Contract(
        contracts.messageTransmitter,
        [
          'function receiveMessage(bytes memory message, bytes memory attestation) external returns (bool success)'
        ],
        signer
      );

      // Execute receive message
      const tx = await messageTransmitter.receiveMessage(message, attestation);
      const receipt = await tx.wait();

      logger.info(`CCTP mint transaction completed: ${tx.hash}`);
      return tx.hash;

    } catch (error) {
      logger.error('Error in receiveMessage:', error);
      throw new Error(`Receive message failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeCCTPTransfer(
    amount: string,
    sourceChain: string,
    destinationChain: string,
    recipient: string,
    signer: ethers.Signer
  ): Promise<CCTPExecutionResult> {
    try {
      const route = await this.getRoute(sourceChain, destinationChain, amount);
      
      if (!route.supported) {
        return {
          success: false,
          error: `CCTP transfer not supported from ${sourceChain} to ${destinationChain}`
        };
      }

      const sourceContracts = this.cctpContracts[sourceChain as keyof typeof this.cctpContracts];
      if (!sourceContracts) {
        return {
          success: false,
          error: `CCTP contracts not found for ${sourceChain}`
        };
      }

      // Step 1: Approve USDC spending
      await this.approveUSDC(amount, sourceChain, signer);

      // Step 2: Deposit for burn
      const burnResult = await this.depositForBurn(
        amount,
        route.destinationDomain,
        recipient,
        sourceContracts.usdc,
        sourceChain,
        signer
      );

      // Step 3: Wait for and get attestation
      const attestation = await this.getAttestation(burnResult.messageHash);

      // Step 4: Get the message from the burn transaction
      const message = await this.extractMessageFromTx(burnResult.txHash, sourceChain);

      // Step 5: Execute mint on destination chain
      const destinationSigner = await this.getDestinationSigner(destinationChain, signer);
      const mintTxHash = await this.receiveMessage(
        message,
        attestation,
        destinationChain,
        destinationSigner
      );

      return {
        success: true,
        burnTxHash: burnResult.txHash,
        mintTxHash,
        attestation,
        messageHash: burnResult.messageHash
      };

    } catch (error) {
      logger.error('Error executing CCTP transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CCTP transfer failed'
      };
    }
  }

  async getTransferStatus(messageHash: string): Promise<{
    status: 'pending' | 'attested' | 'completed' | 'failed';
    attestation?: string;
    estimatedCompletionTime?: number;
  }> {
    try {
      const response = await axios.get(
        `${this.cctpAPI}/messages/${messageHash}`,
        {
          headers: {
            'accept': 'application/json'
          }
        }
      );

      const data = response.data;
      
      if (!data) {
        return { status: 'pending' };
      }

      if (data.attestation) {
        return {
          status: data.state === 'COMPLETE' ? 'completed' : 'attested',
          attestation: data.attestation
        };
      }

      // Estimate completion time based on timestamp
      const estimatedCompletionTime = data.timestamp ? 
        new Date(data.timestamp).getTime() + (20 * 60 * 1000) : // 20 minutes from creation
        Date.now() + (18 * 60 * 1000); // 18 minutes from now

      return {
        status: 'pending',
        estimatedCompletionTime
      };

    } catch (error) {
      logger.error(`Error getting transfer status for ${messageHash}:`, error);
      return { status: 'pending' };
    }
  }

  async getSupportedChains(): Promise<string[]> {
    return Object.keys(this.cctpContracts);
  }

  async getUSDCBalance(address: string, chain: string): Promise<string> {
    try {
      const provider = this.providers.get(chain);
      const contracts = this.cctpContracts[chain as keyof typeof this.cctpContracts];
      
      if (!provider || !contracts) {
        return '0';
      }

      const usdcContract = new ethers.Contract(
        contracts.usdc,
        [
          'function balanceOf(address account) external view returns (uint256)',
          'function decimals() external view returns (uint8)'
        ],
        provider
      );

      const balance = await usdcContract.balanceOf(address);
      const decimals = await usdcContract.decimals();

      return ethers.utils.formatUnits(balance, decimals);

    } catch (error) {
      logger.error(`Error getting USDC balance for ${address} on ${chain}:`, error);
      return '0';
    }
  }

  private isRouteSupported(sourceChain: string, destinationChain: string): boolean {
    return (
      sourceChain in this.cctpContracts &&
      destinationChain in this.cctpContracts &&
      sourceChain !== destinationChain
    );
  }

  private async estimateTransferFee(
    sourceChain: string,
    destinationChain: string,
    amount: string
  ): Promise<string> {
    try {
      // CCTP has minimal fees, mainly gas costs
      const sourceProvider = this.providers.get(sourceChain);
      const destinationProvider = this.providers.get(destinationChain);

      if (!sourceProvider || !destinationProvider) {
        return '5'; // Default $5 estimate
      }

      // Estimate gas for burn transaction
      const burnGasEstimate = 150000; // Conservative estimate
      const mintGasEstimate = 120000; // Conservative estimate

      const [sourceGasPrice, destinationGasPrice] = await Promise.all([
        sourceProvider.getGasPrice(),
        destinationProvider.getGasPrice()
      ]);

      // Convert gas costs to USD (simplified)
      const sourceGasCostETH = ethers.utils.formatEther(sourceGasPrice.mul(burnGasEstimate));
      const destinationGasCostETH = ethers.utils.formatEther(destinationGasPrice.mul(mintGasEstimate));

      // Assume ETH price of $2000 for estimation
      const totalFeeUSD = (parseFloat(sourceGasCostETH) + parseFloat(destinationGasCostETH)) * 2000;

      return Math.max(totalFeeUSD, 3).toFixed(2); // Minimum $3 fee

    } catch (error) {
      logger.error('Error estimating transfer fee:', error);
      return '5'; // Default estimate
    }
  }

  private async approveUSDC(amount: string, chain: string, signer: ethers.Signer): Promise<void> {
    const contracts = this.cctpContracts[chain as keyof typeof this.cctpContracts];
    if (!contracts) {
      throw new Error(`CCTP contracts not found for ${chain}`);
    }

    const usdcContract = new ethers.Contract(
      contracts.usdc,
      [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function allowance(address owner, address spender) external view returns (uint256)'
      ],
      signer
    );

    const signerAddress = await signer.getAddress();
    const currentAllowance = await usdcContract.allowance(signerAddress, contracts.tokenMessenger);

    if (currentAllowance.lt(amount)) {
      const approveTx = await usdcContract.approve(contracts.tokenMessenger, amount);
      await approveTx.wait();
      logger.info(`USDC approval completed: ${approveTx.hash}`);
    }
  }

  private async extractNonceFromReceipt(receipt: ethers.ContractReceipt, chain: string): Promise<number> {
    try {
      // Parse logs to find the DepositForBurn event
      const contracts = this.cctpContracts[chain as keyof typeof this.cctpContracts];
      const iface = new ethers.utils.Interface([
        'event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)'
      ]);

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'DepositForBurn') {
            return parsed.args.nonce.toNumber();
          }
        } catch (e) {
          // Continue if log doesn't match our interface
        }
      }

      throw new Error('DepositForBurn event not found in transaction receipt');

    } catch (error) {
      logger.error('Error extracting nonce from receipt:', error);
      throw error;
    }
  }

  private async calculateMessageHash(receipt: ethers.ContractReceipt, chain: string): Promise<string> {
    try {
      // Extract message hash from MessageSent event
      const iface = new ethers.utils.Interface([
        'event MessageSent(bytes message)'
      ]);

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'MessageSent') {
            return ethers.utils.keccak256(parsed.args.message);
          }
        } catch (e) {
          // Continue if log doesn't match our interface
        }
      }

      throw new Error('MessageSent event not found in transaction receipt');

    } catch (error) {
      logger.error('Error calculating message hash:', error);
      throw error;
    }
  }

  private async extractMessageFromTx(txHash: string, chain: string): Promise<string> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) {
        throw new Error(`Provider not found for ${chain}`);
      }

      const receipt = await provider.getTransactionReceipt(txHash);
      
      const iface = new ethers.utils.Interface([
        'event MessageSent(bytes message)'
      ]);

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'MessageSent') {
            return parsed.args.message;
          }
        } catch (e) {
          // Continue if log doesn't match our interface
        }
      }

      throw new Error('Message not found in transaction');

    } catch (error) {
      logger.error(`Error extracting message from tx ${txHash}:`, error);
      throw error;
    }
  }

  private async getDestinationSigner(destinationChain: string, sourceSigner: ethers.Signer): Promise<ethers.Signer> {
    // In a real implementation, this would handle cross-chain signer management
    // For now, assume the same signer can be used (e.g., via wallet connect)
    const destinationProvider = this.providers.get(destinationChain);
    if (!destinationProvider) {
      throw new Error(`Provider not found for destination chain: ${destinationChain}`);
    }

    // Connect the signer to the destination provider
    return sourceSigner.connect(destinationProvider);
  }
}
