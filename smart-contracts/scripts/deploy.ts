import { ethers, upgrades } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import fs from "fs";
import path from "path";

interface DeploymentAddresses {
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
}

interface DeploymentConfig {
  network: string;
  deployer: string;
  treasury: string;
  initialTokenHolder: string;
  governanceDelay: number;
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: string;
  quorumFraction: number;
}

class FlowBridgeDeployer {
  private deploymentAddresses: Partial<DeploymentAddresses> = {};
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async deployAll(): Promise<DeploymentAddresses> {
    console.log("🚀 Starting FlowBridge Protocol Deployment");
    console.log("Network:", this.config.network);
    console.log("Deployer:", this.config.deployer);

    try {
      // Deploy in dependency order
      await this.deployFlowToken();
      await this.deployTimeLock();
      await this.deployGovernor();
      await this.deployYieldOptimizer();
      await this.deployRiskManager();
      await this.deployLiquidityManager();
      await this.deployVault();
      await this.deployYFlowToken();
      await this.deployIntegrations();
      await this.deployCardInterface();

      // Save deployment addresses
      await this.saveDeploymentAddresses();

      console.log("✅ All contracts deployed successfully!");
      return this.deploymentAddresses as DeploymentAddresses;

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }

  private async deployFlowToken(): Promise<void> {
    console.log("\n📄 Deploying FLOW Token...");

    const FlowToken = await ethers.getContractFactory("FlowToken");
    
    const flowToken = await upgrades.deployProxy(
      FlowToken,
      [
        "FlowBridge Token",
        "FLOW",
        this.config.treasury,
        this.config.initialTokenHolder
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await flowToken.waitForDeployment();
    this.deploymentAddresses.flowToken = await flowToken.getAddress();

    console.log("✅ FLOW Token deployed:", this.deploymentAddresses.flowToken);
  }

  private async deployTimeLock(): Promise<void> {
    console.log("\n⏰ Deploying TimeLock Controller...");

    const TimeLockController = await ethers.getContractFactory("TimeLockController");
    
    const timeLock = await upgrades.deployProxy(
      TimeLockController,
      [
        this.config.governanceDelay,  // minDelay
        [],                          // proposers (will be set to governor)
        [],                          // executors (will be set to governor)
        this.config.deployer        // admin
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await timeLock.waitForDeployment();
    this.deploymentAddresses.timeLock = await timeLock.getAddress();

    console.log("✅ TimeLock Controller deployed:", this.deploymentAddresses.timeLock);
  }

  private async deployGovernor(): Promise<void> {
    console.log("\n🏛️ Deploying FlowBridge Governor...");

    const FlowBridgeGovernor = await ethers.getContractFactory("FlowBridgeGovernor");
    
    const governanceConfig = {
      votingDelay: this.config.votingDelay,
      votingPeriod: this.config.votingPeriod,
      proposalThreshold: ethers.parseEther(this.config.proposalThreshold),
      quorumFraction: this.config.quorumFraction,
      timelockDelay: this.config.governanceDelay
    };

    const governor = await upgrades.deployProxy(
      FlowBridgeGovernor,
      [
        this.deploymentAddresses.flowToken,    // FLOW token for voting
        this.deploymentAddresses.timeLock,     // TimeLock controller
        governanceConfig,                      // Governance configuration
        this.config.treasury                   // Treasury address
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await governor.waitForDeployment();
    this.deploymentAddresses.governor = await governor.getAddress();

    console.log("✅ FlowBridge Governor deployed:", this.deploymentAddresses.governor);

    // Configure TimeLock roles
    await this.configureTimeLockRoles();
  }

  private async deployYieldOptimizer(): Promise<void> {
    console.log("\n🎯 Deploying Yield Optimizer...");

    const YieldOptimizer = await ethers.getContractFactory("YieldOptimizer");
    
    const yieldOptimizer = await upgrades.deployProxy(
      YieldOptimizer,
      [this.config.deployer],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await yieldOptimizer.waitForDeployment();
    this.deploymentAddresses.yieldOptimizer = await yieldOptimizer.getAddress();

    console.log("✅ Yield Optimizer deployed:", this.deploymentAddresses.yieldOptimizer);
  }

  private async deployRiskManager(): Promise<void> {
    console.log("\n⚠️ Deploying Risk Manager...");

    const RiskManager = await ethers.getContractFactory("RiskManager");
    
    const riskManager = await upgrades.deployProxy(
      RiskManager,
      [this.config.deployer],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await riskManager.waitForDeployment();
    this.deploymentAddresses.riskManager = await riskManager.getAddress();

    console.log("✅ Risk Manager deployed:", this.deploymentAddresses.riskManager);
  }

  private async deployLiquidityManager(): Promise<void> {
    console.log("\n💧 Deploying Liquidity Manager...");

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    
    const liquidityManager = await upgrades.deployProxy(
      LiquidityManager,
      [
        this.config.deployer,
        "0x0000000000000000000000000000000000000000", // Will be set to card interface
        "0x0000000000000000000000000000000000000000"  // Will be set to vault
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await liquidityManager.waitForDeployment();
    this.deploymentAddresses.liquidityManager = await liquidityManager.getAddress();

    console.log("✅ Liquidity Manager deployed:", this.deploymentAddresses.liquidityManager);
  }

  private async deployVault(): Promise<void> {
    console.log("\n🏦 Deploying FlowBridge Vault...");

    const FlowBridgeVault = await ethers.getContractFactory("FlowBridgeVault");
    
    const vault = await upgrades.deployProxy(
      FlowBridgeVault,
      [
        this.config.deployer,
        this.deploymentAddresses.liquidityManager
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await vault.waitForDeployment();
    this.deploymentAddresses.vault = await vault.getAddress();

    console.log("✅ FlowBridge Vault deployed:", this.deploymentAddresses.vault);

    // Grant roles to connected contracts
    await this.configureVaultRoles();
  }

  private async deployYFlowToken(): Promise<void> {
    console.log("\n📈 Deploying yFLOW Token...");

    const YFlowToken = await ethers.getContractFactory("yFLOW");
    
    const yFlowToken = await upgrades.deployProxy(
      YFlowToken,
      [
        this.deploymentAddresses.flowToken,  // Underlying asset (FLOW)
        "Yield FlowBridge Token",            // Token name
        "yFLOW",                            // Token symbol
        this.deploymentAddresses.vault,     // Vault contract
        this.config.treasury                // Fee recipient
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await yFlowToken.waitForDeployment();
    this.deploymentAddresses.yFlowToken = await yFlowToken.getAddress();

    console.log("✅ yFLOW Token deployed:", this.deploymentAddresses.yFlowToken);
  }

  private async deployIntegrations(): Promise<void> {
    console.log("\n🌉 Deploying Integrations...");

    // Deploy LiFi Integration
    const LiFiIntegration = await ethers.getContractFactory("LiFiIntegration");
    const lifiIntegration = await upgrades.deployProxy(
      LiFiIntegration,
      [this.config.deployer, this.config.treasury],
      { kind: "uups", initializer: "initialize" }
    );
    await lifiIntegration.waitForDeployment();
    this.deploymentAddresses.lifiIntegration = await lifiIntegration.getAddress();
    console.log("✅ LiFi Integration deployed:", this.deploymentAddresses.lifiIntegration);

    // Deploy Circle Integration
    const CircleIntegration = await ethers.getContractFactory("CircleIntegration");
    const circleIntegration = await upgrades.deployProxy(
      CircleIntegration,
      [this.config.deployer, this.config.treasury],
      { kind: "uups", initializer: "initialize" }
    );
    await circleIntegration.waitForDeployment();
    this.deploymentAddresses.circleIntegration = await circleIntegration.getAddress();
    console.log("✅ Circle Integration deployed:", this.deploymentAddresses.circleIntegration);

    // Deploy MetaMask DTK
    const MetaMaskDTK = await ethers.getContractFactory("MetaMaskDTK");
    const metamaskDTK = await upgrades.deployProxy(
      MetaMaskDTK,
      [this.config.deployer],
      { kind: "uups", initializer: "initialize" }
    );
    await metamaskDTK.waitForDeployment();
    this.deploymentAddresses.metamaskDTK = await metamaskDTK.getAddress();
    console.log("✅ MetaMask DTK deployed:", this.deploymentAddresses.metamaskDTK);
  }

  private async deployCardInterface(): Promise<void> {
    console.log("\n💳 Deploying Card Interface...");

    const CardInterface = await ethers.getContractFactory("CardInterface");
    
    const cardInterface = await upgrades.deployProxy(
      CardInterface,
      [
        this.config.deployer,
        this.deploymentAddresses.liquidityManager,
        this.deploymentAddresses.vault
      ],
      {
        kind: "uups",
        initializer: "initialize"
      }
    );

    await cardInterface.waitForDeployment();
    this.deploymentAddresses.cardInterface = await cardInterface.getAddress();

    console.log("✅ Card Interface deployed:", this.deploymentAddresses.cardInterface);

    // Update liquidity manager with card interface address
    await this.updateLiquidityManagerCardInterface();
  }

  private async configureTimeLockRoles(): Promise<void> {
    console.log("\n🔧 Configuring TimeLock roles...");

    const timeLock = await ethers.getContractAt("TimeLockController", this.deploymentAddresses.timeLock!);
    
    const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timeLock.TIMELOCK_ADMIN_ROLE();

    // Grant proposer role to governor
    await timeLock.grantRole(PROPOSER_ROLE, this.deploymentAddresses.governor!);
    
    // Grant executor role to governor (and keep zero address for anyone to execute)
    await timeLock.grantRole(EXECUTOR_ROLE, this.deploymentAddresses.governor!);
    
    // Revoke admin role from deployer (governance takes over)
    await timeLock.revokeRole(TIMELOCK_ADMIN_ROLE, this.config.deployer);

    console.log("✅ TimeLock roles configured");
  }

  private async configureVaultRoles(): Promise<void> {
    console.log("\n🔧 Configuring Vault roles...");

    const vault = await ethers.getContractAt("FlowBridgeVault", this.deploymentAddresses.vault!);
    const yieldOptimizer = await ethers.getContractAt("YieldOptimizer", this.deploymentAddresses.yieldOptimizer!);
    const riskManager = await ethers.getContractAt("RiskManager", this.deploymentAddresses.riskManager!);

    // Grant vault role to yield optimizer
    await yieldOptimizer.grantVaultRole(this.deploymentAddresses.vault!);
    
    // Grant vault role to risk manager
    await riskManager.grantVaultRole(this.deploymentAddresses.vault!);

    console.log("✅ Vault roles configured");
  }

  private async updateLiquidityManagerCardInterface(): Promise<void> {
    console.log("\n🔧 Updating Liquidity Manager card interface...");

    const liquidityManager = await ethers.getContractAt("LiquidityManager", this.deploymentAddresses.liquidityManager!);
    
    // This would require an admin function to update the card interface
    // For now, we'll log that this needs to be done manually
    console.log("⚠️ Manual step required: Update liquidity manager with card interface address");
    console.log("Card Interface:", this.deploymentAddresses.cardInterface);
  }

  private async saveDeploymentAddresses(): Promise<void> {
    const deploymentData = {
      network: this.config.network,
      timestamp: new Date().toISOString(),
      deployer: this.config.deployer,
      addresses: this.deploymentAddresses,
      config: this.config
    };

    const outputDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `${this.config.network}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(deploymentData, null, 2));

    console.log("\n💾 Deployment addresses saved to:", outputFile);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const config: DeploymentConfig = {
    network: network.name,
    deployer: deployer.address,
    treasury: process.env.TREASURY_ADDRESS || deployer.address,
    initialTokenHolder: process.env.INITIAL_TOKEN_HOLDER || deployer.address,
    governanceDelay: parseInt(process.env.GOVERNANCE_DELAY || "172800"), // 2 days
    votingDelay: parseInt(process.env.VOTING_DELAY || "7200"),           // 1 day in blocks
    votingPeriod: parseInt(process.env.VOTING_PERIOD || "50400"),        // 7 days in blocks
    proposalThreshold: process.env.PROPOSAL_THRESHOLD || "1000000",      // 1M FLOW tokens
    quorumFraction: parseInt(process.env.QUORUM_FRACTION || "4")         // 4%
  };

  console.log("Deployment configuration:", config);

  const deployer_contract = new FlowBridgeDeployer(config);
  await deployer_contract.deployAll();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
