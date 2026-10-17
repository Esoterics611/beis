// POST /api/governance/attestation
// Returns an EIP-712 signed RankAttestation authorising the caller to vote
// on the given proposal with their authentic on-chain rank multiplier.
//
// The backend reads the voter's rank directly from ChayoleiRegistry
// (authoritative) — never from Firestore or client input. This is the core
// of the C1 security fix: the contract no longer trusts client-supplied rank.
//
// Input:  { proposalId: string | number }   // uint256-compatible, 0 allowed pre-C2
// Output: SignedRankAttestation (ready to submit with castVote)
//
// Errors:
//   400 — missing/invalid proposalId
//   403 — caller has no on-chain wallet, is unregistered, or has rank 0 balance
//   500 — signer env not configured

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth';
import { adminDb } from '$lib/server/firebase-admin';
import { signRankAttestation, getOnChainRank } from '$lib/server/attestation';

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const { proposalId } = body as { proposalId?: string | number };

  // ── Validate proposalId (uint256-compatible) ───────────────────
  if (proposalId === undefined || proposalId === null) {
    throw error(400, 'proposalId נדרש');
  }
  let proposalIdBig: bigint;
  try {
    proposalIdBig = BigInt(proposalId);
  } catch {
    throw error(400, 'proposalId חייב להיות מספר שלם');
  }
  if (proposalIdBig < 0n) {
    throw error(400, 'proposalId לא יכול להיות שלילי');
  }

  // ── Look up caller's wallet address from Firestore talmid doc ──
  // The Firebase auth UID → walletAddress mapping lives in talmidim/{talmidId}.
  const talmidDoc = await adminDb.collection('chaverim').doc(ctx.chaverId).get();
  if (!talmidDoc.exists) throw error(403, 'חבר לא נמצא במאגר');
  const walletAddress = talmidDoc.data()?.walletAddress as string | undefined;
  if (!walletAddress || !walletAddress.startsWith('0x')) {
    throw error(403, 'לא נמצאה כתובת חשבון מאומתת עבור המשתמש');
  }

  // ── Fetch rank from chain (NOT Firestore) ──────────────────────
  let onChainRank: number | null;
  try {
    onChainRank = await getOnChainRank(walletAddress);
  } catch (e) {
    console.error('[attestation] getOnChainRank failed', e);
    throw error(500, 'שגיאה בקריאת הדרגה מהרשת');
  }
  if (onChainRank === null) {
    throw error(403, 'כתובת החשבון אינה רשומה בחוזה הממשל');
  }

  // ── Sign and return ─────────────────────────────────────────────
  try {
    const attestation = await signRankAttestation(
      walletAddress,
      onChainRank,
      proposalIdBig,
    );
    return json(attestation);
  } catch (e) {
    console.error('[attestation] sign failed', e);
    throw error(500, 'שגיאה בחתימה על האישור');
  }
};
