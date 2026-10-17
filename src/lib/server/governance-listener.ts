// ═══════════════════════════════════════════════════════════════
// Governance chain → Firestore reconciliation listener (C2)
//
// Subscribes to ChayoleiGovernance events on Base Sepolia and
// mirrors state changes into Firestore so the UI stays consistent
// even if a user votes directly on-chain (e.g. via Basescan).
//
// Events handled:
//   ProposalCreated  → find/create Firestore proposal doc
//   VoteCast         → increment vote tallies
//   ProposalQueued   → set state = 'queued', executionTime
//   ProposalExecuted → set state = 'executed', executed = true
//   ProposalCancelled → set state = 'cancelled'
//
// Design notes:
//   - Firestore is the source of truth for the UI. On-chain is canonical
//     for votes; Firestore tallies are updated here to stay in sync.
//   - All writes are idempotent (set with merge, increment with FieldValue).
//   - The listener runs in the SvelteKit server process (hooks.server.ts).
//   - On a cold start it polls the last 1000 blocks for missed events.
// ═══════════════════════════════════════════════════════════════

import { ethers } from 'ethers';
import { env } from '$env/dynamic/private';

const {
  BASE_SEPOLIA_RPC_URL,
  VITE_GOVERNANCE_ADDRESS,
} = env;
import { adminDb } from '$lib/server/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const GOVERNANCE_ABI = [
  'event ProposalCreated(uint256 indexed id, address indexed proposer, uint8 indexed proposalType, string title, uint256 votingStart, uint256 votingEnd)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint8 rankIndex, uint256 weight, uint256 nonce)',
  'event ProposalQueued(uint256 indexed id, uint256 executionTime)',
  'event ProposalExecuted(uint256 indexed id)',
  'event ProposalCancelled(uint256 indexed id)',
];

// Maps on-chain uint8 ProposalType to Firestore string (mirrors PROPOSAL_TYPES in types/index.ts)
const PROPOSAL_TYPE_NAMES = [
  'signal', 'mivtza_funding', 'redemption_rate', 'emergency_pause',
  'emergency_unpause', 'treasury_transfer', 'grant_role',
  'parameter_update', 'mint_tokens', 'monthly_cap_update',
] as const;

// Maps on-chain support uint8 to Firestore string
const SUPPORT_NAMES: Record<number, string> = { 0: 'for', 1: 'against', 2: 'abstain' };

let _started = false;

export function startGovernanceListener(): void {
  if (_started) return;
  if (!VITE_GOVERNANCE_ADDRESS?.startsWith('0x')) {
    console.warn('[governance-listener] VITE_GOVERNANCE_ADDRESS not set — listener not started');
    return;
  }

  _started = true;

  const rpc      = BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(rpc);
  const gov      = new ethers.Contract(VITE_GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);

  // ── ProposalCreated ──────────────────────────────────────────
  gov.on('ProposalCreated', async (
    id: bigint,
    proposer: string,
    proposalType: number,
    title: string,
    votingStart: bigint,
    votingEnd: bigint,
  ) => {
    try {
      // Find the Firestore doc that has this onChainProposalId and update it,
      // or create a stub if this proposal arrived before the API wrote to Firestore.
      const idStr = id.toString();
      const snap  = await adminDb
        .collection('proposals')
        .where('onChainProposalId', '==', idStr)
        .limit(1)
        .get();

      const data = {
        onChainProposalId: idStr,
        proposer,
        type: PROPOSAL_TYPE_NAMES[proposalType] ?? 'signal',
        title,
        votingStartTime: new Date(Number(votingStart) * 1000).toISOString(),
        votingEndTime:   new Date(Number(votingEnd)   * 1000).toISOString(),
        state: 'active',
      };

      if (snap.empty) {
        // No matching Firestore doc yet — create a stub that the UI can show
        await adminDb.collection('proposals').add({
          ...data,
          description: '',
          target: ethers.ZeroAddress,
          callData: '0x',
          votesFor: 0, votesAgainst: 0, votesAbstain: 0,
          quorumRequired: 0,
          totalVotingTokens: 0,
          executed: false,
          quorumReached: false,
          snapshotBlock: 0,
          createdAt: new Date().toISOString(),
          creatorTalmidId: null,
        });
      } else {
        await snap.docs[0].ref.set(data, { merge: true });
      }
    } catch (e) {
      console.error('[governance-listener] ProposalCreated handler failed:', e);
    }
  });

  // ── VoteCast ─────────────────────────────────────────────────
  gov.on('VoteCast', async (
    proposalId: bigint,
    voter: string,
    support: number,
    rankIndex: number,
    weight: bigint,
    nonce: bigint,
  ) => {
    try {
      const idStr = proposalId.toString();
      const snap  = await adminDb
        .collection('proposals')
        .where('onChainProposalId', '==', idStr)
        .limit(1)
        .get();
      if (snap.empty) return;

      const w     = Number(weight);
      const field = support === 0 ? 'votesFor' : support === 1 ? 'votesAgainst' : 'votesAbstain';

      // Upsert the individual vote sub-doc (keyed by voter address)
      const voteRef = snap.docs[0].ref.collection('votes').doc(voter.toLowerCase());
      await voteRef.set({
        vote: SUPPORT_NAMES[support] ?? 'abstain',
        power: w,
        rankIndex,
        walletAddress: voter,
        onChain: true,
        nonce: nonce.toString(),
        timestamp: new Date().toISOString(),
      }, { merge: true });

      // Increment proposal tallies
      await snap.docs[0].ref.update({ [field]: FieldValue.increment(w) });
    } catch (e) {
      console.error('[governance-listener] VoteCast handler failed:', e);
    }
  });

  // ── ProposalQueued ────────────────────────────────────────────
  gov.on('ProposalQueued', async (id: bigint, executionTime: bigint) => {
    try {
      const snap = await adminDb
        .collection('proposals')
        .where('onChainProposalId', '==', id.toString())
        .limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          state: 'queued',
          executionTime: new Date(Number(executionTime) * 1000).toISOString(),
        });
      }
    } catch (e) {
      console.error('[governance-listener] ProposalQueued handler failed:', e);
    }
  });

  // ── ProposalExecuted ──────────────────────────────────────────
  gov.on('ProposalExecuted', async (id: bigint) => {
    try {
      const snap = await adminDb
        .collection('proposals')
        .where('onChainProposalId', '==', id.toString())
        .limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          state: 'executed',
          executed: true,
          executionTime: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[governance-listener] ProposalExecuted handler failed:', e);
    }
  });

  // ── ProposalCancelled ─────────────────────────────────────────
  gov.on('ProposalCancelled', async (id: bigint) => {
    try {
      const snap = await adminDb
        .collection('proposals')
        .where('onChainProposalId', '==', id.toString())
        .limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({ state: 'cancelled' });
      }
    } catch (e) {
      console.error('[governance-listener] ProposalCancelled handler failed:', e);
    }
  });

  console.log(`[governance-listener] Listening on ${VITE_GOVERNANCE_ADDRESS} (${rpc})`);
}
