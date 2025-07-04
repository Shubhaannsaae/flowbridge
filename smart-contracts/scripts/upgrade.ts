import { ethers, upgrades } from "hardhat";
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
}

interface UpgradeResult {
  contractName: string;
  proxyAddress: string;
  oldImplementation: string;
  newImplementation: string;
  success: boolean;
  error?: string;
}

class FlowBridgeUpgrader {
  private deploymentData: DeploymentData;

  constructor(deploymentData: DeploymentData) {
    this.deploymentData = deploymentData;
  }

  async upgradeAll(): Promise<UpgradeResult[]> {
    console.log("🔄 Starting FlowBridge Protocol Upgrades");
    console.log("Network:", this.deploymentData.network);

    const results: UpgradeResult[] = [];

    try {
      // Upgrade all contracts
      results.push(await this.upgradeContract("FlowToken", "flowToken"));
      results.push(await this.upgradeContract("yFLOW", "yFlowToken"));
      results.push(await this.upgradeContract("TimeLockController", "timeLock"));
      results.push(await this.upgradeContract("FlowBridgeGovernor", "governor"));
      results.push(await this.upgradeContract("FlowBridgeVault", "vault"));
      results.push(await this.upgradeContract("YieldOptimizer", "yieldOptimizer"));
      results.push(await this.upgradeContract("LiquidityManager", "liquidityManager"));
      results.push(await this.upgradeContract("RiskManager", "riskManager"));
      results.push(await this.upgradeContract("LiFiIntegration", "lifiIntegration"));
      results.push(await this.upgradeContract("CircleIntegration", "circleIntegration"));
      results.push(await this.upgradeContract("MetaMaskDTK", "metamaskDTK"));
      results.push(await this.upgradeContract("CardInterface", "cardInterface"));

      // Save upgrade results
      await this.saveUpgradeResults(results);

      const successCount = results.filter(r => r.success).length;
      console.log(`\n✅ Upgrade completed: ${successCount}/${results.length} contracts upgraded successfully`);

      return results;

    } catch (error) {
      console.error("❌ Upgrade process failed:", error);
      throw error;
    }
  }

  async upgradeContract(contractName: string, deploymentKey: string): Promise<UpgradeResult> {
    console.log(`\n🔄 Upgrading ${contractName}...`);

    try {
      const proxyAddress = this.deploymentData.addresses[deploymentKey as keyof typeof this.deploymentData.addresses];
      
      if (!proxyAddress) {
        throw new Error(`No deployment address found for ${contractName}`);
      }

      // Get current implementation address
      const oldImplementation = await this.getImplementationAddress(proxyAddress);

      // Get contract factory
      const ContractFactory = await ethers.getContractFactory(contractName);

      // Validate upgrade compatibility
      console.log(`  📋 Validating upgrade compatibility for ${contractName}...`);
      await upgrades.validateUpgrade(proxyAddress, ContractFactory);

      // Perform upgrade
      console.log(`  🚀 Deploying new implementation for ${contractName}...`);
      const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory);
      await upgraded.waitForDeployment();

      // Get new implementation address
      const newImplementation = await this.getImplementationAddress(proxyAddress);

      console.log(`  ✅ ${contractName} upgraded successfully`);
      console.log(`    Proxy: ${proxyAddress}`);
      console.log(`    Old Implementation: ${oldImplementation}`);
      console.log(`    New Implementation: ${newImplementation}`);

      return {
        contractName,
        proxyAddress,
        oldImplementation,
        newImplementation,
        success: true
      };

    } catch (error: any) {
      console.log(`  ❌ Failed to upgrade ${contractName}: ${error.message}`);
      
      return {
        contractName,
        proxyAddress: this.deploymentData.addresses[deploymentKey as keyof typeof this.deploymentData.addresses] || "unknown",
        oldImplementation: "unknown",
        newImplementation: "unknown",
        success: false,
        error: error.message
      };
    }
  }

  async upgradeSpecificContract(contractName: string): Promise<UpgradeResult> {
    const deploymentKeyMap: { [key: string]: string } = {
      "FlowToken": "flowToken",
      "yFLOW": "yFlowToken",
      "TimeLockController": "timeLock",
      "FlowBridgeGovernor": "governor",
      "FlowBridgeVault": "vault",
      "YieldOptimizer": "yieldOptimizer",
      "LiquidityManager": "liquidityManager",
      "RiskManager": "riskManager",
      "LiFiIntegration": "lifiIntegration",
      "CircleIntegration": "circleIntegration",
      "MetaMaskDTK": "metamaskDTK",
      "CardInterface": "cardInterface"
    };

    const deploymentKey = deploymentKeyMap[contractName];
    if (!deploymentKey) {
      throw new Error(`Unknown contract name: ${contractName}`);
    }

    return await this.upgradeContract(contractName, deploymentKey);
  }

  async prepareUpgrade(contractName: string): Promise<string> {
    console.log(`\n🔄 Preparing upgrade for ${contractName}...`);

    const deploymentKeyMap: { [key: string]: string } = {
      "FlowToken": "flowToken",
      "yFLOW": "yFlowToken", 
      "TimeLockController": "timeLock",
      "FlowBridgeGovernor": "governor",
      "FlowBridgeVault": "vault",
      "YieldOptimizer": "yieldOptimizer",
      "LiquidityManager": "liquidityManager",
      "RiskManager": "riskManager",
      "LiFiIntegration": "lifiIntegration",
      "CircleIntegration": "circleIntegration",
      "MetaMaskDTK": "metamaskDTK",
      "CardInterface": "cardInterface"
    };

    const deploymentKey = deploymentKeyMap[contractName];
    if (!deploymentKey) {
      throw new Error(`Unknown contract name: ${contractName}`);
    }

    const proxyAddress = this.deploymentData.addresses[deploymentKey as keyof typeof this.deploymentData.addresses];
    
    if (!proxyAddress) {
      throw new Error(`No deployment address found for ${contractName}`);
    }

    // Get contract factory
    const ContractFactory = await ethers.getContractFactory(contractName);

    // Prepare upgrade (deploy new implementation)
    console.log(`  🚀 Deploying new implementation for ${contractName}...`);
    const implementationAddress = await upgrades.prepareUpgrade(proxyAddress, ContractFactory);

    console.log(`  ✅ New implementation deployed: ${implementationAddress}`);
    console.log(`  📋 Use this address in governance proposal to upgrade proxy: ${proxyAddress}`);

    return implementationAddress as string;
  }

  private async getImplementationAddress(proxyAddress: string): Promise<string> {
    try {
      const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      const implementationHex = await ethers.provider.getStorage(proxyAddress, implementationSlot);
      return ethers.getAddress("0x" + implementationHex.slice(-40));
    } catch (error) {
      return "unknown";
    }
  }

  private async saveUpgradeResults(results: UpgradeResult[]): Promise<void> {
    const upgradeData = {
      network: this.deploymentData.network,
      timestamp: new Date().toISOString(),
      results: results
    };

    const outputDir = path.join(__dirname, "..", "upgrades");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `${this.deploymentData.network}_${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(upgradeData, null, 2));

    console.log("\n💾 Upgrade results saved to:", outputFile);
  }

  async validateAllUpgrades(): Promise<{ [contractName: string]: boolean }> {
    console.log("\n🔍 Validating all potential upgrades...");

    const validationResults: { [contractName: string]: boolean } = {};

    const contracts = [
      { name: "FlowToken", key: "flowToken" },
      { name: "yFLOW", key: "yFlowToken" },
      { name: "TimeLockController", key: "timeLock" },
      { name: "FlowBridgeGovernor", key: "governor" },
      { name: "FlowBridgeVault", key: "vault" },
      { name: "YieldOptimizer", key: "yieldOptimizer" },
      { name: "LiquidityManager", key: "liquidityManager" },
      { name: "RiskManager", key: "riskManager" },
      { name: "LiFiIntegration", key: "lifiIntegration" },
      { name: "CircleIntegration", key: "circleIntegration" },
      { name: "MetaMaskDTK", key: "metamaskDTK" },
      { name: "CardInterface", key: "cardInterface" }
    ];

    for (const contract of contracts) {
      try {
        const proxyAddress = this.deploymentData.addresses[contract.key as keyof typeof this.deploymentData.addresses];
        const ContractFactory = await ethers.getContractFactory(contract.name);
        
        await upgrades.validateUpgrade(proxyAddress, ContractFactory);
        validationResults[contract.name] = true;
        console.log(`  ✅ ${contract.name}: Valid for upgrade`);
        
      } catch (error: any) {
        validationResults[contract.name] = false;
        console.log(`  ❌ ${contract.name}: ${error.message}`);
      }
    }

    return validationResults;
  }
}

async function main() {
  const action = process.argv[2];
  const networkArg = process.argv[3];
  const contractName = process.argv[4];

  if (!action || !networkArg) {
    console.error("Usage:");
    console.error("  npx hardhat run scripts/upgrade.ts --network <network> upgrade-all <network-name>");
    console.error("  npx hardhat run scripts/upgrade.ts --network <network> upgrade <network-name> <contract-name>");
    console.error("  npx hardhat run scripts/upgrade.ts --network <network> prepare <network-name> <contract-name>");
    console.error("  npx hardhat run scripts/upgrade.ts --network <network> validate <network-name>");
    process.exit(1);
  }

  const deploymentFile = path.join(__dirname, "..", "deployments", `${networkArg}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file not found: ${deploymentFile}`);
    process.exit(1);
  }

  const deploymentData: DeploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const upgrader = new FlowBridgeUpgrader(deploymentData);

  switch (action) {
    case "upgrade-all":
      await upgrader.upgradeAll();
      break;
      
    case "upgrade":
      if (!contractName) {
        console.error("Contract name required for single upgrade");
        process.exit(1);
      }
      await upgrader.upgradeSpecificContract(contractName);
      break;
      
    case "prepare":
      if (!contractName) {
        console.error("Contract name required for prepare upgrade");
        process.exit(1);
      }
      await upgrader.prepareUpgrade(contractName);
      break;
      
    case "validate":
      await upgrader.validateAllUpgrades();
      break;
      
    default:
      console.error("Unknown action:", action);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
