// ═══════════════════════════════════════════════════════════════
// Governance chain → Firestore: proposal lookup and exactly-once votes
//
// The VoteCast event emitted by BeisGovernance is the single source
// of truth for a vote. Two paths record it in Firestore:
//   - the vote endpoint, right after the voter's transaction confirms, so
//     the UI updates at once;
//   - the chain listener, live and when it catches up after a restart.
// Both call recordVoteCast. The vote doc is keyed by the voter's address
// and the contract allows one vote per address per proposal, so whichever
// path arrives first counts the vote and the other is a no-op.
// ═══════════════════════════════════════════════════════════════

import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '$lib/server/firebase-admin';

// Mirrors BeisGovernance.castVote's `support` argument.
export const SUPPORT_NAMES = ['for', 'against', 'abstain'] as const;
export type VoteChoice = typeof SUPPORT_NAMES[number];

export interface VoteCastEvent {
  proposalId: bigint;   // on-chain proposal id
  voter: string;
  support: number;
  rankIndex: number;
  weight: bigint;       // TMIM balance × rank voting power (TMIM has 0 decimals)
  nonce: bigint;
  txHash: string | null;
}

/** Deterministic doc id for proposals created from the chain, so the
 *  proposal API and the listener can't each create their own copy. */
export function proposalDocId(onChainProposalId: bigint | string): string {
  return `onchain-${onChainProposalId.toString()}`;
}

/** Find the Firestore proposal for an on-chain id. Older proposals have
 *  random doc ids, so this looks the id up by field. */
export async function findProposalRef(onChainProposalId: bigint | string): Promise<DocumentReference | null> {
  const snap = await adminDb
    .collection('proposals')
    .where('onChainProposalId', '==', onChainProposalId.toString())
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].ref;
}

export type RecordResult = 'recorded' | 'duplicate' | 'unknown_proposal';

/**
 * Record an on-chain vote and add its weight to the proposal's tallies,
 * exactly once per voter per proposal.
 */
export async function recordVoteCast(ev: VoteCastEvent, talmidId?: string): Promise<RecordResult> {
  const proposalRef = await findProposalRef(ev.proposalId);
  if (!proposalRef) return 'unknown_proposal';

  const voter   = ev.voter.toLowerCase();
  const voteRef = proposalRef.collection('votes').doc(voter);
  const vote: VoteChoice = SUPPORT_NAMES[ev.support] ?? 'abstain';
  const power   = Number(ev.weight);

  return adminDb.runTransaction(async tx => {
    const [proposalDoc, voteDoc] = await Promise.all([tx.get(proposalRef), tx.get(voteRef)]);
    if (voteDoc.exists) {
      // Counted already; the endpoint may still know which talmid cast it.
      if (talmidId && !voteDoc.get('talmidId')) tx.update(voteRef, { talmidId });
      return 'duplicate';
    }

    const p     = proposalDoc.data() ?? {};
    const field = vote === 'for' ? 'votesFor' : vote === 'against' ? 'votesAgainst' : 'votesAbstain';
    const totalAfter =
      (p.votesFor ?? 0) + (p.votesAgainst ?? 0) + (p.votesAbstain ?? 0) + power;

    tx.set(voteRef, {
      vote,
      power,
      rankIndex:     ev.rankIndex,
      walletAddress: voter,
      talmidId:      talmidId ?? null,
      nonce:         ev.nonce.toString(),
      txHash:        ev.txHash,
      onChain:       true,
      timestamp:     new Date().toISOString(),
    });
    tx.update(proposalRef, {
      [field]: (p[field] ?? 0) + power,
      ...(totalAfter >= (p.quorumRequired ?? 0) ? { quorumReached: true } : {}),
    });
    return 'recorded';
  });
}
