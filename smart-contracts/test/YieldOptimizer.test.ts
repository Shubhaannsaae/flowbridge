import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { YieldOptimizer, FlowToken } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("YieldOptimizer", function () {
  let yieldOptimizer: YieldOptimizer;
  let flowToken: FlowToken;
  let owner: SignerWithAddress;
  let vault: SignerWithAddress;
  let user1: SignerWithAddress;
  let treasury: SignerWithAddress;

  async function deployYieldOptimizerFixture() {
    [owner, vault, user1, treasury] = await ethers.getSigners();

    // Deploy FLOW token
    const FlowToken = await ethers.getContractFactory("FlowToken");
    flowToken = await upgrades.deployProxy(
      FlowToken,
      ["FlowBridge Token", "FLOW", treasury.address, owner.address],
      { initializer: "initialize" }
    ) as FlowToken;

    // Deploy YieldOptimizer
    const YieldOptimizer = await ethers.getContractFactory("YieldOptimizer");
    yieldOptimizer = await upgrades.deployProxy(
      YieldOptimizer,
      [owner.address],
      { initializer: "initialize" }
    ) as YieldOptimizer;

    // Grant vault role
    await yieldOptimizer.grantVaultRole(vault.address);

    return { yieldOptimizer, flowToken, owner, vault, user1, treasury };
  }

  beforeEach(async function () {
    ({ yieldOptimizer, flowToken, owner, vault, user1, treasury } = await loadFixture(deployYieldOptimizerFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct admin", async function () {
      const DEFAULT_ADMIN_ROLE = await yieldOptimizer.DEFAULT_ADMIN_ROLE();
      expect(await yieldOptimizer.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant vault role correctly", async function () {
      const VAULT_ROLE = await yieldOptimizer.VAULT_ROLE();
      expect(await yieldOptimizer.hasRole(VAULT_ROLE, vault.address)).to.be.true;
    });
  });

  describe("Protocol Management", function () {
    let mockProtocol: any;

    beforeEach(async function () {
      // Deploy mock yield protocol
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      mockProtocol = await MockYieldProtocol.deploy();
    });

    it("Should add protocol successfully", async function () {
      const tokenAddress = await flowToken.getAddress();
      const riskScore = 50;
      const gasEstimate = 200000;

      await expect(
        yieldOptimizer.addProtocol(tokenAddress, await mockProtocol.getAddress(), riskScore, gasEstimate)
      ).to.emit(yieldOptimizer, "ProtocolAdded")
        .withArgs(tokenAddress, await mockProtocol.getAddress(), riskScore);

      const protocols = await yieldOptimizer.getAvailableProtocols(tokenAddress);
      expect(protocols.length).to.equal(1);
      expect(protocols[0].protocolAddress).to.equal(await mockProtocol.getAddress());
      expect(protocols[0].riskScore).to.equal(riskScore);
    });

    it("Should reject invalid risk scores", async function () {
      await expect(
        yieldOptimizer.addProtocol(
          await flowToken.getAddress(),
          await mockProtocol.getAddress(),
          150, // Invalid risk score > 100
          200000
        )
      ).to.be.revertedWith("Risk score must be <= 100");
    });

    it("Should reject zero address protocols", async function () {
      await expect(
        yieldOptimizer.addProtocol(
          await flowToken.getAddress(),
          ethers.ZeroAddress,
          50,
          200000
        )
      ).to.be.revertedWith("Invalid protocol address");
    });

    it("Should only allow optimizer role to add protocols", async function () {
      await expect(
        yieldOptimizer.connect(user1).addProtocol(
          await flowToken.getAddress(),
          await mockProtocol.getAddress(),
          50,
          200000
        )
      ).to.be.reverted;
    });

    it("Should remove protocol successfully", async function () {
      const tokenAddress = await flowToken.getAddress();
      
      // First add a protocol
      await yieldOptimizer.addProtocol(tokenAddress, await mockProtocol.getAddress(), 50, 200000);
      
      // Then remove it
      await expect(
        yieldOptimizer.removeProtocol(tokenAddress, 0)
      ).to.emit(yieldOptimizer, "ProtocolRemoved")
        .withArgs(tokenAddress, await mockProtocol.getAddress());

      const protocols = await yieldOptimizer.getAvailableProtocols(tokenAddress);
      expect(protocols.length).to.equal(0);
    });
  });

  describe("Yield Optimization", function () {
    let mockProtocol1: any;
    let mockProtocol2: any;

    beforeEach(async function () {
      // Deploy multiple mock protocols
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      mockProtocol1 = await MockYieldProtocol.deploy();
      mockProtocol2 = await MockYieldProtocol.deploy();

      const tokenAddress = await flowToken.getAddress();

      // Add protocols with different risk scores
      await yieldOptimizer.addProtocol(tokenAddress, await mockProtocol1.getAddress(), 30, 200000);
      await yieldOptimizer.addProtocol(tokenAddress, await mockProtocol2.getAddress(), 60, 200000);
    });

    it("Should optimize yield allocation", async function () {
      const tokenAddress = await flowToken.getAddress();
      const totalAmount = ethers.parseEther("1000");
      const userRiskTolerance = 70;

      const result = await yieldOptimizer.connect(vault).optimizeYield(
        tokenAddress,
        totalAmount,
        userRiskTolerance
      );

      expect(result.protocols.length).to.be.gt(0);
      expect(result.allocations.length).to.be.gt(0);
      expect(result.expectedAPY).to.be.gt(0);
      expect(result.confidence).to.be.gt(0);
    });

    it("Should reject optimization with zero amount", async function () {
      await expect(
        yieldOptimizer.connect(vault).optimizeYield(
          await flowToken.getAddress(),
          0,
          50
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should reject optimization with invalid risk tolerance", async function () {
      await expect(
        yieldOptimizer.connect(vault).optimizeYield(
          await flowToken.getAddress(),
          ethers.parseEther("1000"),
          150 // Invalid risk tolerance > 100
        )
      ).to.be.revertedWith("Risk tolerance must be <= 100");
    });

    it("Should only allow vault to optimize", async function () {
      await expect(
        yieldOptimizer.connect(user1).optimizeYield(
          await flowToken.getAddress(),
          ethers.parseEther("1000"),
          50
        )
      ).to.be.reverted;
    });

    it("Should store optimization result", async function () {
      const tokenAddress = await flowToken.getAddress();
      const totalAmount = ethers.parseEther("1000");
      const userRiskTolerance = 50;

      await yieldOptimizer.connect(vault).optimizeYield(tokenAddress, totalAmount, userRiskTolerance);

      const result = await yieldOptimizer.getOptimizationResult(tokenAddress);
      expect(result.protocols.length).to.be.gt(0);
      expect(result.expectedAPY).to.be.gt(0);
    });
  });

  describe("Rebalancing Logic", function () {
    let mockProtocol: any;

    beforeEach(async function () {
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      mockProtocol = await MockYieldProtocol.deploy();

      await yieldOptimizer.addProtocol(
        await flowToken.getAddress(),
        await mockProtocol.getAddress(),
        50,
        200000
      );
    });

    it("Should determine when rebalancing is needed", async function () {
      const tokenAddress = await flowToken.getAddress();
      const protocols = [await mockProtocol.getAddress()];
      const allocations = [ethers.parseEther("1000")];

      const shouldRebalance = await yieldOptimizer.shouldRebalance(
        tokenAddress,
        protocols,
        allocations
      );

      // Should return boolean
      expect(typeof shouldRebalance).to.equal("boolean");
    });

    it("Should reject rebalancing check with mismatched arrays", async function () {
      const tokenAddress = await flowToken.getAddress();
      const protocols = [await mockProtocol.getAddress()];
      const allocations = [ethers.parseEther("1000"), ethers.parseEther("500")]; // Mismatched length

      await expect(
        yieldOptimizer.shouldRebalance(tokenAddress, protocols, allocations)
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  describe("Configuration Management", function () {
    it("Should update optimization configuration", async function () {
      const tokenAddress = await flowToken.getAddress();
      const config = {
        maxProtocols: 3,
        minAllocation: ethers.parseEther("100"),
        rebalanceThreshold: 1000, // 10%
        maxRiskScore: 80,
        gasThreshold: 100000,
        enableAutoRebalance: true
      };

      await expect(
        yieldOptimizer.updateOptimizationConfig(tokenAddress, config)
      ).to.emit(yieldOptimizer, "ConfigUpdated")
        .withArgs(tokenAddress, [config.maxProtocols, config.minAllocation, config.rebalanceThreshold, config.maxRiskScore, config.gasThreshold, config.enableAutoRebalance]);
    });

    it("Should reject invalid configuration", async function () {
      const tokenAddress = await flowToken.getAddress();
      const invalidConfig = {
        maxProtocols: 0, // Invalid
        minAllocation: ethers.parseEther("100"),
        rebalanceThreshold: 1000,
        maxRiskScore: 80,
        gasThreshold: 100000,
        enableAutoRebalance: true
      };

      await expect(
        yieldOptimizer.updateOptimizationConfig(tokenAddress, invalidConfig)
      ).to.be.revertedWith("Max protocols must be > 0");
    });

    it("Should only allow optimizer role to update config", async function () {
      const tokenAddress = await flowToken.getAddress();
      const config = {
        maxProtocols: 3,
        minAllocation: ethers.parseEther("100"),
        rebalanceThreshold: 1000,
        maxRiskScore: 80,
        gasThreshold: 100000,
        enableAutoRebalance: true
      };

      await expect(
        yieldOptimizer.connect(user1).updateOptimizationConfig(tokenAddress, config)
      ).to.be.reverted;
    });
  });

  describe("Protocol Data Updates", function () {
    let mockProtocol: any;

    beforeEach(async function () {
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      mockProtocol = await MockYieldProtocol.deploy();

      await yieldOptimizer.addProtocol(
        await flowToken.getAddress(),
        await mockProtocol.getAddress(),
        50,
        200000
      );
    });

    it("Should update protocol data manually", async function () {
      const tokenAddress = await flowToken.getAddress();

      await expect(
        yieldOptimizer.updateProtocolData(tokenAddress)
      ).to.not.be.reverted;
    });

    it("Should only allow optimizer role to update protocol data", async function () {
      await expect(
        yieldOptimizer.connect(user1).updateProtocolData(await flowToken.getAddress())
      ).to.be.reverted;
    });
  });

  describe("Statistics and Metrics", function () {
    it("Should track optimization statistics", async function () {
      const tokenAddress = await flowToken.getAddress();
      
      const stats = await yieldOptimizer.getOptimizationStats(tokenAddress);
      expect(stats.optimizations).to.equal(0); // Initial state
      expect(stats.gasSaved).to.equal(0);
      expect(stats.yieldGenerated).to.equal(0);
    });

    it("Should return empty optimization result for new token", async function () {
      const tokenAddress = await flowToken.getAddress();
      
      const result = await yieldOptimizer.getOptimizationResult(tokenAddress);
      expect(result.protocols.length).to.equal(0);
      expect(result.expectedAPY).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant vault role", async function () {
      const newVault = user1.address;
      
      await expect(
        yieldOptimizer.grantVaultRole(newVault)
      ).to.not.be.reverted;

      const VAULT_ROLE = await yieldOptimizer.VAULT_ROLE();
      expect(await yieldOptimizer.hasRole(VAULT_ROLE, newVault)).to.be.true;
    });

    it("Should allow admin to revoke vault role", async function () {
      await expect(
        yieldOptimizer.revokeVaultRole(vault.address)
      ).to.not.be.reverted;

      const VAULT_ROLE = await yieldOptimizer.VAULT_ROLE();
      expect(await yieldOptimizer.hasRole(VAULT_ROLE, vault.address)).to.be.false;
    });

    it("Should only allow admin to manage vault roles", async function () {
      await expect(
        yieldOptimizer.connect(user1).grantVaultRole(user1.address)
      ).to.be.reverted;
    });
  });
});
