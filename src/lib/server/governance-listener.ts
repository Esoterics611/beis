// ═══════════════════════════════════════════════════════════════
// Governance chain → Firestore reconciliation listener (C2)
//
// Polls BeisGovernance events on Base Sepolia and mirrors state
// changes into Firestore so the UI stays consistent even if a user votes
// directly on-chain (e.g. via Basescan).
//
// Events handled:
//   ProposalCreated   → find/create Firestore proposal doc
//   VoteCast          → record the vote and add it to the tallies, once
//   ProposalQueued    → set state = 'queued', executionTime
//   ProposalExecuted  → set state = 'executed', executed = true
//   ProposalCancelled → set state = 'cancelled'
//
// Design notes:
//   - Firestore is the source of truth for the UI. On-chain is canonical
//     for votes; Firestore tallies follow the chain's VoteCast weights.
//   - Events are read in block order with getLogs, from a checkpoint kept
//     in Firestore (system/governanceListener.lastBlock). After a restart
//     the listener resumes from the checkpoint, so nothing is missed while
//     the server is down. The checkpoint advances only after every event up
//     to it was handled; a failed range is retried on the next poll.
//   - Every handler is idempotent, so replaying a range is harmless.
//   - The listener runs in the SvelteKit server process (hooks.server.ts),
//     which therefore needs a long-running instance.
//   - First start with no checkpoint: from GOVERNANCE_START_BLOCK (the
//     contract's deployment block) if set, else the last DEFAULT_LOOKBACK blocks.
// ═══════════════════════════════════════════════════════════════

import { ethers } from 'ethers';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import {
  findProposalRef, proposalDocId, recordVoteCast,
} from '$lib/server/governance-votes';

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

const POLL_INTERVAL_MS = 15_000;
const BLOCK_CHUNK      = 2_000;    // stay under public RPC getLogs range limits
const DEFAULT_LOOKBACK = 50_000;   // ~28h of Base blocks

const checkpointRef = () => adminDb.collection('system').doc('governanceListener');

const isoFromSeconds = (s: bigint) => new Date(Number(s) * 1000).toISOString();

// ── Handlers (each idempotent) ──────────────────────────────────

async function onProposalCreated(args: ethers.Result): Promise<void> {
  const [id, proposer, proposalType, title, votingStart, votingEnd] =
    args as unknown as [bigint, string, bigint, string, bigint, bigint];
  const window = {
    onChainProposalId: id.toString(),
    votingStartTime:   isoFromSeconds(votingStart),
    votingEndTime:     isoFromSeconds(votingEnd),
  };

  // Known proposal: the chain only owns the voting window. Leave the rest,
  // including state, which later events may already have moved on.
  const existing = await findProposalRef(id);
  if (existing) {
    await existing.set(window, { merge: true });
    return;
  }

  // Not in Firestore yet: a placeholder the UI can show, under the same
  // doc id the proposal API uses, so whichever writes second fills in.
  const ref = adminDb.collection('proposals').doc(proposalDocId(id));
  try {
    await ref.create({
      ...window,
      proposer,
      type: PROPOSAL_TYPE_NAMES[Number(proposalType)] ?? 'signal',
      title,
      state: 'active',
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
  } catch (e) {
    // ALREADY_EXISTS: the API wrote it between our lookup and create.
    if ((e as { code?: number }).code !== 6) throw e;
    await ref.set(window, { merge: true });
  }
}

async function onVoteCast(args: ethers.Result, log: ethers.Log): Promise<void> {
  const [proposalId, voter, support, rankIndex, weight, nonce] =
    args as unknown as [bigint, string, bigint, bigint, bigint, bigint];
  const result = await recordVoteCast({
    proposalId,
    voter,
    support:   Number(support),
    rankIndex: Number(rankIndex),
    weight,
    nonce,
    txHash:    log.transactionHash,
  });
  if (result === 'unknown_proposal') {
    console.warn(`[governance-listener] VoteCast for unknown proposal ${proposalId} (tx ${log.transactionHash})`);
  }
}

async function onProposalQueued(args: ethers.Result): Promise<void> {
  const [id, executionTime] = args as unknown as [bigint, bigint];
  const ref = await findProposalRef(id);
  if (!ref) return;
  // Queued comes before Executed on-chain; don't undo a later state on replay.
  const state = (await ref.get()).get('state');
  if (state === 'executed' || state === 'cancelled') return;
  await ref.update({ state: 'queued', executionTime: isoFromSeconds(executionTime) });
}

async function onProposalExecuted(args: ethers.Result, log: ethers.Log): Promise<void> {
  const [id] = args as unknown as [bigint];
  const ref = await findProposalRef(id);
  if (!ref) return;
  const block = await log.getBlock();
  await ref.update({
    state: 'executed',
    executed: true,
    executionTime: new Date(block.timestamp * 1000).toISOString(),
  });
}

async function onProposalCancelled(args: ethers.Result): Promise<void> {
  const [id] = args as unknown as [bigint];
  const ref = await findProposalRef(id);
  if (ref) await ref.update({ state: 'cancelled' });
}

const HANDLERS: Record<string, (args: ethers.Result, log: ethers.Log) => Promise<void>> = {
  ProposalCreated:   onProposalCreated,
  VoteCast:          onVoteCast,
  ProposalQueued:    onProposalQueued,
  ProposalExecuted:  onProposalExecuted,
  ProposalCancelled: onProposalCancelled,
};

// ── Polling loop ────────────────────────────────────────────────

/** Process every governance event from the checkpoint up to the latest block. */
async function catchUp(gov: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<void> {
  const latest = await provider.getBlockNumber();
  const saved  = (await checkpointRef().get()).get('lastBlock') as number | undefined;
  const startBlock = Number(env.GOVERNANCE_START_BLOCK) || Math.max(0, latest - DEFAULT_LOOKBACK);
  let from = saved !== undefined ? saved + 1 : startBlock;

  while (from <= latest) {
    const to   = Math.min(from + BLOCK_CHUNK - 1, latest);
    const logs = await gov.queryFilter('*', from, to);
    for (const log of logs) {
      if (!(log instanceof ethers.EventLog)) continue;   // not a governance event we know
      const handler = HANDLERS[log.eventName];
      if (handler) await handler(log.args, log);
    }
    await checkpointRef().set({ lastBlock: to, updatedAt: new Date().toISOString() }, { merge: true });
    from = to + 1;
  }
}

let _started = false;

export function startGovernanceListener(): void {
  if (_started) return;
  if (!env.VITE_GOVERNANCE_ADDRESS?.startsWith('0x')) {
    console.warn('[governance-listener] VITE_GOVERNANCE_ADDRESS not set — listener not started');
    return;
  }

  _started = true;

  const rpc      = env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(rpc);
  const gov      = new ethers.Contract(env.VITE_GOVERNANCE_ADDRESS, GOVERNANCE_ABI, provider);

  const poll = async () => {
    try {
      await catchUp(gov, provider);
    } catch (e) {
      console.error('[governance-listener] poll failed; retrying from the last checkpoint:', e);
    } finally {
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  };
  void poll();

  console.log(`[governance-listener] Polling ${env.VITE_GOVERNANCE_ADDRESS} (${rpc}) every ${POLL_INTERVAL_MS / 1000}s`);
}
