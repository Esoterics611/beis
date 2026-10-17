import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia, activityEntry } from '$lib/server/auth';
import { PROPOSAL_TYPES, PROPOSAL_TYPE_CHAIN_INDEX } from '$lib/types';
import type { ProposalType } from '$lib/types';
import { submitProposalOnChain } from '$lib/server/governance-chain';

const VALID_TYPES = new Set<string>(PROPOSAL_TYPES);

// POST /api/governance/proposals — create a new proposal
export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireMashpia(request);
  const data = await request.json();

  const {
    type,
    title,
    description,
    target,
    callData,
    quorumRequired,
    totalVotingTokens,
    votingStartTime,
    votingEndTime,
    proposer: clientProposer,
  } = data;

  // ── Validate ───────────────────────────────────────────────────
  if (!title?.trim())                  throw error(400, 'כותרת נדרשת');
  if (!description?.trim())            throw error(400, 'תיאור נדרש');
  if (!type || !VALID_TYPES.has(type)) throw error(400, 'סוג הצעה לא תקין');
  if (!votingStartTime)                throw error(400, 'תאריך תחילת הצבעה נדרש');
  if (!votingEndTime)                  throw error(400, 'תאריך סיום הצבעה נדרש');

  const startMs = new Date(votingStartTime).getTime();
  const endMs   = new Date(votingEndTime).getTime();
  if (isNaN(startMs) || isNaN(endMs)) throw error(400, 'תאריכי הצבעה אינם תקינים');
  if (endMs <= startMs)               throw error(400, 'תאריך סיום חייב להיות אחרי תאריך תחילה');

  // SIGNAL proposals must have no target / callData (mirrors on-chain constraint)
  const isSignal = type === 'signal';
  const resolvedTarget   = isSignal ? '0x0000000000000000000000000000000000000000'
                                    : ((target as string | undefined)?.trim() || '0x0000000000000000000000000000000000000000');
  const resolvedCallData = isSignal ? '0x'
                                    : ((callData as string | undefined)?.trim() || '0x');

  // ── Get proposer wallet address from Firestore (never trust client) ──
  const talmidDoc = await adminDb.collection('chaverim').doc(ctx.chaverId).get();
  const proposer  = (talmidDoc.data()?.walletAddress as string | undefined)
    ?? clientProposer
    ?? '0x0000000000000000000000000000000000000000';

  // ── Submit on-chain first (C3) ─────────────────────────────────
  // The backend deployer wallet (PROPOSER_ROLE) calls ChayoleiGovernance.propose()
  // so the proposal is anchored on-chain before being stored in Firestore.
  // This ensures the on-chain proposalId is always present in the Firestore doc.
  let onChainProposalId: bigint;
  try {
    onChainProposalId = await submitProposalOnChain({
      proposalType:  PROPOSAL_TYPE_CHAIN_INDEX[type as ProposalType],
      title:         title.trim(),
      description:   description.trim(),
      target:        resolvedTarget,
      callData:      resolvedCallData,
      quorumOverride: Number(quorumRequired) || 0,
    });
  } catch (e) {
    console.error('[governance/proposals] on-chain propose() failed:', e);
    throw error(503, 'שגיאה בהגשת ההצעה לרשת — נסה שנית');
  }

  // ── Write to Firestore with on-chain ID ────────────────────────
  const now = new Date().toISOString();
  const ref = adminDb.collection('proposals').doc();

  const proposalData = {
    proposer,
    type,
    title:              title.trim(),
    description:        description.trim(),
    target:             resolvedTarget,
    callData:           resolvedCallData,
    quorumRequired:     Number(quorumRequired)    || 10_000,
    totalVotingTokens:  Number(totalVotingTokens) || 0,
    votingStartTime:    new Date(votingStartTime).toISOString(),
    votingEndTime:      new Date(votingEndTime).toISOString(),
    votesFor:           0,
    votesAgainst:       0,
    votesAbstain:       0,
    state:              'active',
    executed:           false,
    quorumReached:      false,
    snapshotBlock:      0,
    onChainProposalId:  onChainProposalId.toString(),
    createdAt:          now,
    creatorTalmidId:    ctx.chaverId,
  };

  const batch  = adminDb.batch();
  batch.set(ref, proposalData);

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(
    ctx.uid,
    (ctx.decoded.name as string | undefined) ?? 'קצין',
    'proposal_created',
    ref.id,
    title.trim(),
    'הגיש הצעה לממשל',
  ));

  await batch.commit();

  return json({ id: ref.id, ...proposalData }, { status: 201 });
};
