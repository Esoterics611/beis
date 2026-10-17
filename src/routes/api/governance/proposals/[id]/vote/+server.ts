import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getOnChainRank } from '$lib/server/attestation';
import { contributionVotingWeight } from '$lib/types';

const VALID_VOTES = new Set(['for', 'against', 'abstain']);

// POST /api/governance/proposals/[id]/vote
//
// C2: voting power is computed using the rank read from ChayoleiRegistry
// on-chain (authoritative). The frontend now submits the vote to the
// governance contract via MetaMask before calling this endpoint;
// txHash records the on-chain confirmation. Attestation is stored for audit.
export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const { vote, attestation, txHash } = await request.json();

  if (!vote || !VALID_VOTES.has(vote)) throw error(400, 'הצבעה חייבת להיות: for, against, או abstain');

  const proposalRef = adminDb.collection('proposals').doc(params.id);
  const voteRef     = proposalRef.collection('votes').doc(ctx.chaverId);

  // ── Load proposal ─────────────────────────────────────────────
  const proposalDoc = await proposalRef.get();
  if (!proposalDoc.exists) throw error(404, 'הצעה לא נמצאה');
  const proposal = proposalDoc.data()!;

  if (proposal.state !== 'active')                        throw error(400, 'ההצבעה נסגרה');
  if (new Date(proposal.votingEndTime) < new Date())      throw error(400, 'זמן ההצבעה הסתיים');
  if (new Date(proposal.votingStartTime) > new Date())    throw error(400, 'ההצבעה טרם נפתחה');

  // ── Prevent double voting ─────────────────────────────────────
  const existingVote = await voteRef.get();
  if (existingVote.exists) throw error(409, 'כבר הצבעת בהצעה זו');

  // ── Compute voting power using on-chain rank ──────────────────
  const talmidDoc = await adminDb.collection('chaverim').doc(ctx.chaverId).get();
  if (!talmidDoc.exists) throw error(403, 'חבר לא נמצא');
  const talmid = talmidDoc.data()!;
  const walletAddress     = talmid.walletAddress as string | undefined;
  const balance           = (talmid.tokenBalance as number) ?? 0;
  const contributionScore = (talmid.contribution_score as number) ?? 0;

  if (!walletAddress?.startsWith('0x')) {
    throw error(403, 'לא נמצאה כתובת חשבון מאומתת');
  }

  let rankIndex: number | null = null;
  try {
    rankIndex = await getOnChainRank(walletAddress);
  } catch (e) {
    console.error('[vote] on-chain rank lookup failed', e);
    throw error(502, 'שגיאה בקריאת הדרגה מהרשת');
  }
  if (rankIndex === null) throw error(403, 'כתובת החשבון אינה רשומה');

  const scoreWeight = contributionVotingWeight(contributionScore);
  const power       = balance * scoreWeight;

  if (power <= 0) throw error(403, 'אין כוח הצבעה (יתרת שכר אפס)');

  // ── Write ──────────────────────────────────────────────────────
  const now   = new Date().toISOString();
  const batch = adminDb.batch();

  batch.set(voteRef, {
    vote,
    power,
    contributionScore,
    scoreWeight,
    talmidId: ctx.chaverId,
    walletAddress,
    timestamp: now,
    attestation: attestation ?? null,
    txHash: txHash ?? null,
  });

  const increment: Record<string, unknown> = {};
  if (vote === 'for')     increment.votesFor     = FieldValue.increment(power);
  if (vote === 'against') increment.votesAgainst = FieldValue.increment(power);
  if (vote === 'abstain') increment.votesAbstain = FieldValue.increment(power);

  const totalAfter =
    (proposal.votesFor     ?? 0) +
    (proposal.votesAgainst ?? 0) +
    (proposal.votesAbstain ?? 0) +
    power;
  if (totalAfter >= (proposal.quorumRequired ?? 0)) {
    increment.quorumReached = true;
  }

  batch.update(proposalRef, increment);
  await batch.commit();

  const updated = await proposalRef.get();
  return json({ id: params.id, ...updated.data(), myVote: vote });
};
