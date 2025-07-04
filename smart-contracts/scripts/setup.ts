import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

interface DeploymentData {
  network: string;
  addresses: {
    flowToken: string;
    yFlowToken: string;
    timeLock: string;
    governor: string;
    vault: string;
    yieldOptimizer: string;
    liquidityManager: string;
    riskManager: string;
    lifiIntegration: string;
    circleIntegration: string;
    metamaskDTK: string;
    cardInterface: string;
  };
  config: any;
}

class FlowBridgeSetup {
  private deploymentData: DeploymentData;
  private contracts: { [key: string]: any } = {};

  constructor(deploymentData: DeploymentData) {
    this.deploymentData = deploymentData;
  }

  async setupAll(): Promise<void> {
    console.log("🛠️ Starting FlowBridge Protocol Setup");
    console.log("Network:", this.deploymentData.network);

    try {
      await this.loadContracts();
      await this.setupTokens();
      await this.setupGovernance();
      await this.setupVault();
      await this.setupRiskManagement();
      await this.setupIntegrations();
      await this.setupInitialConfiguration();
      await this.transferOwnership();

      console.log("✅ FlowBridge Protocol setup completed successfully!");

    } catch (error) {
      console.error("❌ Setup failed:", error);
      throw error;
    }
  }

  private async loadContracts(): Promise<void> {
    console.log("\n📄 Loading deployed contracts...");

    const contractNames = [
      "flowToken", "yFlowToken", "timeLock", "governor", "vault",
      "yieldOptimizer", "liquidityManager", "riskManager",
      "lifiIntegration", "circleIntegration", "metamaskDTK", "cardInterface"
    ];

    for (const contractName of contractNames) {
      const address = this.deploymentData.addresses[contractName as keyof typeof this.deploymentData.addresses];
      if (address) {
        // Convert contract name to actual contract factory name
        const factoryName = this.getFactoryName(contractName);
        this.contracts[contractName] = await ethers.getContractAt(factoryName, address);
        console.log(`✅ Loaded ${contractName}:`, address);
      }
    }
  }

  private getFactoryName(contractName: string): string {
    const factoryMap: { [key: string]: string } = {
      flowToken: "FlowToken",
      yFlowToken: "yFLOW",
      timeLock: "TimeLockController",
      governor: "FlowBridgeGovernor",
      vault: "FlowBridgeVault",
      yieldOptimizer: "YieldOptimizer",
      liquidityManager: "LiquidityManager",
      riskManager: "RiskManager",
      lifiIntegration: "LiFiIntegration",
      circleIntegration: "CircleIntegration",
      metamaskDTK: "MetaMaskDTK",
      cardInterface: "CardInterface"
    };
    return factoryMap[contractName] || contractName;
  }

  private async setupTokens(): Promise<void> {
    console.log("\n🪙 Setting up tokens...");

    // Add emission schedule for FLOW token
    const currentTime = Math.floor(Date.now() / 1000);
    const emissionStart = currentTime + 86400; // Start tomorrow
    const emissionEnd = emissionStart + (365 * 86400); // 1 year
    const tokensPerSecond = ethers.parseEther("0.1"); // 0.1 FLOW per second

    try {
      await this.contracts.flowToken.addEmissionSchedule(
        emissionStart,
        emissionEnd,
        tokensPerSecond
      );
      console.log("✅ FLOW token emission schedule added");
    } catch (error) {
      console.log("⚠️ Emission schedule may already exist or role issue");
    }

    // Setup yFLOW token parameters
    try {
      await this.contracts.yFlowToken.updateMinimumDeposit(ethers.parseEther("1"));
      console.log("✅ yFLOW minimum deposit set to 1 FLOW");
    } catch (error) {
      console.log("⚠️ Could not update yFLOW minimum deposit");
    }
  }

  private async setupGovernance(): Promise<void> {
    console.log("\n🏛️ Setting up governance...");

    // Add vault as managed contract
    try {
      await this.contracts.governor.addManagedContract(
        this.deploymentData.addresses.vault,
        "FlowBridgeVault"
      );
      console.log("✅ Vault added as managed contract");
    } catch (error) {
      console.log("⚠️ Vault may already be managed or role issue");
    }

    // Add other core contracts as managed
    const managedContracts = [
      { address: this.deploymentData.addresses.yieldOptimizer, type: "YieldOptimizer" },
      { address: this.deploymentData.addresses.riskManager, type: "RiskManager" },
      { address: this.deploymentData.addresses.liquidityManager, type: "LiquidityManager" }
    ];

    for (const contract of managedContracts) {
      try {
        await this.contracts.governor.addManagedContract(contract.address, contract.type);
        console.log(`✅ ${contract.type} added as managed contract`);
      } catch (error) {
        console.log(`⚠️ ${contract.type} may already be managed`);
      }
    }
  }

  private async setupVault(): Promise<void> {
    console.log("\n🏦 Setting up vault...");

    // Add supported tokens (starting with USDC)
    const supportedTokens = [
      "0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c", // USDC mainnet
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // WETH mainnet
    ];

    for (const token of supportedTokens) {
      try {
        await this.contracts.vault.addSupportedToken(token);
        console.log(`✅ Added supported token: ${token}`);
      } catch (error) {
        console.log(`⚠️ Token may already be supported: ${token}`);
      }
    }

    // Configure vault parameters
    try {
      await this.contracts.vault.updateVaultParameters(
        500,   // 5% rebalance threshold
        100,   // 1% management fee
        1000   // 10% performance fee
      );
      console.log("✅ Vault parameters configured");
    } catch (error) {
      console.log("⚠️ Could not update vault parameters");
    }
  }

  private async setupRiskManagement(): Promise<void> {
    console.log("\n⚠️ Setting up risk management...");

    // Whitelist major DeFi protocols
    const whitelistedProtocols = [
      "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", // Aave LendingPool
      "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", // Compound cDAI
      "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"  // Compound cUSDC
    ];

    for (const protocol of whitelistedProtocols) {
      try {
        await this.contracts.riskManager.whitelistProtocol(protocol);
        console.log(`✅ Whitelisted protocol: ${protocol}`);
      } catch (error) {
        console.log(`⚠️ Protocol may already be whitelisted: ${protocol}`);
      }
    }

    // Set global risk limits
    try {
      const riskLimits = {
        maxProtocolRisk: 80,    // Max 80/100 risk score
        maxPortfolioRisk: 60,   // Max 60/100 portfolio risk
        maxConcentration: 3000, // Max 30% in single protocol
        maxLeverage: 300,       // Max 3x leverage
        minLiquidity: ethers.parseEther("1000000"), // Min $1M liquidity
        maxVolatility: 5000     // Max 50% volatility
      };

      await this.contracts.riskManager.updateGlobalRiskLimits(riskLimits);
      console.log("✅ Global risk limits set");
    } catch (error) {
      console.log("⚠️ Could not update global risk limits");
    }
  }

  private async setupIntegrations(): Promise<void> {
    console.log("\n🌉 Setting up integrations...");

    // Setup LiFi Integration
    try {
      // Add supported chains
      const supportedChains = [1, 137, 42161, 10, 8453]; // Ethereum, Polygon, Arbitrum, Optimism, Base
      
      for (const chainId of supportedChains) {
        await this.contracts.lifiIntegration.addSupportedChain(chainId);
      }
      console.log("✅ LiFi supported chains configured");
    } catch (error) {
      console.log("⚠️ Could not configure LiFi chains");
    }

    // Setup Circle Integration
    try {
      // Add supported domains for CCTP
      const domains = [
        { domain: 0, chainId: 1 },     // Ethereum
        { domain: 1, chainId: 43114 }, // Avalanche
        { domain: 2, chainId: 10 },    // Optimism
        { domain: 3, chainId: 42161 }, // Arbitrum
        { domain: 6, chainId: 8453 }   // Base
      ];

      for (const { domain, chainId } of domains) {
        await this.contracts.circleIntegration.addSupportedDomain(domain, chainId);
      }
      console.log("✅ Circle CCTP domains configured");
    } catch (error) {
      console.log("⚠️ Could not configure Circle domains");
    }

    // Grant roles between contracts
    try {
      await this.contracts.lifiIntegration.grantVaultRole(this.deploymentData.addresses.vault);
      await this.contracts.circleIntegration.grantVaultRole(this.deploymentData.addresses.vault);
      console.log("✅ Integration vault roles granted");
    } catch (error) {
      console.log("⚠️ Could not grant integration vault roles");
    }
  }

  private async setupInitialConfiguration(): Promise<void> {
    console.log("\n⚙️ Setting up initial configuration...");

    // Configure liquidity manager pools
    try {
      const tokens = [
        "0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c", // USDC
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"  // WETH
      ];

      for (const token of tokens) {
        await this.contracts.liquidityManager.createOrUpdatePool(
          token,
          1000, // 10% reserve ratio
          8000  // 80% max utilization
        );
      }
      console.log("✅ Liquidity pools configured");
    } catch (error) {
      console.log("⚠️ Could not configure liquidity pools");
    }

    // Add supported tokens to card interface
    try {
      const cardTokens = [
        { address: "0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c", decimals: 6 }, // USDC
        { address: this.deploymentData.addresses.flowToken, decimals: 18 }         // FLOW
      ];

      for (const token of cardTokens) {
        await this.contracts.cardInterface.addSupportedToken(token.address, token.decimals);
      }
      console.log("✅ Card supported tokens configured");
    } catch (error) {
      console.log("⚠️ Could not configure card tokens");
    }
  }

  private async transferOwnership(): Promise<void> {
    console.log("\n👑 Transferring ownership to governance...");

    const governorAddress = this.deploymentData.addresses.governor;

    // List of contracts that should be owned by governance
    const contractsToTransfer = [
      "vault", "yieldOptimizer", "riskManager", "liquidityManager",
      "lifiIntegration", "circleIntegration", "cardInterface"
    ];

    for (const contractName of contractsToTransfer) {
      try {
        const contract = this.contracts[contractName];
        
        // Check if contract has DEFAULT_ADMIN_ROLE
        const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
        await contract.grantRole(DEFAULT_ADMIN_ROLE, governorAddress);
        
        console.log(`✅ Granted admin role to governance for ${contractName}`);
      } catch (error) {
        console.log(`⚠️ Could not transfer ${contractName} ownership:`, error);
      }
    }

    console.log("⚠️ IMPORTANT: Manual step required:");
    console.log("- Revoke admin roles from deployer address through governance proposals");
    console.log("- Test governance functionality before revoking deployer access");
  }
}

async function main() {
  const networkArg = process.argv[2];
  
  if (!networkArg) {
    console.error("Please provide network name as argument");
    console.error("Usage: npx hardhat run scripts/setup.ts --network <network> <network-name>");
    process.exit(1);
  }

  const deploymentFile = path.join(__dirname, "..", "deployments", `${networkArg}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file not found: ${deploymentFile}`);
    console.error("Please run deployment script first");
    process.exit(1);
  }

  const deploymentData: DeploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  
  console.log("Loaded deployment data for network:", deploymentData.network);

  const setup = new FlowBridgeSetup(deploymentData);
  await setup.setupAll();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
