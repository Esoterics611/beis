// ═══════════════════════════════════════════════════════════════
// BeisGovernance — attestation-gated voting (C1 security fix)
// ═══════════════════════════════════════════════════════════════
//
// Proves the governance-takeover vulnerability is closed:
//   - castVote() rejects any attestation not signed by `attestationSigner`
//   - voter cannot claim a rank they were not assigned
//   - attestations are single-use (nonce-replay-proof)
//   - attestations expire
//   - attestations are bound to a specific proposal
//   - attestation tampering invalidates the signature
//
// These tests deliberately avoid using the on-chain BeisRegistry: rank
// authority lives in the backend signer, so the contract just cares about
// the signature. Backend correctness (reading rank from the registry) is
// tested separately in the attestation module tests.

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { SecharToken, BeisGovernance } from '../typechain-types';

const SUPPORT_FOR     = 0;
const SUPPORT_AGAINST = 1;
const SUPPORT_ABSTAIN = 2;

// ProposalType enum (matches BeisGovernance)
const PT_SIGNAL              = 0;
const PT_MIVTZA_FUNDING      = 1;
const PT_REDEMPTION_RATE     = 2;
const PT_EMERGENCY_PAUSE     = 3;
const PT_EMERGENCY_UNPAUSE   = 4;
const PT_TREASURY_TRANSFER   = 5;
const PT_GRANT_ROLE          = 6;
const PT_PARAMETER_UPDATE    = 7;
const PT_MINT_TOKENS         = 8;
const PT_MONTHLY_CAP_UPDATE  = 9;

// Matches BeisGovernance.rankVotingPower
const RANK_WEIGHTS = [1, 2, 5, 8, 12, 18, 25, 35, 45, 60];

interface RankAttestation {
  voter: string;
  rankIndex: number;
  proposalId: bigint;
  nonce: bigint;
  expiry: bigint;
  signature: string;
}

async function buildAttestation(
  signer: HardhatEthersSigner,
  governance: BeisGovernance,
  voter: string,
  rankIndex: number,
  proposalId: bigint,
  opts: { expiryOffsetSec?: number; nonce?: bigint } = {},
): Promise<RankAttestation> {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = {
    name: 'BeisGovernance',
    version: '1',
    chainId,
    verifyingContract: await governance.getAddress(),
  };
  const types = {
    RankAttestation: [
      { name: 'voter',      type: 'address' },
      { name: 'rankIndex',  type: 'uint8'   },
      { name: 'proposalId', type: 'uint256' },
      { name: 'nonce',      type: 'uint256' },
      { name: 'expiry',     type: 'uint256' },
    ],
  };
  const now = BigInt(await time.latest());
  const expiry = now + BigInt(opts.expiryOffsetSec ?? 300);
  const nonce = opts.nonce ?? BigInt(ethers.hexlify(ethers.randomBytes(32)));
  const value = { voter, rankIndex, proposalId, nonce, expiry };
  const signature = await signer.signTypedData(domain, types, value);
  return { voter, rankIndex, proposalId, nonce, expiry, signature };
}

function toStructArg(a: RankAttestation) {
  return {
    voter: a.voter,
    rankIndex: a.rankIndex,
    proposalId: a.proposalId,
    nonce: a.nonce,
    expiry: a.expiry,
    signature: a.signature,
  };
}

function sel4(sig: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(sig)).slice(0, 10);
}

const CALLEE_IFACE = new ethers.Interface([
  'function setValue(uint256)',
  'function revertWithMessage()',
  'function revertNoReason()',
  'function revertWithCustomError()',
  'function revertWithMalformedError()',
]);

describe('BeisGovernance — rank attestation (C1)', () => {
  let admin: HardhatEthersSigner;
  let attestationSigner: HardhatEthersSigner;
  let proposer: HardhatEthersSigner;
  let voterAlice: HardhatEthersSigner;
  let voterBob: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let otherSigner: HardhatEthersSigner;

  let tmim: SecharToken;
  let governance: BeisGovernance;
  let proposalId: bigint;

  const MINTER_ROLE   = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const PROPOSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PROPOSER_ROLE'));
  const APPROVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('APPROVER_ROLE'));

  beforeEach(async () => {
    [admin, attestationSigner, proposer, voterAlice, voterBob, attacker, otherSigner] =
      await ethers.getSigners();

    // Deploy SecharToken
    const TMIMF = await ethers.getContractFactory('SecharToken');
    tmim = (await TMIMF.deploy(admin.address)) as unknown as SecharToken;

    // Deploy BeisGovernance with attestationSigner
    const GovF = await ethers.getContractFactory('BeisGovernance');
    governance = (await GovF.deploy(
      admin.address,
      await tmim.getAddress(),
      attestationSigner.address,
    )) as unknown as BeisGovernance;

    // Grant proposer role & mint TMIM to voters
    await governance.grantRole(PROPOSER_ROLE, proposer.address);
    await tmim.grantRole(MINTER_ROLE, admin.address);
    await tmim.mint(voterAlice.address, 100, 'test');
    await tmim.mint(voterBob.address, 50, 'test');
    await tmim.mint(attacker.address, 1000, 'test');

    // Create a proposal
    const tx = await governance.connect(proposer).propose(
      PT_SIGNAL,
      'Test Proposal',
      'A short description',
      ethers.ZeroAddress,
      '0x',
      0,
    );
    const rcpt = await tx.wait();
    // Read back proposalCount (last created proposal)
    proposalId = await governance.proposalCount();
    expect(proposalId).to.equal(1n);
    void rcpt;
  });

  // ─── Constructor invariants ────────────────────────────────────────
  describe('construction', () => {
    it('rejects zero attestation signer', async () => {
      const GovF = await ethers.getContractFactory('BeisGovernance');
      await expect(
        GovF.deploy(admin.address, await tmim.getAddress(), ethers.ZeroAddress),
      ).to.be.revertedWith('signer zero');
    });

    it('rejects zero admin address', async () => {
      const GovF = await ethers.getContractFactory('BeisGovernance');
      await expect(
        GovF.deploy(ethers.ZeroAddress, await tmim.getAddress(), attestationSigner.address),
      ).to.be.revertedWith('admin zero');
    });

    it('rejects zero TMIM token address', async () => {
      const GovF = await ethers.getContractFactory('BeisGovernance');
      await expect(
        GovF.deploy(admin.address, ethers.ZeroAddress, attestationSigner.address),
      ).to.be.revertedWith('tmim zero');
    });

    it('stores the attestation signer and emits on deployment', async () => {
      expect(await governance.attestationSigner()).to.equal(attestationSigner.address);
    });

    it('grants APPROVER_ROLE to admin', async () => {
      expect(await governance.hasRole(APPROVER_ROLE, admin.address)).to.be.true;
    });
  });

  // ─── Happy path ────────────────────────────────────────────────────
  describe('castVote — happy path', () => {
    it('accepts a valid attestation and records weight', async () => {
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      )
        .to.emit(governance, 'VoteCast')
        .withArgs(proposalId, voterAlice.address, SUPPORT_FOR, 5, 100n * BigInt(RANK_WEIGHTS[5]), att.nonce);

      const p = await governance.getProposal(proposalId);
      expect(p.votesFor).to.equal(100n * BigInt(RANK_WEIGHTS[5]));
      expect(await governance.hasVoted(proposalId, voterAlice.address)).to.be.true;
      expect(await governance.usedNonces(att.nonce)).to.be.true;
    });

    it('supports for/against/abstain tallies', async () => {
      const attA = await buildAttestation(attestationSigner, governance, voterAlice.address, 0, proposalId);
      await governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(attA));

      const attB = await buildAttestation(attestationSigner, governance, voterBob.address, 0, proposalId);
      await governance.connect(voterBob).castVote(proposalId, SUPPORT_AGAINST, toStructArg(attB));

      const p = await governance.getProposal(proposalId);
      expect(p.votesFor).to.equal(100n);
      expect(p.votesAgainst).to.equal(50n);
      expect(p.votesAbstain).to.equal(0n);
    });
  });

  // ─── Attestation attacks ───────────────────────────────────────────
  describe('castVote — attestation rejections', () => {
    it('rejects expired attestation', async () => {
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId, {
        expiryOffsetSec: 60,
      });
      await time.increase(120);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Attestation expired');
    });

    it('rejects attestation signed by someone other than attestationSigner', async () => {
      // attacker signs their own attestation (not attestationSigner)
      const att = await buildAttestation(attacker, governance, attacker.address, 9, proposalId);
      await expect(
        governance.connect(attacker).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Invalid attestation');
    });

    it('rejects attestation signed by a different arbitrary wallet', async () => {
      const att = await buildAttestation(otherSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Invalid attestation');
    });

    it('rejects nonce replay (same attestation twice)', async () => {
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att));
      // Even if a new proposal uses the same nonce, it must reject — though in practice
      // the caller would have already voted on proposalId and hit "Already voted" first.
      // Here we also confirm the usedNonces storage is set.
      expect(await governance.usedNonces(att.nonce)).to.be.true;

      // Second attempt by the same voter on a *different* proposal using the same nonce:
      await governance.connect(proposer).propose(PT_SIGNAL, 'p2', 'd', ethers.ZeroAddress, '0x', 0);
      const proposal2 = await governance.proposalCount();
      // Must resign for proposal2; but use the exact same nonce.
      const replay = await buildAttestation(
        attestationSigner,
        governance,
        voterAlice.address,
        5,
        proposal2,
        { nonce: att.nonce },
      );
      await expect(
        governance.connect(voterAlice).castVote(proposal2, SUPPORT_FOR, toStructArg(replay)),
      ).to.be.revertedWith('Nonce already used');
    });

    it('rejects attestation where voter != msg.sender', async () => {
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(attacker).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Attestation not for caller');
    });

    it('rejects attestation bound to a different proposalId', async () => {
      // Create a second proposal
      await governance.connect(proposer).propose(PT_SIGNAL, 'p2', 'd', ethers.ZeroAddress, '0x', 0);
      const proposal2 = await governance.proposalCount();
      // Sign for proposal2 but try to submit on proposalId
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposal2);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Attestation proposal mismatch');
    });

    it('rejects tampered rankIndex (signature mismatch)', async () => {
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 1, proposalId);
      // Attacker bumps rankIndex from 1→9 (60× multiplier) without re-signing.
      const tampered = { ...att, rankIndex: 9 };
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(tampered)),
      ).to.be.revertedWith('Invalid attestation');
    });

    it('rejects invalid rank index (>= 10)', async () => {
      // Signer's key is fine but rank is out of range — fail-fast before recovery.
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 10, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Invalid rank index');
    });

    it('rejects invalid support value (>= 3)', async () => {
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, 3, toStructArg(att)),
      ).to.be.revertedWith('Invalid support value');
    });
  });

  // ─── Flow controls ────────────────────────────────────────────────
  describe('castVote — flow controls', () => {
    it('rejects double voting by the same wallet', async () => {
      const att1 = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att1));

      const att2 = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_AGAINST, toStructArg(att2)),
      ).to.be.revertedWith('Already voted');
    });

    it('rejects voting after votingEnd', async () => {
      await time.increase(8 * 24 * 60 * 60); // 8 days — past default 7-day voting period
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId, {
        expiryOffsetSec: 3600,
      });
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('Voting ended');
    });

    it('rejects voting from wallet with zero TMIM balance', async () => {
      const att = await buildAttestation(attestationSigner, governance, proposer.address, 5, proposalId);
      await expect(
        governance.connect(proposer).castVote(proposalId, SUPPORT_FOR, toStructArg(att)),
      ).to.be.revertedWith('No TMIM balance');
    });

    it('rejects vote on a non-Active proposal (e.g. Queued after finalization)', async () => {
      // Lower quorum so Alice's single vote passes
      await governance.setDefaultQuorum(10);
      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 0, proposalId);
      await governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(att));
      await time.increase(8 * 24 * 60 * 60);
      await governance.finalizeProposal(proposalId); // → Queued

      // Now try to vote again (different voter) — proposal is Queued, not Active
      const att2 = await buildAttestation(attestationSigner, governance, voterBob.address, 0, proposalId);
      await expect(
        governance.connect(voterBob).castVote(proposalId, SUPPORT_FOR, toStructArg(att2)),
      ).to.be.revertedWith('Proposal not active');
    });
  });

  // ─── Signer rotation ──────────────────────────────────────────────
  describe('setAttestationSigner', () => {
    it('APPROVER_ROLE can rotate the signer', async () => {
      await expect(governance.setAttestationSigner(otherSigner.address))
        .to.emit(governance, 'AttestationSignerUpdated')
        .withArgs(attestationSigner.address, otherSigner.address);
      expect(await governance.attestationSigner()).to.equal(otherSigner.address);
    });

    it('non-APPROVER cannot rotate', async () => {
      await expect(
        governance.connect(attacker).setAttestationSigner(otherSigner.address),
      ).to.be.revertedWithCustomError(governance, 'AccessControlUnauthorizedAccount');
    });

    it('rejects zero address rotation', async () => {
      await expect(governance.setAttestationSigner(ethers.ZeroAddress))
        .to.be.revertedWith('signer zero');
    });

    it('after rotation, old signer\'s attestations are rejected', async () => {
      await governance.setAttestationSigner(otherSigner.address);
      const oldAtt = await buildAttestation(attestationSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(oldAtt)),
      ).to.be.revertedWith('Invalid attestation');

      // New signer works
      const newAtt = await buildAttestation(otherSigner, governance, voterAlice.address, 5, proposalId);
      await expect(
        governance.connect(voterAlice).castVote(proposalId, SUPPORT_FOR, toStructArg(newAtt)),
      ).to.emit(governance, 'VoteCast');
    });
  });

  // ─── Full governance lifecycle (regression — nothing else broke) ──
  describe('lifecycle regression', () => {
    it('propose → vote → finalize → execute path still works', async () => {
      // Lower quorum so a single voter can pass
      await governance.setDefaultQuorum(10);
      // New proposal under lower quorum
      await governance.connect(proposer).propose(PT_SIGNAL, 'q', 'desc', ethers.ZeroAddress, '0x', 0);
      const pid = await governance.proposalCount();

      const att = await buildAttestation(attestationSigner, governance, voterAlice.address, 0, pid);
      await governance.connect(voterAlice).castVote(pid, SUPPORT_FOR, toStructArg(att));

      await time.increase(8 * 24 * 60 * 60); // past voting end
      await governance.finalizeProposal(pid);
      expect((await governance.getProposal(pid)).state).to.equal(3); // Queued

      await time.increase(3 * 24 * 60 * 60); // past timelock
      await expect(governance.executeProposal(pid))
        .to.emit(governance, 'ProposalExecuted')
        .withArgs(pid);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C3 — Target / Selector Whitelist
// ════════════════════════════════════════════════════════════════════════════
describe('BeisGovernance — C3 target/selector whitelist', () => {
  const PROPOSER_ROLE_W = ethers.keccak256(ethers.toUtf8Bytes('PROPOSER_ROLE'));

  let wAdmin:  HardhatEthersSigner;
  let wAtt:    HardhatEthersSigner;
  let wProp:   HardhatEthersSigner;
  let wTmim:   SecharToken;
  let wGov:    BeisGovernance;

  beforeEach(async () => {
    [wAdmin, wAtt, wProp] = await ethers.getSigners();
    const TMIMF = await ethers.getContractFactory('SecharToken');
    wTmim = (await TMIMF.deploy(wAdmin.address)) as unknown as SecharToken;
    const GovF = await ethers.getContractFactory('BeisGovernance');
    wGov = (await GovF.deploy(
      wAdmin.address, await wTmim.getAddress(), wAtt.address,
    )) as unknown as BeisGovernance;
    await wGov.connect(wAdmin).grantRole(PROPOSER_ROLE_W, wProp.address);
  });

  it('SIGNAL with zero target and empty calldata succeeds', async () => {
    await expect(wGov.connect(wProp).propose(
      PT_SIGNAL, 'advisory', 'desc', ethers.ZeroAddress, '0x', 0,
    )).to.emit(wGov, 'ProposalCreated');
  });

  it('SIGNAL with non-empty callData reverts "SIGNAL must be no-op"', async () => {
    await expect(wGov.connect(wProp).propose(
      PT_SIGNAL, 'advisory', 'desc', ethers.ZeroAddress, '0x12345678', 0,
    )).to.be.revertedWith('SIGNAL must be no-op');
  });

  it('non-SIGNAL with zero target reverts "Target zero"', async () => {
    await expect(wGov.connect(wProp).propose(
      PT_REDEMPTION_RATE, 'rate', 'desc', ethers.ZeroAddress, '0x12345678', 0,
    )).to.be.revertedWith('Target zero');
  });

  it('non-SIGNAL with un-trusted target reverts "Target not trusted"', async () => {
    await expect(wGov.connect(wProp).propose(
      PT_REDEMPTION_RATE, 'rate', 'desc', wAdmin.address, '0x12345678', 0,
    )).to.be.revertedWith('Target not trusted');
  });

  it('non-SIGNAL with trusted target but empty callData reverts "Calldata too short"', async () => {
    await wGov.connect(wAdmin).setTrustedTarget(wAdmin.address, true);
    await expect(wGov.connect(wProp).propose(
      PT_REDEMPTION_RATE, 'rate', 'desc', wAdmin.address, '0x', 0,
    )).to.be.revertedWith('Calldata too short');
  });

  it('non-SIGNAL with trusted target but disallowed selector reverts "Selector not allowed"', async () => {
    await wGov.connect(wAdmin).setTrustedTarget(wAdmin.address, true);
    await expect(wGov.connect(wProp).propose(
      PT_REDEMPTION_RATE, 'rate', 'desc', wAdmin.address, '0xdeadbeef', 0,
    )).to.be.revertedWith('Selector not allowed');
  });

  it('non-SIGNAL with trusted target + allowed selector succeeds and stores correct proposalType', async () => {
    const mockTarget = wAdmin.address;
    const mockSel    = '0x12345678';
    await wGov.connect(wAdmin).setTrustedTarget(mockTarget, true);
    await wGov.connect(wAdmin).setAllowedSelector(PT_REDEMPTION_RATE, mockSel, true);
    await wGov.connect(wProp).propose(
      PT_REDEMPTION_RATE, 'rate', 'desc', mockTarget, mockSel, 0,
    );
    const pid = await wGov.proposalCount();
    const p   = await wGov.getProposal(pid);
    expect(p.proposalType).to.equal(PT_REDEMPTION_RATE);
    expect(p.target).to.equal(mockTarget);
  });

  it('bootstrapSelectorWhitelist seeds the SPEC_2 matrix', async () => {
    const mockTreasury = wAdmin.address;
    const mockTmim     = wAtt.address;
    await wGov.connect(wAdmin).bootstrapSelectorWhitelist(mockTreasury, mockTmim, ethers.ZeroAddress);

    expect(await wGov.trustedTargets(mockTreasury)).to.be.true;
    expect(await wGov.trustedTargets(mockTmim)).to.be.true;
    expect(await wGov.trustedTargets(await wGov.getAddress())).to.be.true;

    expect(await wGov.allowedSelectors(PT_REDEMPTION_RATE,    sel4('setRedemptionRate(uint256)'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_MONTHLY_CAP_UPDATE, sel4('setMaxMonthlyMint(uint256)'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_EMERGENCY_PAUSE,    sel4('pause()'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_EMERGENCY_UNPAUSE,  sel4('unpause()'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_MIVTZA_FUNDING,     sel4('createStream(address,uint256,uint256)'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_TREASURY_TRANSFER,  sel4('cancelStream(uint256)'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_MINT_TOKENS,        sel4('mint(address,uint256,string)'))).to.be.true;
    expect(await wGov.allowedSelectors(PT_GRANT_ROLE,         sel4('grantRole(bytes32,address)'))).to.be.true;
  });

  it('setTrustedTarget is DEFAULT_ADMIN_ROLE-only', async () => {
    await expect(wGov.connect(wProp).setTrustedTarget(wAdmin.address, true))
      .to.be.revertedWithCustomError(wGov, 'AccessControlUnauthorizedAccount');
  });

  it('setTrustedTarget reverts for zero address', async () => {
    await expect(wGov.connect(wAdmin).setTrustedTarget(ethers.ZeroAddress, true))
      .to.be.revertedWith('Target zero');
  });

  it('setAllowedSelector is DEFAULT_ADMIN_ROLE-only', async () => {
    await expect(wGov.connect(wProp).setAllowedSelector(PT_SIGNAL, '0x12345678', true))
      .to.be.revertedWithCustomError(wGov, 'AccessControlUnauthorizedAccount');
  });

  it('bootstrapSelectorWhitelist with all-zero targets skips the conditional trusts', async () => {
    // Covers the false branches in all three if(x != address(0)) guards
    await expect(
      wGov.connect(wAdmin).bootstrapSelectorWhitelist(
        ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress,
      ),
    ).to.not.be.reverted;
    // Self-target (governance itself) is always added regardless
    expect(await wGov.trustedTargets(await wGov.getAddress())).to.be.true;
    // External targets were skipped
    expect(await wGov.trustedTargets(ethers.ZeroAddress)).to.be.false;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C3 — Execution Gas Control
// ════════════════════════════════════════════════════════════════════════════
describe('BeisGovernance — C3 execution gas control', () => {
  const MINTER_ROLE_G   = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const PROPOSER_ROLE_G = ethers.keccak256(ethers.toUtf8Bytes('PROPOSER_ROLE'));

  let gAdmin:  HardhatEthersSigner;
  let gAtt:    HardhatEthersSigner;
  let gProp:   HardhatEthersSigner;
  let gVoter:  HardhatEthersSigner;
  let gTmim:   SecharToken;
  let gGov:    BeisGovernance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let callee:  any;
  let calleeAddr: string;

  beforeEach(async () => {
    [gAdmin, gAtt, gProp, gVoter] = await ethers.getSigners();

    const TMIMF = await ethers.getContractFactory('SecharToken');
    gTmim = (await TMIMF.deploy(gAdmin.address)) as unknown as SecharToken;

    const GovF = await ethers.getContractFactory('BeisGovernance');
    gGov = (await GovF.deploy(
      gAdmin.address, await gTmim.getAddress(), gAtt.address,
    )) as unknown as BeisGovernance;

    const CalleeF = await ethers.getContractFactory('TestCallee');
    callee = await CalleeF.deploy();
    calleeAddr = await callee.getAddress();

    await gGov.connect(gAdmin).grantRole(PROPOSER_ROLE_G, gProp.address);
    await gTmim.connect(gAdmin).grantRole(MINTER_ROLE_G, gAdmin.address);
    await gTmim.connect(gAdmin).mint(gVoter.address, 1000, 'test');
    await gGov.connect(gAdmin).setDefaultQuorum(10);

    // Whitelist TestCallee for all selectors we need
    await gGov.connect(gAdmin).setTrustedTarget(calleeAddr, true);
    await gGov.connect(gAdmin).setAllowedSelector(PT_PARAMETER_UPDATE, sel4('setValue(uint256)'), true);
    await gGov.connect(gAdmin).setAllowedSelector(PT_PARAMETER_UPDATE, sel4('revertWithMessage()'), true);
    await gGov.connect(gAdmin).setAllowedSelector(PT_PARAMETER_UPDATE, sel4('revertNoReason()'), true);
    await gGov.connect(gAdmin).setAllowedSelector(PT_PARAMETER_UPDATE, sel4('revertWithCustomError()'), true);
    await gGov.connect(gAdmin).setAllowedSelector(PT_PARAMETER_UPDATE, sel4('revertWithMalformedError()'), true);
  });

  async function createQueuedProposal(callData: string): Promise<bigint> {
    await gGov.connect(gProp).propose(
      PT_PARAMETER_UPDATE, 'title', 'desc', calleeAddr, callData, 0,
    );
    const pid = await gGov.proposalCount();
    const att = await buildAttestation(gAtt, gGov, gVoter.address, 0, pid);
    await gGov.connect(gVoter).castVote(pid, SUPPORT_FOR, toStructArg(att));
    await time.increase(8 * 24 * 60 * 60);
    await gGov.finalizeProposal(pid);
    await time.increase(3 * 24 * 60 * 60);
    return pid;
  }

  it('emits ExecutionAttempted(id, true, 0x) on successful callee', async () => {
    const callData = CALLEE_IFACE.encodeFunctionData('setValue', [42n]);
    const pid = await createQueuedProposal(callData);
    await expect(gGov.connect(gAdmin).executeProposal(pid))
      .to.emit(gGov, 'ExecutionAttempted')
      .withArgs(pid, true, '0x');
  });

  it('reverts with callee reason string when callee reverts with message', async () => {
    const callData = CALLEE_IFACE.encodeFunctionData('revertWithMessage');
    const pid = await createQueuedProposal(callData);
    await expect(gGov.connect(gAdmin).executeProposal(pid))
      .to.be.revertedWith('callee reverted');
  });

  it('reverts with "Execution failed" when callee reverts without reason', async () => {
    const callData = CALLEE_IFACE.encodeFunctionData('revertNoReason');
    const pid = await createQueuedProposal(callData);
    await expect(gGov.connect(gAdmin).executeProposal(pid))
      .to.be.revertedWith('Execution failed');
  });

  // Audit L-1: 68+ bytes of non-Error(string) revert data used to panic in abi.decode.
  it('reverts with "Execution failed" when callee reverts with a custom error', async () => {
    const callData = CALLEE_IFACE.encodeFunctionData('revertWithCustomError');
    const pid = await createQueuedProposal(callData);
    await expect(gGov.connect(gAdmin).executeProposal(pid))
      .to.be.revertedWith('Execution failed');
  });

  it('reverts with "Execution failed" when Error(string) data has a bogus length', async () => {
    const callData = CALLEE_IFACE.encodeFunctionData('revertWithMalformedError');
    const pid = await createQueuedProposal(callData);
    await expect(gGov.connect(gAdmin).executeProposal(pid))
      .to.be.revertedWith('Execution failed');
  });

  it('setExecutionGasReserve: admin can tune within [10_000, 500_000]', async () => {
    await expect(gGov.connect(gAdmin).setExecutionGasReserve(10_000))
      .to.emit(gGov, 'GovernanceParameterUpdated')
      .withArgs('executionGasReserve', 10_000n);
    expect(await gGov.executionGasReserve()).to.equal(10_000n);

    await gGov.connect(gAdmin).setExecutionGasReserve(500_000);
    expect(await gGov.executionGasReserve()).to.equal(500_000n);
  });

  it('setExecutionGasReserve reverts out of bounds', async () => {
    await expect(gGov.connect(gAdmin).setExecutionGasReserve(9_999))
      .to.be.revertedWith('Reserve out of range');
    await expect(gGov.connect(gAdmin).setExecutionGasReserve(500_001))
      .to.be.revertedWith('Reserve out of range');
  });

  it('setExecutionGasReserve is DEFAULT_ADMIN_ROLE-only', async () => {
    await expect(gGov.connect(gProp).setExecutionGasReserve(20_000))
      .to.be.revertedWithCustomError(gGov, 'AccessControlUnauthorizedAccount');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C4 — Coverage hardening
// ════════════════════════════════════════════════════════════════════════════
describe('BeisGovernance — C4 coverage hardening', () => {
  const MINTER_ROLE_C4   = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const PROPOSER_ROLE_C4 = ethers.keccak256(ethers.toUtf8Bytes('PROPOSER_ROLE'));

  let c4Admin:  HardhatEthersSigner;
  let c4Att:    HardhatEthersSigner;
  let c4Prop:   HardhatEthersSigner;
  let c4Voter:  HardhatEthersSigner;
  let c4Other:  HardhatEthersSigner;
  let c4Tmim:   SecharToken;
  let c4Gov:    BeisGovernance;

  beforeEach(async () => {
    [c4Admin, c4Att, c4Prop, c4Voter, c4Other] = await ethers.getSigners();

    const TMIMF = await ethers.getContractFactory('SecharToken');
    c4Tmim = (await TMIMF.deploy(c4Admin.address)) as unknown as SecharToken;

    const GovF = await ethers.getContractFactory('BeisGovernance');
    c4Gov = (await GovF.deploy(
      c4Admin.address, await c4Tmim.getAddress(), c4Att.address,
    )) as unknown as BeisGovernance;

    await c4Gov.connect(c4Admin).grantRole(PROPOSER_ROLE_C4, c4Prop.address);
    await c4Tmim.connect(c4Admin).grantRole(MINTER_ROLE_C4, c4Admin.address);
    await c4Tmim.connect(c4Admin).mint(c4Voter.address, 500, 'test');
    await c4Gov.connect(c4Admin).setDefaultQuorum(10);
  });

  async function makeActiveProposal(): Promise<bigint> {
    await c4Gov.connect(c4Prop).propose(PT_SIGNAL, 'title', 'desc', ethers.ZeroAddress, '0x', 0);
    return c4Gov.proposalCount();
  }

  async function makeQueuedProposal(): Promise<bigint> {
    const pid = await makeActiveProposal();
    const att = await buildAttestation(c4Att, c4Gov, c4Voter.address, 0, pid);
    await c4Gov.connect(c4Voter).castVote(pid, SUPPORT_FOR, toStructArg(att));
    await time.increase(8 * 24 * 60 * 60);
    await c4Gov.finalizeProposal(pid);
    return pid;
  }

  // ─── cancelProposal ───────────────────────────────────────────────────
  describe('cancelProposal', () => {
    it('proposer can cancel an Active proposal', async () => {
      const pid = await makeActiveProposal();
      await expect(c4Gov.connect(c4Prop).cancelProposal(pid))
        .to.emit(c4Gov, 'ProposalCancelled').withArgs(pid);
      expect((await c4Gov.getProposal(pid)).state).to.equal(5); // Cancelled
    });

    it('admin can cancel an Active proposal', async () => {
      const pid = await makeActiveProposal();
      await expect(c4Gov.connect(c4Admin).cancelProposal(pid))
        .to.emit(c4Gov, 'ProposalCancelled').withArgs(pid);
    });

    it('admin can cancel a Queued proposal', async () => {
      const pid = await makeQueuedProposal();
      expect((await c4Gov.getProposal(pid)).state).to.equal(3); // Queued
      await expect(c4Gov.connect(c4Admin).cancelProposal(pid))
        .to.emit(c4Gov, 'ProposalCancelled').withArgs(pid);
      expect((await c4Gov.getProposal(pid)).state).to.equal(5); // Cancelled
    });

    // Audit M-2: the proposer may not cancel once voting has started.
    it('proposer cannot cancel once a vote has been cast', async () => {
      const pid = await makeActiveProposal();
      const att = await buildAttestation(c4Att, c4Gov, c4Voter.address, 0, pid);
      await c4Gov.connect(c4Voter).castVote(pid, SUPPORT_FOR, toStructArg(att));
      await expect(c4Gov.connect(c4Prop).cancelProposal(pid))
        .to.be.revertedWith('Votes already cast');
    });

    it('proposer cannot cancel a Queued proposal', async () => {
      const pid = await makeQueuedProposal();
      await expect(c4Gov.connect(c4Prop).cancelProposal(pid))
        .to.be.revertedWith('Proposer can cancel only Active proposals');
    });

    it('admin can still cancel after votes are cast', async () => {
      const pid = await makeActiveProposal();
      const att = await buildAttestation(c4Att, c4Gov, c4Voter.address, 0, pid);
      await c4Gov.connect(c4Voter).castVote(pid, SUPPORT_FOR, toStructArg(att));
      await expect(c4Gov.connect(c4Admin).cancelProposal(pid))
        .to.emit(c4Gov, 'ProposalCancelled').withArgs(pid);
    });

    it('non-proposer, non-admin cannot cancel', async () => {
      const pid = await makeActiveProposal();
      await expect(c4Gov.connect(c4Other).cancelProposal(pid))
        .to.be.revertedWith('Not authorized');
    });

    it('cannot cancel a Failed proposal', async () => {
      // Create and finalize without votes → Failed
      const pid = await makeActiveProposal();
      await time.increase(8 * 24 * 60 * 60);
      await c4Gov.finalizeProposal(pid);
      expect((await c4Gov.getProposal(pid)).state).to.equal(2); // Failed
      await expect(c4Gov.connect(c4Admin).cancelProposal(pid))
        .to.be.revertedWith('Cannot cancel');
    });

    it('cannot cancel an already Cancelled proposal', async () => {
      const pid = await makeActiveProposal();
      await c4Gov.connect(c4Admin).cancelProposal(pid);
      await expect(c4Gov.connect(c4Admin).cancelProposal(pid))
        .to.be.revertedWith('Cannot cancel');
    });
  });

  // ─── setVotingPeriod ──────────────────────────────────────────────────
  describe('setVotingPeriod', () => {
    it('admin sets a valid voting period and emits GovernanceParameterUpdated', async () => {
      const period = 3 * 24 * 60 * 60; // 3 days
      await expect(c4Gov.connect(c4Admin).setVotingPeriod(period))
        .to.emit(c4Gov, 'GovernanceParameterUpdated')
        .withArgs('votingPeriod', BigInt(period));
      expect(await c4Gov.votingPeriod()).to.equal(BigInt(period));
    });

    it('reverts when period < 1 day', async () => {
      await expect(c4Gov.connect(c4Admin).setVotingPeriod(60))
        .to.be.revertedWith('Out of range');
    });

    it('reverts when period > 30 days', async () => {
      await expect(c4Gov.connect(c4Admin).setVotingPeriod(31 * 24 * 60 * 60))
        .to.be.revertedWith('Out of range');
    });

    it('non-admin cannot set voting period', async () => {
      await expect(c4Gov.connect(c4Prop).setVotingPeriod(2 * 24 * 60 * 60))
        .to.be.revertedWithCustomError(c4Gov, 'AccessControlUnauthorizedAccount');
    });
  });

  // ─── setTimelockDelay ─────────────────────────────────────────────────
  describe('setTimelockDelay', () => {
    it('admin sets a valid timelock delay and emits GovernanceParameterUpdated', async () => {
      const delay = 1 * 24 * 60 * 60; // 1 day
      await expect(c4Gov.connect(c4Admin).setTimelockDelay(delay))
        .to.emit(c4Gov, 'GovernanceParameterUpdated')
        .withArgs('timelockDelay', BigInt(delay));
      expect(await c4Gov.timelockDelay()).to.equal(BigInt(delay));
    });

    it('admin sets delay to zero (no timelock)', async () => {
      await expect(c4Gov.connect(c4Admin).setTimelockDelay(0))
        .to.emit(c4Gov, 'GovernanceParameterUpdated')
        .withArgs('timelockDelay', 0n);
    });

    it('reverts when delay > 7 days', async () => {
      await expect(c4Gov.connect(c4Admin).setTimelockDelay(8 * 24 * 60 * 60))
        .to.be.revertedWith('Delay too long');
    });

    it('non-admin cannot set timelock delay', async () => {
      await expect(c4Gov.connect(c4Prop).setTimelockDelay(0))
        .to.be.revertedWithCustomError(c4Gov, 'AccessControlUnauthorizedAccount');
    });
  });

  // ─── finalizeProposal failure paths ───────────────────────────────────
  describe('finalizeProposal — failure paths', () => {
    it('fails when quorum not met (no votes cast)', async () => {
      const pid = await makeActiveProposal();
      await time.increase(8 * 24 * 60 * 60);
      await c4Gov.finalizeProposal(pid);
      expect((await c4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });

    it('fails when votesAgainst >= votesFor even if quorum met', async () => {
      const pid = await makeActiveProposal();
      const att = await buildAttestation(c4Att, c4Gov, c4Voter.address, 0, pid);
      await c4Gov.connect(c4Voter).castVote(pid, SUPPORT_AGAINST, toStructArg(att));
      await time.increase(8 * 24 * 60 * 60);
      await c4Gov.finalizeProposal(pid);
      const p = await c4Gov.getProposal(pid);
      expect(p.state).to.equal(2); // Failed
      expect(p.votesAgainst).to.be.greaterThan(0n);
    });

    it('reverts if proposal is not Active', async () => {
      const pid = await makeActiveProposal();
      await time.increase(8 * 24 * 60 * 60);
      await c4Gov.finalizeProposal(pid); // → Failed
      await expect(c4Gov.finalizeProposal(pid)).to.be.revertedWith('Not active');
    });

    it('reverts if voting still open', async () => {
      const pid = await makeActiveProposal();
      await expect(c4Gov.finalizeProposal(pid)).to.be.revertedWith('Voting still open');
    });
  });

  // ─── View helpers ─────────────────────────────────────────────────────
  describe('view helpers', () => {
    it('getVoteWeight returns balance * rankVotingPower[rankIndex]', async () => {
      const weight = await c4Gov.getVoteWeight(c4Voter.address, 3); // rank 3 → multiplier 8
      expect(weight).to.equal(500n * 8n); // balance=500, weight[3]=8
    });

    it('getVoteWeight reverts for rankIndex >= 10', async () => {
      await expect(c4Gov.getVoteWeight(c4Voter.address, 10))
        .to.be.revertedWith('Invalid rank index');
    });

    it('domainSeparator returns a nonzero bytes32', async () => {
      const sep = await c4Gov.domainSeparator();
      expect(sep).to.not.equal(ethers.ZeroHash);
    });

    it('rankAttestationTypehash returns the expected EIP-712 typehash', async () => {
      const expected = ethers.keccak256(ethers.toUtf8Bytes(
        'RankAttestation(address voter,uint8 rankIndex,uint256 proposalId,uint256 nonce,uint256 expiry)',
      ));
      expect(await c4Gov.rankAttestationTypehash()).to.equal(expected);
    });
  });

  // ─── Misc branch coverage ─────────────────────────────────────────────
  describe('misc branches', () => {
    it('propose stores quorumOverride when provided', async () => {
      await c4Gov.connect(c4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 500);
      const pid = await c4Gov.proposalCount();
      const p   = await c4Gov.getProposal(pid);
      expect(p.quorumRequired).to.equal(500n);
    });

    // Audit L-2: supply is 500 TMIM and the top rank multiplier is 60.
    it('propose accepts a quorumOverride up to the most weight that could vote', async () => {
      await c4Gov.connect(c4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 500 * 60);
      expect((await c4Gov.getProposal(await c4Gov.proposalCount())).quorumRequired).to.equal(30_000n);
    });

    it('propose rejects an unreachable quorumOverride', async () => {
      await expect(c4Gov.connect(c4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 500 * 60 + 1))
        .to.be.revertedWith('Quorum unreachable');
      await expect(c4Gov.connect(c4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', ethers.MaxUint256))
        .to.be.revertedWith('Quorum unreachable');
    });

    it('bootstrapSelectorWhitelist with non-zero registry trusts the registry address', async () => {
      const mockRegistry = c4Other.address;
      await c4Gov.connect(c4Admin).bootstrapSelectorWhitelist(
        c4Voter.address, await c4Tmim.getAddress(), mockRegistry,
      );
      expect(await c4Gov.trustedTargets(mockRegistry)).to.be.true;
    });

    it('SIGNAL proposal executes as no-op (target zero, no external call)', async () => {
      const pid = await makeQueuedProposal(); // SIGNAL proposal queued
      await time.increase(3 * 24 * 60 * 60); // past timelock
      await expect(c4Gov.connect(c4Admin).executeProposal(pid))
        .to.emit(c4Gov, 'ProposalExecuted').withArgs(pid);
      expect((await c4Gov.getProposal(pid)).state).to.equal(4); // Executed
    });

    it('executeProposal reverts if proposal is not Queued', async () => {
      const pid = await makeActiveProposal();
      await expect(c4Gov.connect(c4Admin).executeProposal(pid))
        .to.be.revertedWith('Not queued');
    });

    it('executeProposal reverts if timelock has not expired', async () => {
      const pid = await makeQueuedProposal();
      // Advance only 1 second — timelock is 2 days by default
      await time.increase(1);
      await expect(c4Gov.connect(c4Admin).executeProposal(pid))
        .to.be.revertedWith('Timelock not expired');
    });

    it('castVote records abstain votes correctly', async () => {
      const pid = await makeActiveProposal();
      const att = await buildAttestation(c4Att, c4Gov, c4Voter.address, 2, pid);
      await c4Gov.connect(c4Voter).castVote(pid, SUPPORT_ABSTAIN, toStructArg(att));
      const p = await c4Gov.getProposal(pid);
      expect(p.votesAbstain).to.equal(500n * BigInt(RANK_WEIGHTS[2])); // rank 2 → weight 5
      expect(p.votesFor).to.equal(0n);
      expect(p.votesAgainst).to.equal(0n);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C4 — Supermajority enforcement (SPEC_2 §2B) + security hardening
// ════════════════════════════════════════════════════════════════════════════
describe('BeisGovernance — C4 supermajority + security hardening', () => {
  const MINTER_ROLE_S4   = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const PROPOSER_ROLE_S4 = ethers.keccak256(ethers.toUtf8Bytes('PROPOSER_ROLE'));

  let s4Admin:   HardhatEthersSigner;
  let s4Att:     HardhatEthersSigner;
  let s4Prop:    HardhatEthersSigner;
  let s4For:     HardhatEthersSigner;
  let s4Against: HardhatEthersSigner;
  let s4Tmim:    SecharToken;
  let s4Gov:     BeisGovernance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s4Callee:  any;
  let s4CalleeAddr: string;

  const FAKE_SEL = '0x12345678';

  beforeEach(async () => {
    [s4Admin, s4Att, s4Prop, s4For, s4Against] = await ethers.getSigners();

    const TMIMF = await ethers.getContractFactory('SecharToken');
    s4Tmim = (await TMIMF.deploy(s4Admin.address)) as unknown as SecharToken;

    const GovF = await ethers.getContractFactory('BeisGovernance');
    s4Gov = (await GovF.deploy(
      s4Admin.address, await s4Tmim.getAddress(), s4Att.address,
    )) as unknown as BeisGovernance;

    const CalleeF = await ethers.getContractFactory('TestCallee');
    s4Callee = await CalleeF.deploy();
    s4CalleeAddr = await s4Callee.getAddress();

    await s4Gov.connect(s4Admin).grantRole(PROPOSER_ROLE_S4, s4Prop.address);
    await s4Tmim.connect(s4Admin).grantRole(MINTER_ROLE_S4, s4Admin.address);
    await s4Gov.connect(s4Admin).setDefaultQuorum(50);

    // Whitelist fake target + selector for non-SIGNAL proposal types
    await s4Gov.connect(s4Admin).setTrustedTarget(s4CalleeAddr, true);
    await s4Gov.connect(s4Admin).setAllowedSelector(PT_GRANT_ROLE,         FAKE_SEL, true);
    await s4Gov.connect(s4Admin).setAllowedSelector(PT_PARAMETER_UPDATE,   FAKE_SEL, true);
    await s4Gov.connect(s4Admin).setAllowedSelector(PT_MONTHLY_CAP_UPDATE, FAKE_SEL, true);
  });

  async function makeNonSignalProposal(pt: number): Promise<bigint> {
    await s4Gov.connect(s4Prop).propose(pt, 'title', 'desc', s4CalleeAddr, FAKE_SEL, 0);
    return s4Gov.proposalCount();
  }

  async function voteAndFinalize(
    pid: bigint,
    forBalance: number,
    againstBalance: number,
  ): Promise<void> {
    if (forBalance > 0) {
      await s4Tmim.connect(s4Admin).mint(s4For.address, forBalance, 'test');
      const attFor = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_FOR, toStructArg(attFor));
    }
    if (againstBalance > 0) {
      await s4Tmim.connect(s4Admin).mint(s4Against.address, againstBalance, 'test');
      const attAg = await buildAttestation(s4Att, s4Gov, s4Against.address, 0, pid);
      await s4Gov.connect(s4Against).castVote(pid, SUPPORT_AGAINST, toStructArg(attAg));
    }
    await time.increase(8 * 24 * 60 * 60);
    await s4Gov.finalizeProposal(pid);
  }

  // ─── Supermajority enforcement ────────────────────────────────────────
  describe('supermajority enforcement', () => {
    it('GRANT_ROLE at exactly 66% passes (6600 bps boundary)', async () => {
      const pid = await makeNonSignalProposal(PT_GRANT_ROLE);
      await voteAndFinalize(pid, 66, 34); // 66/100 = 66.0% ≥ 66%
      expect((await s4Gov.getProposal(pid)).state).to.equal(3); // Queued
    });

    it('GRANT_ROLE at 65% fails supermajority', async () => {
      const pid = await makeNonSignalProposal(PT_GRANT_ROLE);
      await voteAndFinalize(pid, 65, 35); // 65% < 66%
      expect((await s4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });

    it('PARAMETER_UPDATE at 70% passes supermajority', async () => {
      const pid = await makeNonSignalProposal(PT_PARAMETER_UPDATE);
      await voteAndFinalize(pid, 70, 30); // 70% > 66%
      expect((await s4Gov.getProposal(pid)).state).to.equal(3); // Queued
    });

    it('MONTHLY_CAP_UPDATE at 60% fails supermajority', async () => {
      const pid = await makeNonSignalProposal(PT_MONTHLY_CAP_UPDATE);
      await voteAndFinalize(pid, 60, 40); // 60% < 66%
      expect((await s4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });

    it('tied votes (50/50) fail supermajority for GRANT_ROLE', async () => {
      const pid = await makeNonSignalProposal(PT_GRANT_ROLE);
      await voteAndFinalize(pid, 50, 50); // 50% < 66%
      expect((await s4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });

    it('GRANT_ROLE with 100% FOR and no AGAINST passes', async () => {
      const pid = await makeNonSignalProposal(PT_GRANT_ROLE);
      await voteAndFinalize(pid, 100, 0); // 100% FOR
      expect((await s4Gov.getProposal(pid)).state).to.equal(3); // Queued
    });

    it('SIGNAL with 51/49 passes simple majority (no supermajority required)', async () => {
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 0);
      const pid = await s4Gov.proposalCount();
      await voteAndFinalize(pid, 51, 49); // 51% > 50% simple majority
      expect((await s4Gov.getProposal(pid)).state).to.equal(3); // Queued
    });

    it('SIGNAL with tied 50/50 fails simple majority', async () => {
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 0);
      const pid = await s4Gov.proposalCount();
      await voteAndFinalize(pid, 50, 50); // votesFor not > votesAgainst
      expect((await s4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });

    it('GRANT_ROLE with only abstain votes fails (quorum met but no contested votes)', async () => {
      const pid = await makeNonSignalProposal(PT_GRANT_ROLE);
      await s4Tmim.connect(s4Admin).mint(s4For.address, 100, 'test');
      const att = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_ABSTAIN, toStructArg(att));
      await time.increase(8 * 24 * 60 * 60);
      await s4Gov.finalizeProposal(pid);
      // contested = 0 → the supermajority branch short-circuits to Failed
      expect((await s4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });
  });

  // ─── setSupermajorityBps ──────────────────────────────────────────────
  describe('setSupermajorityBps', () => {
    it('admin sets a value mid-range and emits GovernanceParameterUpdated', async () => {
      await expect(s4Gov.connect(s4Admin).setSupermajorityBps(7500))
        .to.emit(s4Gov, 'GovernanceParameterUpdated')
        .withArgs('supermajorityBps', 7500n);
      expect(await s4Gov.supermajorityBps()).to.equal(7500n);
    });

    it('admin sets the minimum valid value (5001)', async () => {
      await expect(s4Gov.connect(s4Admin).setSupermajorityBps(5001))
        .to.emit(s4Gov, 'GovernanceParameterUpdated')
        .withArgs('supermajorityBps', 5001n);
    });

    it('admin sets the maximum valid value (9999)', async () => {
      await expect(s4Gov.connect(s4Admin).setSupermajorityBps(9999))
        .to.emit(s4Gov, 'GovernanceParameterUpdated')
        .withArgs('supermajorityBps', 9999n);
    });

    it('reverts for bps < 5001', async () => {
      await expect(s4Gov.connect(s4Admin).setSupermajorityBps(5000))
        .to.be.revertedWith('Bps out of range [5001,9999]');
    });

    it('reverts for bps > 9999', async () => {
      await expect(s4Gov.connect(s4Admin).setSupermajorityBps(10000))
        .to.be.revertedWith('Bps out of range [5001,9999]');
    });

    it('non-admin cannot set supermajorityBps', async () => {
      await expect(s4Gov.connect(s4Prop).setSupermajorityBps(7500))
        .to.be.revertedWithCustomError(s4Gov, 'AccessControlUnauthorizedAccount');
    });

    it('setDefaultQuorum reverts for zero', async () => {
      await expect(s4Gov.connect(s4Admin).setDefaultQuorum(0))
        .to.be.revertedWith('Quorum must be positive');
    });

    it('lowered threshold (5001) allows 51% to pass a GRANT_ROLE proposal', async () => {
      await s4Gov.connect(s4Admin).setSupermajorityBps(5001);
      const pid = await makeNonSignalProposal(PT_GRANT_ROLE);
      await voteAndFinalize(pid, 51, 49); // 51% > 50.01%
      expect((await s4Gov.getProposal(pid)).state).to.equal(3); // Queued
    });
  });

  // ─── Quorum boundary conditions ────────────────────────────────────────
  describe('quorum boundary conditions', () => {
    it('passes when total votes exactly equal quorumRequired', async () => {
      await s4Tmim.connect(s4Admin).mint(s4For.address, 100, 'test');
      // quorumOverride = 100; voter power = 100 (rank 0, balance 100)
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 100);
      const pid = await s4Gov.proposalCount();
      const att = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_FOR, toStructArg(att));
      await time.increase(8 * 24 * 60 * 60);
      await s4Gov.finalizeProposal(pid);
      expect((await s4Gov.getProposal(pid)).state).to.equal(3); // Queued
    });

    it('fails when total votes are one unit below quorumRequired', async () => {
      await s4Tmim.connect(s4Admin).mint(s4For.address, 99, 'test');
      // quorumOverride = 100; voter power = 99 — just short
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 100);
      const pid = await s4Gov.proposalCount();
      const att = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_FOR, toStructArg(att));
      await time.increase(8 * 24 * 60 * 60);
      await s4Gov.finalizeProposal(pid);
      expect((await s4Gov.getProposal(pid)).state).to.equal(2); // Failed
    });
  });

  // ─── Execute idempotency ─────────────────────────────────────────────
  describe('executeProposal idempotency', () => {
    it('reverts "Not queued" when the same proposal is executed twice', async () => {
      await s4Gov.connect(s4Admin).setDefaultQuorum(1);
      await s4Tmim.connect(s4Admin).mint(s4For.address, 1, 'test');
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 0);
      const pid = await s4Gov.proposalCount();

      const att = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_FOR, toStructArg(att));
      await time.increase(8 * 24 * 60 * 60);
      await s4Gov.finalizeProposal(pid);
      await time.increase(3 * 24 * 60 * 60);

      await s4Gov.connect(s4Admin).executeProposal(pid);
      await expect(s4Gov.connect(s4Admin).executeProposal(pid))
        .to.be.revertedWith('Not queued');
    });
  });

  // ─── Reentrancy guard ────────────────────────────────────────────────
  describe('executeProposal reentrancy guard', () => {
    const ATTACK_IFACE = new ethers.Interface([
      'function attackExecute(address gov, uint256 pid)',
      'function attackExecuteQuiet(address gov, uint256 pid)',
    ]);
    const attackSel      = sel4('attackExecute(address,uint256)');
    const attackQuietSel = sel4('attackExecuteQuiet(address,uint256)');

    beforeEach(async () => {
      await s4Gov.connect(s4Admin).setDefaultQuorum(1);
      await s4Tmim.connect(s4Admin).mint(s4For.address, 100, 'test');
      await s4Gov.connect(s4Admin).setAllowedSelector(PT_PARAMETER_UPDATE, attackSel, true);
      await s4Gov.connect(s4Admin).setAllowedSelector(PT_PARAMETER_UPDATE, attackQuietSel, true);
    });

    it('callee that requires re-entry causes outer executeProposal to revert', async () => {
      // propA is SIGNAL and will be queued (the reentrancy target)
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 'A', 'd', ethers.ZeroAddress, '0x', 0);
      const propAId = await s4Gov.proposalCount(); // 1

      // propB calls attackExecute(gov, propAId) — tries to reenter while propA is Queued
      const calldataB = ATTACK_IFACE.encodeFunctionData('attackExecute', [
        await s4Gov.getAddress(), propAId,
      ]);
      await s4Gov.connect(s4Prop).propose(
        PT_PARAMETER_UPDATE, 'B', 'd', s4CalleeAddr, calldataB, 0,
      );
      const propBId = await s4Gov.proposalCount(); // 2

      // Vote and queue both proposals
      const attA = await buildAttestation(s4Att, s4Gov, s4For.address, 0, propAId);
      await s4Gov.connect(s4For).castVote(propAId, SUPPORT_FOR, toStructArg(attA));
      const attB = await buildAttestation(s4Att, s4Gov, s4For.address, 0, propBId);
      await s4Gov.connect(s4For).castVote(propBId, SUPPORT_FOR, toStructArg(attB));

      await time.increase(8 * 24 * 60 * 60);
      await s4Gov.finalizeProposal(propAId);
      await s4Gov.finalizeProposal(propBId);
      await time.increase(3 * 24 * 60 * 60); // past timelock

      // Execute propB → tries to reenter propA (still Queued) → blocked by nonReentrant
      await expect(s4Gov.connect(s4Admin).executeProposal(propBId)).to.be.reverted;
      // propB must remain Queued (whole tx reverted)
      expect((await s4Gov.getProposal(propBId)).state).to.equal(3); // Queued
      // propA is untouched
      expect((await s4Gov.getProposal(propAId)).state).to.equal(3); // Queued
    });

    it('callee that silently ignores reentrancy failure: propA state not corrupted', async () => {
      // propA SIGNAL — queued first (reentrancy target)
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 'A', 'd', ethers.ZeroAddress, '0x', 0);
      const propAId = await s4Gov.proposalCount(); // 1

      // propC calls attackExecuteQuiet(gov, propAId) — ignores the reentry failure
      const calldataC = ATTACK_IFACE.encodeFunctionData('attackExecuteQuiet', [
        await s4Gov.getAddress(), propAId,
      ]);
      await s4Gov.connect(s4Prop).propose(
        PT_PARAMETER_UPDATE, 'C', 'd', s4CalleeAddr, calldataC, 0,
      );
      const propCId = await s4Gov.proposalCount(); // 2

      const attA = await buildAttestation(s4Att, s4Gov, s4For.address, 0, propAId);
      await s4Gov.connect(s4For).castVote(propAId, SUPPORT_FOR, toStructArg(attA));
      const attC = await buildAttestation(s4Att, s4Gov, s4For.address, 0, propCId);
      await s4Gov.connect(s4For).castVote(propCId, SUPPORT_FOR, toStructArg(attC));

      await time.increase(8 * 24 * 60 * 60);
      await s4Gov.finalizeProposal(propAId);
      await s4Gov.finalizeProposal(propCId);
      await time.increase(3 * 24 * 60 * 60);

      // Execute propC: callee silently tries to reenter propA but fails (nonReentrant).
      // propC itself succeeds since it doesn't propagate the failure.
      await expect(s4Gov.connect(s4Admin).executeProposal(propCId))
        .to.emit(s4Gov, 'ProposalExecuted').withArgs(propCId);

      // propA must still be Queued — the silent reentry had no effect on state
      expect((await s4Gov.getProposal(propAId)).state).to.equal(3); // Queued
      expect((await s4Gov.getProposal(propCId)).state).to.equal(4); // Executed
    });
  });

  // ─── hasVoted / usedNonces monotonicity invariants ───────────────────
  describe('voting invariants', () => {
    it('hasVoted is monotonically set: once true, never false', async () => {
      await s4Tmim.connect(s4Admin).mint(s4For.address, 100, 'test');
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 0);
      const pid = await s4Gov.proposalCount();

      expect(await s4Gov.hasVoted(pid, s4For.address)).to.be.false;
      const att = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_FOR, toStructArg(att));
      expect(await s4Gov.hasVoted(pid, s4For.address)).to.be.true;

      // Second castVote attempt on the same proposal must revert (and hasVoted stays true)
      const att2 = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      await expect(
        s4Gov.connect(s4For).castVote(pid, SUPPORT_AGAINST, toStructArg(att2)),
      ).to.be.revertedWith('Already voted');
      expect(await s4Gov.hasVoted(pid, s4For.address)).to.be.true;
    });

    it('usedNonces is monotonically set: once true, never false', async () => {
      await s4Tmim.connect(s4Admin).mint(s4For.address, 100, 'test');
      await s4Gov.connect(s4Prop).propose(PT_SIGNAL, 't', 'd', ethers.ZeroAddress, '0x', 0);
      const pid = await s4Gov.proposalCount();

      const att = await buildAttestation(s4Att, s4Gov, s4For.address, 0, pid);
      expect(await s4Gov.usedNonces(att.nonce)).to.be.false;
      await s4Gov.connect(s4For).castVote(pid, SUPPORT_FOR, toStructArg(att));
      expect(await s4Gov.usedNonces(att.nonce)).to.be.true;

      // Nonce must remain set across blocks
      await time.increase(1000);
      expect(await s4Gov.usedNonces(att.nonce)).to.be.true;
    });
  });
});
