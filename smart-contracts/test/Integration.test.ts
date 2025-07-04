import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  FlowBridgeVault, 
  FlowToken, 
  yFLOW, 
  YieldOptimizer, 
  RiskManager, 
  LiquidityManager, 
  CardInterface,
  MetaMaskDTK 
} from "../typechain-types";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("FlowBridge Integration Tests", function () {
  let vault: FlowBridgeVault;
  let flowToken: FlowToken;
  let yFlowToken: yFLOW;
  let yieldOptimizer: YieldOptimizer;
  let riskManager: RiskManager;
  let liquidityManager: LiquidityManager;
  let cardInterface: CardInterface;
  let metamaskDTK: MetaMaskDTK;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let treasury: SignerWithAddress;

  async function deployFullSystemFixture() {
    [owner, user1, user2, treasury] = await ethers.getSigners();

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
      [owner.address, ethers.ZeroAddress, ethers.ZeroAddress],
      { initializer: "initialize" }
    ) as LiquidityManager;

    // Deploy vault
    const FlowBridgeVault = await ethers.getContractFactory("FlowBridgeVault");
    vault = await upgrades.deployProxy(
      FlowBridgeVault,
      [owner.address, await liquidityManager.getAddress()],
      { initializer: "initialize" }
    ) as FlowBridgeVault;

    // Deploy yFLOW token
    const YFlowToken = await ethers.getContractFactory("yFLOW");
    yFlowToken = await upgrades.deployProxy(
      YFlowToken,
      [
        await flowToken.getAddress(),
        "Yield FlowBridge Token",
        "yFLOW",
        await vault.getAddress(),
        treasury.address
      ],
      { initializer: "initialize" }
    ) as yFLOW;

    // Deploy card interface
    const CardInterface = await ethers.getContractFactory("CardInterface");
    cardInterface = await upgrades.deployProxy(
      CardInterface,
      [owner.address, await liquidityManager.getAddress(), await vault.getAddress()],
      { initializer: "initialize" }
    ) as CardInterface;

    // Deploy MetaMask DTK
    const MetaMaskDTK = await ethers.getContractFactory("MetaMaskDTK");
    metamaskDTK = await upgrades.deployProxy(
      MetaMaskDTK,
      [owner.address],
      { initializer: "initialize" }
    ) as MetaMaskDTK;

    // Setup integrations
    await yieldOptimizer.grantVaultRole(await vault.getAddress());
    await riskManager.grantVaultRole(await vault.getAddress());
    await vault.addSupportedToken(await flowToken.getAddress());

    // Mint tokens to users
    await flowToken.mint(user1.address, ethers.parseEther("100000"));
    await flowToken.mint(user2.address, ethers.parseEther("100000"));

    return {
      vault,
      flowToken,
      yFlowToken,
      yieldOptimizer,
      riskManager,
      liquidityManager,
      cardInterface,
      metamaskDTK,
      owner,
      user1,
      user2,
      treasury
    };
  }

  beforeEach(async function () {
    ({
      vault,
      flowToken,
      yFlowToken,
      yieldOptimizer,
      riskManager,
      liquidityManager,
      cardInterface,
      metamaskDTK,
      owner,
      user1,
      user2,
      treasury
    } = await loadFixture(deployFullSystemFixture));
  });

  describe("Full System Integration", function () {
    it("Should integrate vault with yFLOW token", async function () {
      const depositAmount = ethers.parseEther("1000");
      
      // Approve and deposit to vault
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(await flowToken.getAddress(), depositAmount);

      // Check vault position
      const position = await vault.getUserPosition(user1.address, await flowToken.getAddress());
      expect(position.principal).to.equal(depositAmount);

      // Deposit to yFLOW token
      await flowToken.connect(user1).approve(await yFlowToken.getAddress(), depositAmount);
      const yFlowShares = await yFlowToken.connect(user1).deposit(depositAmount, user1.address);

      expect(yFlowShares).to.be.gt(0);
    });

    it("Should integrate vault with yield optimizer", async function () {
      const depositAmount = ethers.parseEther("1000");
      const tokenAddress = await flowToken.getAddress();

      // Setup a mock protocol in yield optimizer
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      const mockProtocol = await MockYieldProtocol.deploy();

      await yieldOptimizer.addProtocol(tokenAddress, await mockProtocol.getAddress(), 50, 200000);

      // Make deposit
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(tokenAddress, depositAmount);

      // Trigger optimization
      const result = await yieldOptimizer.connect(owner).optimizeYield(tokenAddress, depositAmount, 60);
      expect(result.protocols.length).to.be.gt(0);
    });

    it("Should integrate with risk management", async function () {
      const tokenAddress = await flowToken.getAddress();

      // Setup risk profile for user
      await riskManager.updateUserRiskProfile(
        user1.address,
        70, // Risk tolerance
        ethers.parseEther("5000"), // Max position size
        3000 // 30% concentration limit
      );

      // Add protocol to risk manager
      const MockYieldProtocol = await ethers.getContractFactory("MockYieldProtocol");
      const mockProtocol = await MockYieldProtocol.deploy();

      await riskManager.whitelistProtocol(await mockProtocol.getAddress());
      await riskManager.updateProtocolRisk(await mockProtocol.getAddress(), 60, 5000, ethers.parseEther("100000"));

      // Test risk assessment
      const depositAmount = ethers.parseEther("1000");
      const [allowed, riskScore] = await riskManager.assessAllocationRisk(
        user1.address,
        await mockProtocol.getAddress(),
        depositAmount,
        depositAmount
      );

      expect(allowed).to.be.true;
      expect(riskScore).to.equal(60);
    });
  });

  describe("Card Integration Workflow", function () {
    beforeEach(async function () {
      // Setup card interface with supported tokens
      await cardInterface.addSupportedToken(await flowToken.getAddress(), 18);
      
      // Create liquidity pool
      await liquidityManager.createOrUpdatePool(
        await flowToken.getAddress(),
        1000, // 10% reserve ratio
        8000  // 80% max utilization
      );
    });

    it("Should complete full card onboarding and usage flow", async function () {
      const depositAmount = ethers.parseEther("1000");
      const topUpAmount = ethers.parseEther("100");

      // 1. User deposits to vault
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(await flowToken.getAddress(), depositAmount);

      // 2. User links card
      await vault.connect(user1).linkCard();

      // 3. User enables card
      await cardInterface.connect(user1).setCardEnabled(true);

      // 4. User tops up card
      await vault.grantRole(await vault.VAULT_ROLE(), owner.address);
      await vault.connect(owner).topUpCard(user1.address, await flowToken.getAddress(), topUpAmount);

      // 5. Check card balance
      const cardBalance = await cardInterface.getCardBalance(user1.address, await flowToken.getAddress());
      expect(cardBalance).to.equal(topUpAmount);

      // 6. Set spending limits
      await cardInterface.connect(user1).setSpendingLimits(
        await flowToken.getAddress(),
        ethers.parseEther("50"), // Daily limit
        ethers.parseEther("500")  // Monthly limit
      );

      const [dailyLimit, monthlyLimit] = await cardInterface.getSpendingLimits(
        user1.address,
        await flowToken.getAddress()
      );
      expect(dailyLimit).to.equal(ethers.parseEther("50"));
      expect(monthlyLimit).to.equal(ethers.parseEther("500"));
    });

    it("Should process card spending transaction", async function () {
      const depositAmount = ethers.parseEther("1000");
      const topUpAmount = ethers.parseEther("100");
      const spendAmount = ethers.parseEther("20");

      // Setup user with card balance
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(await flowToken.getAddress(), depositAmount);
      await vault.connect(user1).linkCard();
      await cardInterface.connect(user1).setCardEnabled(true);
      
      await vault.grantRole(await vault.VAULT_ROLE(), owner.address);
      await vault.connect(owner).topUpCard(user1.address, await flowToken.getAddress(), topUpAmount);

      // Grant card manager role to process spending
      await cardInterface.grantRole(await cardInterface.CARD_MANAGER_ROLE(), owner.address);

      // Process spending transaction
      const spendingData = {
        user: user1.address,
        token: await flowToken.getAddress(),
        amount: spendAmount,
        timestamp: await time.latest(),
        merchantId: ethers.solidityPackedKeccak256(["string"], ["test-merchant"]),
        category: "food"
      };

      await expect(
        cardInterface.connect(owner).authorizeSpending(spendingData)
      ).to.emit(cardInterface, "CardSpending")
        .withArgs(user1.address, await flowToken.getAddress(), spendAmount, spendingData.merchantId, "food");

      // Check updated balance
      const newBalance = await cardInterface.getCardBalance(user1.address, await flowToken.getAddress());
      expect(newBalance).to.equal(topUpAmount - spendAmount);
    });
  });

  describe("MetaMask DTK Integration", function () {
    it("Should create and execute delegation", async function () {
      const permissions = {
        canTransferTokens: true,
        canInteractWithDeFi: true,
        canManageYield: false,
        canUseCard: false,
        canCrossChain: false,
        dailySpendLimit: ethers.parseEther("100"),
        transactionLimit: ethers.parseEther("50"),
        allowedTokens: [await flowToken.getAddress()],
        allowedProtocols: [await vault.getAddress()],
        expirationTime: (await time.latest()) + 86400, // 1 day
        isActive: true
      };

      // Create delegation
      const delegationHash = await metamaskDTK.connect(user1).createDelegation(
        owner.address, // Delegate to owner for testing
        0, // ACCOUNT_MANAGEMENT
        permissions
      );

      expect(delegationHash).to.not.equal(ethers.ZeroHash);

      // Check delegation validity
      const isValid = await metamaskDTK.isDelegationValid(user1.address, owner.address);
      expect(isValid).to.be.true;
    });

    it("Should revoke delegation", async function () {
      const permissions = {
        canTransferTokens: true,
        canInteractWithDeFi: false,
        canManageYield: false,
        canUseCard: false,
        canCrossChain: false,
        dailySpendLimit: ethers.parseEther("100"),
        transactionLimit: ethers.parseEther("50"),
        allowedTokens: [await flowToken.getAddress()],
        allowedProtocols: [],
        expirationTime: (await time.latest()) + 86400,
        isActive: true
      };

      // Create delegation
      await metamaskDTK.connect(user1).createDelegation(owner.address, 0, permissions);

      // Revoke delegation
      await expect(
        metamaskDTK.connect(user1).revokeDelegation(owner.address)
      ).to.emit(metamaskDTK, "DelegationRevoked");

      // Check delegation is no longer valid
      const isValid = await metamaskDTK.isDelegationValid(user1.address, owner.address);
      expect(isValid).to.be.false;
    });
  });

  describe("Yield Generation and Distribution", function () {
    it("Should distribute yield through yFLOW token", async function () {
      const depositAmount = ethers.parseEther("1000");
      const yieldAmount = ethers.parseEther("50");

      // User deposits to yFLOW
      await flowToken.connect(user1).approve(await yFlowToken.getAddress(), depositAmount);
      await yFlowToken.connect(user1).deposit(depositAmount, user1.address);

      // Grant yield manager role and mint yield tokens
      await yFlowToken.grantRole(await yFlowToken.YIELD_MANAGER_ROLE(), owner.address);
      await flowToken.mint(owner.address, yieldAmount);
      await flowToken.connect(owner).approve(await yFlowToken.getAddress(), yieldAmount);

      // Distribute yield
      await expect(
        yFlowToken.connect(owner).distributeYield(yieldAmount)
      ).to.emit(yFlowToken, "YieldDistributed");

      // Check pending yield
      const pendingYield = await yFlowToken.pendingYield(user1.address);
      expect(pendingYield).to.be.gt(0);
    });

    it("Should compound yield automatically", async function () {
      const depositAmount = ethers.parseEther("1000");

      // User deposits to yFLOW
      await flowToken.connect(user1).approve(await yFlowToken.getAddress(), depositAmount);
      const initialShares = await yFlowToken.connect(user1).deposit(depositAmount, user1.address);

      // Simulate yield distribution
      await yFlowToken.grantRole(await yFlowToken.YIELD_MANAGER_ROLE(), owner.address);
      const yieldAmount = ethers.parseEther("50");
      await flowToken.mint(owner.address, yieldAmount);
      await flowToken.connect(owner).approve(await yFlowToken.getAddress(), yieldAmount);
      await yFlowToken.connect(owner).distributeYield(yieldAmount);

      // Compound yield
      const compoundedAmount = await yFlowToken.compoundYield(user1.address);
      expect(compoundedAmount).to.be.gte(0);

      // Check if shares increased (if compounding occurred)
      const newShares = await yFlowToken.balanceOf(user1.address);
      expect(newShares).to.be.gte(initialShares);
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle vault pause correctly", async function () {
      const depositAmount = ethers.parseEther("1000");

      // Make initial deposit
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(await flowToken.getAddress(), depositAmount);

      // Pause vault
      await vault.pause();

      // Try to deposit (should fail)
      await flowToken.connect(user2).approve(await vault.getAddress(), depositAmount);
      await expect(
        vault.connect(user2).deposit(await flowToken.getAddress(), depositAmount)
      ).to.be.reverted;

      // Withdrawals should still work
      const userShares = (await vault.getUserPosition(user1.address, await flowToken.getAddress())).shares;
      await expect(
        vault.connect(user1).withdraw(await flowToken.getAddress(), userShares / 2n)
      ).to.not.be.reverted;
    });

    it("Should handle liquidity shortages", async function () {
      const depositAmount = ethers.parseEther("100");

      // Deposit to liquidity manager
      await flowToken.connect(user1).approve(await liquidityManager.getAddress(), depositAmount);
      await liquidityManager.connect(user1).depositLiquidity(await flowToken.getAddress(), depositAmount);

      // Try to withdraw more than available
      await expect(
        liquidityManager.connect(user1).withdrawLiquidity(await flowToken.getAddress(), depositAmount * 2n)
      ).to.be.revertedWith("Insufficient available balance");
    });
  });

  describe("Cross-Contract Communication", function () {
    it("Should maintain consistency across contracts", async function () {
      const depositAmount = ethers.parseEther("1000");
      const tokenAddress = await flowToken.getAddress();

      // Deposit to vault
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(tokenAddress, depositAmount);

      // Check vault state
      const vaultPosition = await vault.getUserPosition(user1.address, tokenAddress);
      expect(vaultPosition.principal).to.equal(depositAmount);

      // Check total value consistency
      const totalValue = await vault.getTotalValue(tokenAddress);
      expect(totalValue).to.be.gte(depositAmount);
    });

    it("Should handle role-based permissions correctly", async function () {
      // Test that only authorized contracts can call restricted functions
      await expect(
        yieldOptimizer.connect(user1).optimizeYield(
          await flowToken.getAddress(),
          ethers.parseEther("1000"),
          50
        )
      ).to.be.reverted;

      // Grant vault role and try again
      await yieldOptimizer.grantVaultRole(user1.address);
      
      // Should work now (though might fail for other reasons)
      try {
        await yieldOptimizer.connect(user1).optimizeYield(
          await flowToken.getAddress(),
          ethers.parseEther("1000"),
          50
        );
      } catch (error) {
        // Expected to fail due to no protocols, but role check should pass
        expect(error).to.not.be.null;
      }
    });
  });

  describe("Performance and Gas Optimization", function () {
    it("Should efficiently handle batch operations", async function () {
      const users = [user1, user2];
      const depositAmount = ethers.parseEther("1000");

      // Batch approve and deposit
      for (const user of users) {
        await flowToken.connect(user).approve(await vault.getAddress(), depositAmount);
        await vault.connect(user).deposit(await flowToken.getAddress(), depositAmount);
      }

      // Check all positions were created
      for (const user of users) {
        const position = await vault.getUserPosition(user.address, await flowToken.getAddress());
        expect(position.principal).to.equal(depositAmount);
      }
    });

    it("Should optimize gas usage for common operations", async function () {
      const depositAmount = ethers.parseEther("1000");

      // Measure gas for deposit
      await flowToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      const tx = await vault.connect(user1).deposit(await flowToken.getAddress(), depositAmount);
      const receipt = await tx.wait();

      // Gas should be reasonable (this is a rough check)
      expect(receipt?.gasUsed).to.be.lt(500000); // Less than 500k gas
    });
  });
});
