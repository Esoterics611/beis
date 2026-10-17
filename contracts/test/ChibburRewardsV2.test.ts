// ═══════════════════════════════════════════════════════════════
// ChibburRewardsV2 — C5 hardening tests
// ═══════════════════════════════════════════════════════════════

import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { ChibburRewardsV2, SecharToken } from '../typechain-types';

const MINTER_ROLE   = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
const APPROVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('APPROVER_ROLE'));

const id = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const memo = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const ZERO32 = ethers.ZeroHash;

describe('ChibburRewardsV2', () => {
  let admin: HardhatEthersSigner;
  let approver: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  let tmim: SecharToken;
  let rewards: ChibburRewardsV2;

  beforeEach(async () => {
    [admin, approver, alice, bob, stranger] = await ethers.getSigners();

    const TMIMFactory = await ethers.getContractFactory('SecharToken');
    tmim = await TMIMFactory.deploy(admin.address) as SecharToken;

    const RewardsFactory = await ethers.getContractFactory('ChibburRewardsV2');
    rewards = await RewardsFactory.deploy(admin.address, await tmim.getAddress()) as ChibburRewardsV2;

    await tmim.grantRole(MINTER_ROLE, await rewards.getAddress());
    await rewards.grantRole(APPROVER_ROLE, approver.address);
  });

  // ═══════════════════════════════════════════════════════════════
  // approveMasima()
  // ═══════════════════════════════════════════════════════════════

  describe('approveMasima()', () => {
    it('mints TMIM to assignee, stores record, emits event', async () => {
      const masimaId = id('masima-1');
      await expect(rewards.connect(approver).approveMasima(masimaId, alice.address, 100n))
        .to.emit(rewards, 'MasimaApproved')
        .withArgs(masimaId, alice.address, 100n, ZERO32);

      expect(await tmim.balanceOf(alice.address)).to.equal(100n);
      expect(await rewards.totalRewardsDistributed()).to.equal(100n);

      const rec = await rewards.masimaApprovals(masimaId);
      expect(rec.assignee).to.equal(alice.address);
      expect(rec.reward).to.equal(100n);
      expect(rec.onChain).to.be.true;
      expect(rec.memoHash).to.equal(ZERO32);
    });

    it('reverts on double approval', async () => {
      const masimaId = id('masima-dupe');
      await rewards.connect(approver).approveMasima(masimaId, alice.address, 100n);
      await expect(rewards.connect(approver).approveMasima(masimaId, alice.address, 100n))
        .to.be.revertedWith('Already approved');
    });

    it('reverts with zero assignee', async () => {
      await expect(rewards.connect(approver).approveMasima(id('m'), ethers.ZeroAddress, 100n))
        .to.be.revertedWith('Invalid assignee');
    });

    it('reverts with zero reward', async () => {
      await expect(rewards.connect(approver).approveMasima(id('m'), alice.address, 0n))
        .to.be.revertedWith('Zero reward');
    });

    it('reverts from non-APPROVER', async () => {
      await expect(rewards.connect(stranger).approveMasima(id('m'), alice.address, 100n))
        .to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // approveWithMemo()
  // ═══════════════════════════════════════════════════════════════

  describe('approveWithMemo()', () => {
    it('stores memo hash and mints TMIM', async () => {
      const masimaId = id('masima-memo');
      const memoHash = memo('ipfs://Qm...');

      await expect(rewards.connect(approver).approveWithMemo(masimaId, alice.address, 200n, memoHash))
        .to.emit(rewards, 'MasimaApproved')
        .withArgs(masimaId, alice.address, 200n, memoHash);

      const rec = await rewards.masimaApprovals(masimaId);
      expect(rec.memoHash).to.equal(memoHash);
      expect(await tmim.balanceOf(alice.address)).to.equal(200n);
    });

    it('reverts on double approval', async () => {
      const masimaId = id('masima-memo-dupe');
      const memoHash = memo('ipfs://Qm...');
      await rewards.connect(approver).approveWithMemo(masimaId, alice.address, 200n, memoHash);
      await expect(rewards.connect(approver).approveWithMemo(masimaId, alice.address, 200n, memoHash))
        .to.be.revertedWith('Already approved');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // approveTafkid()
  // ═══════════════════════════════════════════════════════════════

  describe('approveTafkid()', () => {
    it('mints TMIM to assignee, stores tafkid record, emits event', async () => {
      const tafkidId = id('tafkid-1');
      await expect(rewards.connect(approver).approveTafkid(tafkidId, bob.address, 50n))
        .to.emit(rewards, 'TafkidApproved')
        .withArgs(tafkidId, bob.address, 50n);

      expect(await tmim.balanceOf(bob.address)).to.equal(50n);
      const rec = await rewards.tafkidApprovals(tafkidId);
      expect(rec.onChain).to.be.true;
    });

    it('reverts on double approval', async () => {
      const tafkidId = id('tafkid-dupe');
      await rewards.connect(approver).approveTafkid(tafkidId, bob.address, 50n);
      await expect(rewards.connect(approver).approveTafkid(tafkidId, bob.address, 50n))
        .to.be.revertedWith('Already approved');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // batchApprove()
  // ═══════════════════════════════════════════════════════════════

  describe('batchApprove()', () => {
    it('approves multiple masimot and tafkidim in one tx', async () => {
      const items = [
        { idHash: id('b-masima-1'), assignee: alice.address, reward: 100n, memoHash: ZERO32, isTafkid: false },
        { idHash: id('b-masima-2'), assignee: alice.address, reward: 200n, memoHash: ZERO32, isTafkid: false },
        { idHash: id('b-tafkid-1'), assignee: bob.address,   reward: 50n,  memoHash: ZERO32, isTafkid: true  },
      ];

      await expect(rewards.connect(approver).batchApprove(items))
        .to.emit(rewards, 'BatchApproved')
        .withArgs(3n, 350n);

      expect(await tmim.balanceOf(alice.address)).to.equal(300n);
      expect(await tmim.balanceOf(bob.address)).to.equal(50n);
      expect(await rewards.totalRewardsDistributed()).to.equal(350n);
    });

    it('silently skips already-approved items', async () => {
      const masimaId = id('already-approved');
      await rewards.connect(approver).approveMasima(masimaId, alice.address, 100n);

      const items = [
        { idHash: masimaId, assignee: alice.address, reward: 100n, memoHash: ZERO32, isTafkid: false },
        { idHash: id('new-masima'), assignee: bob.address, reward: 75n, memoHash: ZERO32, isTafkid: false },
      ];

      await expect(rewards.connect(approver).batchApprove(items))
        .to.emit(rewards, 'BatchApproved')
        .withArgs(1n, 75n);

      // alice's balance unchanged (still 100), bob gets 75
      expect(await tmim.balanceOf(alice.address)).to.equal(100n);
      expect(await tmim.balanceOf(bob.address)).to.equal(75n);
    });

    it('silently skips items with zero assignee or zero reward', async () => {
      const items = [
        { idHash: id('zero-assignee'), assignee: ethers.ZeroAddress, reward: 100n, memoHash: ZERO32, isTafkid: false },
        { idHash: id('zero-reward'),   assignee: alice.address,       reward: 0n,   memoHash: ZERO32, isTafkid: false },
        { idHash: id('valid'),         assignee: alice.address,       reward: 50n,  memoHash: ZERO32, isTafkid: false },
      ];

      await expect(rewards.connect(approver).batchApprove(items))
        .to.emit(rewards, 'BatchApproved')
        .withArgs(1n, 50n);
    });

    it('reverts with empty array', async () => {
      await expect(rewards.connect(approver).batchApprove([]))
        .to.be.revertedWith('Invalid batch size');
    });

    it('reverts with more than 50 items', async () => {
      const items = Array.from({ length: 51 }, (_, i) => ({
        idHash: id(`bulk-${i}`),
        assignee: alice.address,
        reward: 10n,
        memoHash: ZERO32,
        isTafkid: false,
      }));
      await expect(rewards.connect(approver).batchApprove(items))
        .to.be.revertedWith('Invalid batch size');
    });

    it('reverts from non-APPROVER', async () => {
      const items = [{ idHash: id('x'), assignee: alice.address, reward: 10n, memoHash: ZERO32, isTafkid: false }];
      await expect(rewards.connect(stranger).batchApprove(items))
        .to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // requestRevision()
  // ═══════════════════════════════════════════════════════════════

  describe('requestRevision()', () => {
    it('increments revisionCount and stores memo, emits event', async () => {
      const masimaId = id('revision-masima');
      const memoHash = memo('needs-work');

      await expect(rewards.connect(approver).requestRevision(masimaId, memoHash))
        .to.emit(rewards, 'MasimaRevisionRequested')
        .withArgs(masimaId, memoHash);

      expect(await rewards.revisionCount(masimaId)).to.equal(1n);
      expect(await rewards.latestRevisionMemo(masimaId)).to.equal(memoHash);

      // Second revision increments to 2
      await rewards.connect(approver).requestRevision(masimaId, memo('still-needs-work'));
      expect(await rewards.revisionCount(masimaId)).to.equal(2n);
    });

    it('revision does not block subsequent approval', async () => {
      const masimaId = id('revision-then-approve');
      await rewards.connect(approver).requestRevision(masimaId, memo('revision-1'));
      // Should still be approvable after revision
      await expect(rewards.connect(approver).approveMasima(masimaId, alice.address, 100n))
        .to.emit(rewards, 'MasimaApproved');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // markPublished()
  // ═══════════════════════════════════════════════════════════════

  describe('markPublished()', () => {
    it('emits MasimaPublished for an approved masima', async () => {
      const masimaId = id('published-masima');
      await rewards.connect(approver).approveMasima(masimaId, alice.address, 100n);

      const ipfsCid = memo('ipfs://QmFinalPaper');
      await expect(rewards.connect(approver).markPublished(masimaId, ipfsCid))
        .to.emit(rewards, 'MasimaPublished')
        .withArgs(masimaId, alice.address, ipfsCid);
    });

    it('reverts if masima not yet approved', async () => {
      await expect(rewards.connect(approver).markPublished(id('unapproved'), memo('cid')))
        .to.be.revertedWith('Not yet approved');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // pause / unpause
  // ═══════════════════════════════════════════════════════════════

  describe('pause / unpause', () => {
    it('APPROVER_ROLE can pause, blocks all approval functions', async () => {
      await rewards.connect(approver).pause();
      expect(await rewards.paused()).to.be.true;

      await expect(rewards.connect(approver).approveMasima(id('p1'), alice.address, 100n))
        .to.be.revertedWith('Approvals paused');
      await expect(rewards.connect(approver).approveWithMemo(id('p2'), alice.address, 100n, ZERO32))
        .to.be.revertedWith('Approvals paused');
      await expect(rewards.connect(approver).approveTafkid(id('p3'), alice.address, 100n))
        .to.be.revertedWith('Approvals paused');
      await expect(rewards.connect(approver).batchApprove([
        { idHash: id('p4'), assignee: alice.address, reward: 10n, memoHash: ZERO32, isTafkid: false }
      ])).to.be.revertedWith('Approvals paused');
    });

    it('DEFAULT_ADMIN_ROLE can unpause', async () => {
      await rewards.connect(approver).pause();
      await rewards.connect(admin).unpause();
      expect(await rewards.paused()).to.be.false;

      await expect(rewards.connect(approver).approveMasima(id('after-unpause'), alice.address, 10n))
        .to.emit(rewards, 'MasimaApproved');
    });

    it('APPROVER_ROLE cannot unpause (only DEFAULT_ADMIN_ROLE can)', async () => {
      await rewards.connect(approver).pause();
      await expect(rewards.connect(approver).unpause())
        .to.be.reverted;
    });

    it('non-APPROVER cannot pause', async () => {
      await expect(rewards.connect(stranger).pause())
        .to.be.reverted;
    });

    it('pause/unpause emit events', async () => {
      await expect(rewards.connect(approver).pause()).to.emit(rewards, 'Paused');
      await expect(rewards.connect(admin).unpause()).to.emit(rewards, 'Unpaused');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // View helpers
  // ═══════════════════════════════════════════════════════════════

  describe('view helpers', () => {
    it('isMasimaApproved returns false before, true after approval', async () => {
      const masimaId = id('view-masima');
      expect(await rewards.isMasimaApproved(masimaId)).to.be.false;
      await rewards.connect(approver).approveMasima(masimaId, alice.address, 10n);
      expect(await rewards.isMasimaApproved(masimaId)).to.be.true;
    });

    it('isTafkidApproved returns false before, true after approval', async () => {
      const tafkidId = id('view-tafkid');
      expect(await rewards.isTafkidApproved(tafkidId)).to.be.false;
      await rewards.connect(approver).approveTafkid(tafkidId, bob.address, 10n);
      expect(await rewards.isTafkidApproved(tafkidId)).to.be.true;
    });
  });
});
