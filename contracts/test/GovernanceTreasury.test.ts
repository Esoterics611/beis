// ═══════════════════════════════════════════════════════════════
// GovernanceTreasury — C5 hardening tests
// ═══════════════════════════════════════════════════════════════

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { GovernanceTreasury, SecharToken, MockERC20 } from '../typechain-types';

// USDC 6-decimal helpers
const usdc = (dollars: number) => BigInt(Math.round(dollars * 1e6));
const TMIM = (n: number) => BigInt(n);

const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('GOVERNANCE_ROLE'));
const TREASURER_ROLE  = ethers.keccak256(ethers.toUtf8Bytes('TREASURER_ROLE'));
const MINTER_ROLE     = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
const BURNER_ROLE     = ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE'));

describe('GovernanceTreasury', () => {
  let admin: HardhatEthersSigner;
  let governance: HardhatEthersSigner;
  let donor: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  let tmim: SecharToken;
  let mockUsdc: MockERC20;
  let treasury: GovernanceTreasury;

  beforeEach(async () => {
    [admin, governance, donor, alice, bob] = await ethers.getSigners();

    const MockERC20F = await ethers.getContractFactory('MockERC20');
    mockUsdc = await MockERC20F.deploy('Mock USDC', 'USDC', 6) as MockERC20;

    const TMIMFactory = await ethers.getContractFactory('SecharToken');
    tmim = await TMIMFactory.deploy(admin.address) as SecharToken;

    const TreasuryFactory = await ethers.getContractFactory('GovernanceTreasury');
    treasury = await TreasuryFactory.deploy(admin.address, await tmim.getAddress(), await mockUsdc.getAddress()) as GovernanceTreasury;

    // Wire roles
    await tmim.grantRole(MINTER_ROLE, await treasury.getAddress());
    await tmim.grantRole(BURNER_ROLE, await treasury.getAddress());
    await treasury.grantRole(GOVERNANCE_ROLE, governance.address);

    // Fund donor with USDC
    await mockUsdc.mint(donor.address, usdc(10_000));
    await mockUsdc.connect(donor).approve(await treasury.getAddress(), usdc(10_000));

    // Seed treasury with USDC so redemptions can work
    await mockUsdc.mint(await treasury.getAddress(), usdc(10_000));
  });

  // ═══════════════════════════════════════════════════════════════
  // donate()
  // ═══════════════════════════════════════════════════════════════

  describe('donate()', () => {
    it('transfers USDC in and mints TMIM at 10:1 rate', async () => {
      await expect(treasury.connect(donor).donate(usdc(100), 'test'))
        .to.emit(treasury, 'Donated')
        .withArgs(donor.address, usdc(100), TMIM(1000), 'test');

      expect(await tmim.balanceOf(donor.address)).to.equal(TMIM(1000));
      expect(await mockUsdc.balanceOf(await treasury.getAddress())).to.be.gt(usdc(10_000));
      expect(await treasury.totalDonatedUSDC()).to.equal(usdc(100));
      expect(await treasury.totalTmimMinted()).to.equal(TMIM(1000));
    });

    it('reverts on zero amount', async () => {
      await expect(treasury.connect(donor).donate(0n, ''))
        .to.be.revertedWith('Zero donation');
    });

    it('reverts when donation too small to mint 1 TMIM', async () => {
      // 1 unit of USDC (0.000001 USD) mints 0 TMIM
      await mockUsdc.connect(donor).approve(await treasury.getAddress(), 1n);
      await expect(treasury.connect(donor).donate(1n, ''))
        .to.be.revertedWith('Donation too small');
    });

    it('reverts when monthly cap would be exceeded', async () => {
      // maxMonthlyMint = 100_000 TMIM → requires 10_000 USDC to hit cap
      await mockUsdc.mint(donor.address, usdc(10_001));
      await mockUsdc.connect(donor).approve(await treasury.getAddress(), usdc(20_001));

      // Hit the cap exactly (10_000 USDC → 100_000 TMIM)
      await treasury.connect(donor).donate(usdc(10_000), '');
      // Next donation should fail
      await expect(treasury.connect(donor).donate(usdc(1), ''))
        .to.be.revertedWith('Monthly mint cap exceeded');
    });

    it('resets minting window after 30 days', async () => {
      await mockUsdc.mint(donor.address, usdc(10_000));
      await mockUsdc.connect(donor).approve(await treasury.getAddress(), usdc(20_000));

      // Fill the cap
      await treasury.connect(donor).donate(usdc(10_000), '');
      // Advance 30 days
      await time.increase(30 * 24 * 3600 + 1);
      // Should succeed again
      await expect(treasury.connect(donor).donate(usdc(100), ''))
        .to.emit(treasury, 'Donated');
    });

    it('reverts when paused', async () => {
      await treasury.connect(governance).pause();
      await expect(treasury.connect(donor).donate(usdc(100), ''))
        .to.be.revertedWith('Treasury paused');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // redeem()
  // ═══════════════════════════════════════════════════════════════

  describe('redeem()', () => {
    beforeEach(async () => {
      // Give alice 1000 TMIM for redemption tests
      await treasury.connect(donor).donate(usdc(100), '');  // mints 1000 TMIM to donor
      // Transfer some to alice
      await tmim.connect(donor).transfer(alice.address, TMIM(100));
    });

    it('burns TMIM and transfers USDC at redemption rate', async () => {
      // Default 1000 bps → 100 TMIM × 1000 bps × 1e6 / 10_000 = 10_000_000 = 10 USDC
      const usdcOut = (TMIM(100) * 1000n * 1_000_000n) / 10_000n; // = 10e6
      await expect(treasury.connect(alice).redeem(TMIM(100)))
        .to.emit(treasury, 'Redeemed')
        .withArgs(alice.address, TMIM(100), usdcOut);

      expect(await tmim.balanceOf(alice.address)).to.equal(0n);
      expect(await mockUsdc.balanceOf(alice.address)).to.equal(usdcOut);
    });

    it('reverts on zero amount', async () => {
      await expect(treasury.connect(alice).redeem(0n))
        .to.be.revertedWith('Zero amount');
    });

    it('reverts when caller has insufficient TMIM', async () => {
      await expect(treasury.connect(bob).redeem(TMIM(1)))
        .to.be.revertedWith('Insufficient TMIM');
    });

    it('reverts when USDC reserve is insufficient', async () => {
      // Drain treasury of USDC by transferring it out (admin trick: mint fresh tokens to avoid this normally)
      // Deploy a fresh treasury with only 1 USDC
      const TreasuryFactory = await ethers.getContractFactory('GovernanceTreasury');
      const poorTreasury = await TreasuryFactory.deploy(admin.address, await tmim.getAddress(), await mockUsdc.getAddress()) as GovernanceTreasury;
      await tmim.grantRole(MINTER_ROLE, await poorTreasury.getAddress());
      await tmim.grantRole(BURNER_ROLE, await poorTreasury.getAddress());

      // Give alice TMIM via direct mint
      await tmim.connect(admin).mint(alice.address, TMIM(1000), 'test');
      // Give treasury only 1 USDC
      await mockUsdc.mint(await poorTreasury.getAddress(), 1n);

      await expect(poorTreasury.connect(alice).redeem(TMIM(1)))
        .to.be.revertedWith('Insufficient USDC reserve');
    });

    it('reverts when redemption would drop reserve ratio below 20%', async () => {
      // Setup: 1000 TMIM supply, treasury has just enough to barely be above 20% ratio
      // usdcNeeded = 1000 * 1000 * 1e6 / 10_000 = 100 USDC
      // 20% of 100 USDC = 20 USDC minimum needed
      // If treasury has 21 USDC and we try to redeem 100 TMIM (= 10 USDC out):
      //   usdcAfter = 21 - 10 = 11 USDC; ratio = 11e6 * 1000 / 1e8 = 110 < 200 → reverts

      // Deploy a fresh treasury with exact balance
      const TreasuryFactory = await ethers.getContractFactory('GovernanceTreasury');
      const tightTreasury = await TreasuryFactory.deploy(admin.address, await tmim.getAddress(), await mockUsdc.getAddress()) as GovernanceTreasury;
      await tmim.grantRole(MINTER_ROLE, await tightTreasury.getAddress());
      await tmim.grantRole(BURNER_ROLE, await tightTreasury.getAddress());

      // Mint 1000 TMIM to alice (no donation needed)
      await tmim.connect(admin).mint(alice.address, TMIM(1000), 'test');
      // Fund treasury with 21 USDC
      await mockUsdc.mint(await tightTreasury.getAddress(), usdc(21));

      // Redeeming 100 TMIM → 10 USDC out, leaving 11 USDC (ratio = 11%)
      await expect(tightTreasury.connect(alice).redeem(TMIM(100)))
        .to.be.revertedWith('Reserve ratio too low');
    });

    it('reverts when paused', async () => {
      await treasury.connect(governance).pause();
      await expect(treasury.connect(alice).redeem(TMIM(1)))
        .to.be.revertedWith('Treasury paused');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // createStream() / claimStream() / cancelStream()
  // ═══════════════════════════════════════════════════════════════

  describe('streams', () => {
    const STREAM_AMOUNT = usdc(1200); // 1200 USDC over 1 year
    const DURATION = 365 * 24 * 3600; // 1 year in seconds

    it('creates a stream and emits StreamCreated', async () => {
      const tx = await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const endTime = BigInt(block!.timestamp) + BigInt(DURATION);

      await expect(tx)
        .to.emit(treasury, 'StreamCreated')
        .withArgs(1n, alice.address, STREAM_AMOUNT, endTime);

      const s = await treasury.streams(1n);
      expect(s.recipient).to.equal(alice.address);
      expect(s.totalAmount).to.equal(STREAM_AMOUNT);
      expect(s.cancelled).to.be.false;
    });

    it('reverts createStream with zero recipient', async () => {
      await expect(treasury.connect(governance).createStream(ethers.ZeroAddress, STREAM_AMOUNT, DURATION))
        .to.be.revertedWith('Zero recipient');
    });

    it('reverts createStream with zero amount', async () => {
      await expect(treasury.connect(governance).createStream(alice.address, 0n, DURATION))
        .to.be.revertedWith('Zero amount');
    });

    it('reverts createStream with zero duration', async () => {
      await expect(treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, 0n))
        .to.be.revertedWith('Zero duration');
    });

    it('reverts createStream when treasury has insufficient USDC', async () => {
      await expect(treasury.connect(governance).createStream(alice.address, usdc(100_000_000), DURATION))
        .to.be.revertedWith('Insufficient reserve for stream');
    });

    it('reverts createStream from non-governance', async () => {
      await expect(treasury.connect(donor).createStream(alice.address, STREAM_AMOUNT, DURATION))
        .to.be.reverted;
    });

    it('claimStream pays out proportional to elapsed time', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);

      // Advance 1/12 of the duration (= 1 month)
      await time.increase(DURATION / 12);

      const expectedClaimable = STREAM_AMOUNT / 12n;

      await expect(treasury.connect(alice).claimStream(1n))
        .to.emit(treasury, 'StreamClaimed');

      const received = await mockUsdc.balanceOf(alice.address);
      // Allow a few seconds of block-time rounding
      expect(received).to.be.closeTo(expectedClaimable, usdc(0.01));
      expect(received).to.be.gt(0n);
    });

    it('claimable is capped at totalAmount after stream ends', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);

      // Advance beyond end time
      await time.increase(DURATION + 3600);

      const claimable = await treasury.claimableForStream(1n);
      expect(claimable).to.equal(STREAM_AMOUNT);
    });

    it('claimStream reverts with nothing to claim after full claim', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);
      // Advance past the end
      await time.increase(DURATION + 3600);
      // First claim collects everything
      await treasury.connect(alice).claimStream(1n);
      // Second immediate claim: nothing left
      await expect(treasury.connect(alice).claimStream(1n))
        .to.be.revertedWith('Nothing to claim');
    });

    it('claimStream reverts for wrong recipient', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);
      await time.increase(DURATION / 12);
      await expect(treasury.connect(bob).claimStream(1n))
        .to.be.revertedWith('Not recipient');
    });

    it('cancelStream prevents further claims', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);
      await time.increase(DURATION / 12);

      // Claim first, then cancel
      await treasury.connect(alice).claimStream(1n);

      await expect(treasury.connect(governance).cancelStream(1n))
        .to.emit(treasury, 'StreamCancelled')
        .withArgs(1n);

      await time.increase(DURATION / 12);
      await expect(treasury.connect(alice).claimStream(1n))
        .to.be.revertedWith('Stream cancelled');
    });

    it('cancelStream reverts if already cancelled', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);
      await treasury.connect(governance).cancelStream(1n);
      await expect(treasury.connect(governance).cancelStream(1n))
        .to.be.revertedWith('Already cancelled');
    });

    it('claimStream reverts when paused', async () => {
      await treasury.connect(governance).createStream(alice.address, STREAM_AMOUNT, DURATION);
      await time.increase(DURATION / 12);
      await treasury.connect(governance).pause();
      await expect(treasury.connect(alice).claimStream(1n))
        .to.be.revertedWith('Treasury paused');
    });

    it('multiple streams increment streamCount', async () => {
      await treasury.connect(governance).createStream(alice.address, usdc(100), DURATION);
      await treasury.connect(governance).createStream(bob.address, usdc(100), DURATION);
      expect(await treasury.streamCount()).to.equal(2n);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Governance parameters
  // ═══════════════════════════════════════════════════════════════

  describe('setRedemptionRate()', () => {
    it('governance can update rate within [100, 5000] bps', async () => {
      await expect(treasury.connect(governance).setRedemptionRate(500n))
        .to.emit(treasury, 'RedemptionRateUpdated')
        .withArgs(500n);
      expect(await treasury.redemptionRateBps()).to.equal(500n);
    });

    it('reverts below 100 bps', async () => {
      await expect(treasury.connect(governance).setRedemptionRate(99n))
        .to.be.revertedWith('Rate out of range');
    });

    it('reverts above 5000 bps', async () => {
      await expect(treasury.connect(governance).setRedemptionRate(5001n))
        .to.be.revertedWith('Rate out of range');
    });

    it('reverts from non-governance', async () => {
      await expect(treasury.connect(donor).setRedemptionRate(500n))
        .to.be.reverted;
    });
  });

  describe('setMaxMonthlyMint()', () => {
    it('governance can update cap ≥ 1000', async () => {
      await expect(treasury.connect(governance).setMaxMonthlyMint(200_000n))
        .to.emit(treasury, 'MaxMonthlyMintUpdated')
        .withArgs(200_000n);
      expect(await treasury.maxMonthlyMint()).to.equal(200_000n);
    });

    it('reverts below 1000', async () => {
      await expect(treasury.connect(governance).setMaxMonthlyMint(999n))
        .to.be.revertedWith('Cap too low');
    });

    it('reverts from non-governance', async () => {
      await expect(treasury.connect(donor).setMaxMonthlyMint(200_000n))
        .to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Pause / Unpause
  // ═══════════════════════════════════════════════════════════════

  describe('pause / unpause', () => {
    it('governance can pause and unpause', async () => {
      await treasury.connect(governance).pause();
      expect(await treasury.paused()).to.be.true;
      await treasury.connect(governance).unpause();
      expect(await treasury.paused()).to.be.false;
    });

    it('non-governance cannot pause', async () => {
      await expect(treasury.connect(donor).pause()).to.be.reverted;
    });

    it('non-governance cannot unpause', async () => {
      await treasury.connect(governance).pause();
      await expect(treasury.connect(donor).unpause()).to.be.reverted;
    });

    it('unpause restores donate()', async () => {
      await treasury.connect(governance).pause();
      await treasury.connect(governance).unpause();
      await expect(treasury.connect(donor).donate(usdc(100), ''))
        .to.emit(treasury, 'Donated');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // View helpers
  // ═══════════════════════════════════════════════════════════════

  describe('view helpers', () => {
    it('reserveRatioPpm returns max when supply is zero', async () => {
      expect(await treasury.reserveRatioPpm()).to.equal(ethers.MaxUint256);
    });

    it('reserveRatioPpm returns correct value after donation', async () => {
      // After donating 100 USDC: 1000 TMIM minted, treasury holds 10_100 USDC
      // usdcNeeded = 1000 * 1000 * 1e6 / 10_000 = 1e8 = 100 USDC
      // ratio = 10_100 * 1e6 * 1000 / 1e8 = 101_000
      await treasury.connect(donor).donate(usdc(100), '');
      const ratio = await treasury.reserveRatioPpm();
      expect(ratio).to.be.gt(0n);
      // Should be far above minReserveRatioPpm (200 = 20%)
      expect(ratio).to.be.gt(200n);
    });

    it('mintedThisMonth returns 0 after window rolls over', async () => {
      await treasury.connect(donor).donate(usdc(10), '');
      expect(await treasury.mintedThisMonth()).to.be.gt(0n);

      await time.increase(30 * 24 * 3600 + 1);
      expect(await treasury.mintedThisMonth()).to.equal(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Window drift regression
  // ═══════════════════════════════════════════════════════════════

  describe('window drift fix', () => {
    it('windowStart advances by exactly 30 days each rollover', async () => {
      const start = await treasury.currentWindowStart();
      await mockUsdc.mint(donor.address, usdc(10_001));
      await mockUsdc.connect(donor).approve(await treasury.getAddress(), usdc(20_001));

      // Fill cap
      await treasury.connect(donor).donate(usdc(10_000), '');

      // Advance 30+ days and trigger a new window via a new donate
      await time.increase(30 * 24 * 3600 + 1);
      await treasury.connect(donor).donate(usdc(1), '');

      const newStart = await treasury.currentWindowStart();
      expect(newStart).to.equal(start + BigInt(30 * 24 * 3600));
    });
  });
});
