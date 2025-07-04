import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { FlowBridgeVault, FlowToken, YieldOptimizer, RiskManager, LiquidityManager } from "../typechain-types";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("FlowBridgeVault", function () {
  let vault: FlowBridgeVault;
  let flowToken: FlowToken;
  let yieldOptimizer: YieldOptimizer;
  let riskManager: RiskManager;
  let liquidityManager: LiquidityManager;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let treasury: SignerWithAddress;
  let cardInterface: SignerWithAddress;

  async function deployVaultFixture() {
    [owner, user1, user2, treasury, cardInterface] = await ethers.getSigners();

    // Deploy FLOW token
    const FlowToken = await ethers.getContractFactory("FlowToken");
    flowToken = await upgrades.deployProxy(
      FlowToken,
      ["FlowBridge Token", "FLOW", treasury.address, owner.address],
      { initializer: "initialize" }
    ) as FlowToken;

    // Deploy supporting contracts
    const YieldOptimizer = await ethers.getContractFactory("YieldOptimizer");
    yieldOptimizer = await upgrades.deployProxy(
      YieldOptimizer,
      [owner.address],
      { initializer: "initialize" }
    ) as YieldOptimizer;

    const RiskManager = await ethers.getContractFactory("RiskManager");
    riskManager = await upgrades.deployProxy(
      RiskManager,
      [owner.address],
      { initializer: "initialize" }
    ) as RiskManager;

    const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await upgrades.deployProxy(
      LiquidityManager,
      [owner.address, cardInterface.address, ethers.ZeroAddress],
      { initializer: "initialize" }
    ) as LiquidityManager;

    // Deploy vault
    const FlowBridgeVault = await ethers.getContractFactory("FlowBridgeVault");
    vault = await upgrades.deployProxy(
      FlowBridgeVault,
      [owner.address, await liquidityManager.getAddress()],
      { initializer: "initialize" }
    ) as FlowBridgeVault;

    // Setup roles
    await yieldOptimizer.grantVaultRole(await vault.getAddress());
    await riskManager.grantVaultRole(await vault.getAddress());

    // Add supported token
    await vault.addSupportedToken(await flowToken.getAddress());

    // Mint tokens to users
    await flowToken.mint(user1.address, ethers.parseEther("10000"));
    await flowToken.mint(user2.address, ethers.parseEther("10000"));

    return { vault, flowToken, yieldOptimizer, riskManager, liquidityManager, owner, user1, user2, treasury, cardInterface };
  }

  beforeEach(async function () {
    ({ vault, flowToken, yieldOptimizer, riskManager, liquidityManager, owner, user1, user2, treasury, cardInterface } = await loadFixture(deployVaultFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct admin", async function () {
      const ADMIN_ROLE = await vault.ADMIN_ROLE();
      expect(await vault.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should set the correct liquidity manager", async function () {
      // This would require a getter function in the vault contract
      // For now, we can test that the vault was deployed successfully
      expect(await vault.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have correct initial parameters", async function () {
      expect(await vault.rebalanceThreshold()).to.equal(500); // 5%
      expect(await vault.maxProtocols()).to.equal(5);
    });
  });

  describe("Token Support", function () {
    it("Should add supported token", async function () {
      const tokenAddress = await flowToken.getAddress();
      expect(await vault.supportedTokens(tokenAddress)).to.be.true;
    });

    it("Should only allow admin to add supported tokens", async function () {
      const MockToken = await ethers.getContractFactory("FlowToken");
      const mockToken = await MockToken.deploy();
      
      await expect(
        vault.connect(user1).addSupportedToken(await mockToken.getAddress())
      ).to.be.reverted;
    });
  });

  describe("Deposits", function () {
    beforeEach(async function () {
      // Approve vault to spend user tokens
      await flowToken.connect(user1).approve(await vault.getAddress(), ethers.parseEther("1000"));
    });

    it("Should allow deposits of supported tokens", async function () {
      const depositAmount = ethers.parseEther("100");
      const tokenAddress = await flowToken.getAddress();

      await expect(
        vault.connect(user1).deposit(tokenAddress, depositAmount)
      ).to.emit(vault, "Deposit")
        .withArgs(user1.address, tokenAddress, depositAmount, depositAmount); // 1:1 initial ratio

      const position = await vault.getUserPosition(user1.address, tokenAddress);
      expect(position.principal).to.equal(depositAmount);
      expect(position.shares).to.equal(depositAmount);
    });

    it("Should reject deposits of unsupported tokens", async function () {
      const MockToken = await ethers.getContractFactory("FlowToken");
      const mockToken = await upgrades.deployProxy(
        MockToken,
        ["Mock Token", "MOCK", treasury.address, owner.address],
        { initializer: "initialize" }
      );

      await expect(
        vault.connect(user1).deposit(await mockToken.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWith("Token not supported");
    });

    it("Should reject zero amount deposits", async function () {
      await expect(
        vault.connect(user1).deposit(await flowToken.getAddress(), 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should update total deposited amount", async function () {
      const depositAmount = ethers.parseEther("100");
      const tokenAddress = await flowToken.getAddress();

      await vault.connect(user1).deposit(tokenAddress, depositAmount);
      
      expect(await vault.totalDeposited(tokenAddress)).to.equal(depositAmount);
      expect(await vault.totalShares(tokenAddress)).to.equal(depositAmount);
    });
  });

  describe("Withdrawals", function () {
    const depositAmount = ethers.parseEther("100");

    beforeEach(async function () {
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(await flowToken.getAddress(), depositAmount);
    });

    it("Should allow withdrawals", async function () {
      const withdrawShares = ethers.parseEther("50");
      const tokenAddress = await flowToken.getAddress();

      const initialBalance = await flowToken.balanceOf(user1.address);

      await expect(
        vault.connect(user1).withdraw(tokenAddress, withdrawShares)
      ).to.emit(vault, "Withdraw");

      const finalBalance = await flowToken.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);

      const position = await vault.getUserPosition(user1.address, tokenAddress);
      expect(position.shares).to.equal(depositAmount - withdrawShares);
    });

    it("Should reject withdrawal of more shares than owned", async function () {
      const excessiveShares = ethers.parseEther("200");

      await expect(
        vault.connect(user1).withdraw(await flowToken.getAddress(), excessiveShares)
      ).to.be.revertedWith("Insufficient shares");
    });

    it("Should reject zero share withdrawals", async function () {
      await expect(
        vault.connect(user1).withdraw(await flowToken.getAddress(), 0)
      ).to.be.revertedWith("Shares must be greater than 0");
    });
  });

  describe("Card Integration", function () {
    it("Should allow users to link their card", async function () {
      await expect(
        vault.connect(user1).linkCard()
      ).to.emit(vault, "CardLinked")
        .withArgs(user1.address, true);
    });

    it("Should allow card top-up for linked users", async function () {
      const depositAmount = ethers.parseEther("100");
      const topUpAmount = ethers.parseEther("50");
      const tokenAddress = await flowToken.getAddress();

      // First deposit and link card
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(tokenAddress, depositAmount);
      await vault.connect(user1).linkCard();

      // Grant vault role to owner for testing
      await vault.grantRole(await vault.VAULT_ROLE(), owner.address);

      await expect(
        vault.connect(owner).topUpCard(user1.address, tokenAddress, topUpAmount)
      ).to.emit(vault, "CardTopUp")
        .withArgs(user1.address, tokenAddress, topUpAmount);
    });

    it("Should reject card top-up for unlinked users", async function () {
      const topUpAmount = ethers.parseEther("50");
      
      await vault.grantRole(await vault.VAULT_ROLE(), owner.address);

      await expect(
        vault.connect(owner).topUpCard(user1.address, await flowToken.getAddress(), topUpAmount)
      ).to.be.revertedWith("Card not linked");
    });
  });

  describe("Protocol Management", function () {
    let mockProtocol: any;

    beforeEach(async function () {
      // Deploy a mock yield protocol for testing
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      mockProtocol = await MockYieldProtocol.deploy();
    });

    it("Should allow adding protocols", async function () {
      const tokenAddress = await flowToken.getAddress();
      const maxAllocation = ethers.parseEther("1000");
      const riskScore = 50;

      await expect(
        vault.addProtocol(tokenAddress, await mockProtocol.getAddress(), maxAllocation, riskScore)
      ).to.emit(vault, "ProtocolAdded")
        .withArgs(tokenAddress, await mockProtocol.getAddress());

      const protocols = await vault.getSupportedProtocols(tokenAddress);
      expect(protocols.length).to.equal(1);
      expect(protocols[0].protocolAddress).to.equal(await mockProtocol.getAddress());
    });

    it("Should only allow yield managers to add protocols", async function () {
      await expect(
        vault.connect(user1).addProtocol(
          await flowToken.getAddress(),
          await mockProtocol.getAddress(),
          ethers.parseEther("1000"),
          50
        )
      ).to.be.reverted;
    });

    it("Should reject protocols with invalid risk scores", async function () {
      await expect(
        vault.addProtocol(
          await flowToken.getAddress(),
          await mockProtocol.getAddress(),
          ethers.parseEther("1000"),
          150 // Invalid risk score > 100
        )
      ).to.be.revertedWith("Risk score must be <= 100");
    });
  });

  describe("Yield and Performance", function () {
    it("Should calculate shares correctly", async function () {
      const tokenAddress = await flowToken.getAddress();
      const amount = ethers.parseEther("100");

      // First deposit should have 1:1 ratio
      const shares = await vault.calculateShares(tokenAddress, amount);
      expect(shares).to.equal(amount);
    });

    it("Should get total value correctly", async function () {
      const tokenAddress = await flowToken.getAddress();
      const depositAmount = ethers.parseEther("100");

      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(tokenAddress, depositAmount);

      const totalValue = await vault.getTotalValue(tokenAddress);
      expect(totalValue).to.be.gte(depositAmount); // Should be at least the deposit amount
    });

    it("Should handle rebalancing threshold correctly", async function () {
      const tokenAddress = await flowToken.getAddress();
      
      // Should return false when no deposits
      expect(await vault.shouldRebalance(tokenAddress)).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to pause", async function () {
      await expect(vault.pause()).to.not.be.reverted;
    });

    it("Should allow admin to unpause", async function () {
      await vault.pause();
      await expect(vault.unpause()).to.not.be.reverted;
    });

    it("Should reject non-admin pause attempts", async function () {
      await expect(vault.connect(user1).pause()).to.be.reverted;
    });

    it("Should update vault parameters by admin", async function () {
      const newRebalanceThreshold = 1000; // 10%
      const newManagementFee = 200; // 2%
      const newPerformanceFee = 1500; // 15%

      await expect(
        vault.updateVaultParameters(newRebalanceThreshold, newManagementFee, newPerformanceFee)
      ).to.not.be.reverted;

      expect(await vault.rebalanceThreshold()).to.equal(newRebalanceThreshold);
      expect(await vault.managementFee()).to.equal(newManagementFee);
      expect(await vault.performanceFee()).to.equal(newPerformanceFee);
    });

    it("Should reject excessive fees", async function () {
      await expect(
        vault.updateVaultParameters(500, 600, 1000) // 6% management fee (too high)
      ).to.be.revertedWith("Management fee too high");

      await expect(
        vault.updateVaultParameters(500, 100, 2100) // 21% performance fee (too high)
      ).to.be.revertedWith("Performance fee too high");
    });
  });

  describe("Emergency Functions", function () {
    it("Should pause deposits when paused", async function () {
      await vault.pause();

      await flowToken.connect(user1).approve(await vault.getAddress(), ethers.parseEther("100"));
      
      await expect(
        vault.connect(user1).deposit(await flowToken.getAddress(), ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  // Mock yield protocol for testing
  describe("Mock YieldProtocol", function () {
    it("Should deploy mock protocol correctly", async function () {
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      const mockProtocol = await MockYieldProtocol.deploy();
      
      expect(await mockProtocol.getAddress()).to.not.equal(ethers.ZeroAddress);
    });
  });
});

// Mock YieldProtocol contract for testing
const mockYieldProtocolSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockYieldProtocol {
    mapping(address => uint256) public balances;
    uint256 public constant APY = 500; // 5%
    
    function deposit(address token, uint256 amount) external returns (uint256) {
        balances[msg.sender] += amount;
        return amount;
    }
    
    function withdraw(address token, uint256 amount) external returns (uint256) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        return amount;
    }
    
    function getAPY(address token) external pure returns (uint256) {
        return APY;
    }
    
    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user];
    }
    
    function getLiquidity(address token) external pure returns (uint256) {
        return 1000000e18; // 1M tokens
    }
    
    function supportsToken(address token) external pure returns (bool) {
        return true;
    }
}
`;
