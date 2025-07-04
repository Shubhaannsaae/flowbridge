import { run } from "hardhat";
import fs from "fs";
import path from "path";

interface DeploymentData {
  network: string;
  timestamp: string;
  deployer: string;
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

class ContractVerifier {
  private deploymentData: DeploymentData;

  constructor(deploymentData: DeploymentData) {
    this.deploymentData = deploymentData;
  }

  async verifyAll(): Promise<void> {
    console.log("🔍 Starting contract verification on", this.deploymentData.network);

    try {
      await this.verifyFlowToken();
      await this.verifyYFlowToken();
      await this.verifyTimeLock();
      await this.verifyGovernor();
      await this.verifyYieldOptimizer();
      await this.verifyRiskManager();
      await this.verifyLiquidityManager();
      await this.verifyVault();
      await this.verifyIntegrations();
      await this.verifyCardInterface();

      console.log("✅ All contracts verified successfully!");

    } catch (error) {
      console.error("❌ Verification failed:", error);
      throw error;
    }
  }

  private async verifyContract(
    contractAddress: string,
    contractName: string,
    constructorArguments: any[] = []
  ): Promise<void> {
    console.log(`\n🔍 Verifying ${contractName}...`);
    
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: constructorArguments,
      });
      console.log(`✅ ${contractName} verified:`, contractAddress);
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log(`ℹ️ ${contractName} already verified:`, contractAddress);
      } else {
        console.error(`❌ Failed to verify ${contractName}:`, error.message);
        throw error;
      }
    }
  }

  private async verifyFlowToken(): Promise<void> {
    // For proxy contracts, we verify the implementation
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.flowToken
    );

    await this.verifyContract(
      implementationAddress,
      "FlowToken Implementation"
    );

    // Verify proxy if needed
    await this.verifyContract(
      this.deploymentData.addresses.flowToken,
      "FlowToken Proxy"
    );
  }

  private async verifyYFlowToken(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.yFlowToken
    );

    await this.verifyContract(
      implementationAddress,
      "yFLOW Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.yFlowToken,
      "yFLOW Proxy"
    );
  }

  private async verifyTimeLock(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.timeLock
    );

    await this.verifyContract(
      implementationAddress,
      "TimeLockController Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.timeLock,
      "TimeLockController Proxy"
    );
  }

  private async verifyGovernor(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.governor
    );

    await this.verifyContract(
      implementationAddress,
      "FlowBridgeGovernor Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.governor,
      "FlowBridgeGovernor Proxy"
    );
  }

  private async verifyYieldOptimizer(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.yieldOptimizer
    );

    await this.verifyContract(
      implementationAddress,
      "YieldOptimizer Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.yieldOptimizer,
      "YieldOptimizer Proxy"
    );
  }

  private async verifyRiskManager(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.riskManager
    );

    await this.verifyContract(
      implementationAddress,
      "RiskManager Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.riskManager,
      "RiskManager Proxy"
    );
  }

  private async verifyLiquidityManager(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.liquidityManager
    );

    await this.verifyContract(
      implementationAddress,
      "LiquidityManager Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.liquidityManager,
      "LiquidityManager Proxy"
    );
  }

  private async verifyVault(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.vault
    );

    await this.verifyContract(
      implementationAddress,
      "FlowBridgeVault Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.vault,
      "FlowBridgeVault Proxy"
    );
  }

  private async verifyIntegrations(): Promise<void> {
    // LiFi Integration
    const lifiImplementation = await this.getImplementationAddress(
      this.deploymentData.addresses.lifiIntegration
    );
    await this.verifyContract(lifiImplementation, "LiFiIntegration Implementation");
    await this.verifyContract(this.deploymentData.addresses.lifiIntegration, "LiFiIntegration Proxy");

    // Circle Integration
    const circleImplementation = await this.getImplementationAddress(
      this.deploymentData.addresses.circleIntegration
    );
    await this.verifyContract(circleImplementation, "CircleIntegration Implementation");
    await this.verifyContract(this.deploymentData.addresses.circleIntegration, "CircleIntegration Proxy");

    // MetaMask DTK
    const dtkImplementation = await this.getImplementationAddress(
      this.deploymentData.addresses.metamaskDTK
    );
    await this.verifyContract(dtkImplementation, "MetaMaskDTK Implementation");
    await this.verifyContract(this.deploymentData.addresses.metamaskDTK, "MetaMaskDTK Proxy");
  }

  private async verifyCardInterface(): Promise<void> {
    const implementationAddress = await this.getImplementationAddress(
      this.deploymentData.addresses.cardInterface
    );

    await this.verifyContract(
      implementationAddress,
      "CardInterface Implementation"
    );

    await this.verifyContract(
      this.deploymentData.addresses.cardInterface,
      "CardInterface Proxy"
    );
  }

  private async getImplementationAddress(proxyAddress: string): Promise<string> {
    try {
      // Get implementation address from proxy
      const { ethers } = await import("hardhat");
      const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      const implementationHex = await ethers.provider.getStorage(proxyAddress, implementationSlot);
      return ethers.getAddress("0x" + implementationHex.slice(-40));
    } catch (error) {
      console.log(`Could not get implementation for ${proxyAddress}, using proxy address`);
      return proxyAddress;
    }
  }
}

async function main() {
  const networkArg = process.argv[2];
  
  if (!networkArg) {
    console.error("Please provide network name as argument");
    console.error("Usage: npx hardhat run scripts/verify.ts --network <network> <network-name>");
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
  console.log("Deployed at:", deploymentData.timestamp);

  const verifier = new ContractVerifier(deploymentData);
  await verifier.verifyAll();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
