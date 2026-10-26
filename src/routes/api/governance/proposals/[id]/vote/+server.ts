import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';
import { findVoteCastInTx } from '$lib/server/governance-chain';
import { recordVoteCast, SUPPORT_NAMES } from '$lib/server/governance-votes';

// POST /api/governance/proposals/[id]/vote   { txHash }
//
// Votes are cast on-chain: the frontend sends BeisGovernance.castVote()
// from the chaver's wallet, then posts the transaction hash here. This
// endpoint only records what the chain confirmed: it reads the VoteCast
// event from the receipt, checks it belongs to this proposal and this
// chaver's wallet, and records it through recordVoteCast, the same
// exactly-once path the chain listener uses. Weight comes from the event
// (on-chain balance × attested rank), so Firestore tallies match the chain.
export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const { txHash } = await request.json();

  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw error(400, 'נדרש מזהה עסקה (txHash) של ההצבעה ברשת');
  }

  const proposalRef = adminDb.collection('proposals').doc(params.id);
  const proposalDoc = await proposalRef.get();
  if (!proposalDoc.exists) throw error(404, 'הצעה לא נמצאה');
  const onChainProposalId = proposalDoc.get('onChainProposalId') as string | undefined;
  if (!onChainProposalId) throw error(400, 'ההצעה לא נרשמה ברשת');

  const chaverDoc = await adminDb.collection('chaverim').doc(ctx.chaverId).get();
  if (!chaverDoc.exists) throw error(403, 'חבר לא נמצא');
  const walletAddress = chaverDoc.get('walletAddress') as string | undefined;
  if (!walletAddress?.startsWith('0x')) throw error(403, 'לא נמצאה כתובת חשבון מאומתת');

  let ev;
  try {
    ev = await findVoteCastInTx(txHash);
  } catch (e) {
    // Not confirmed yet, or the RPC is slow. The chain listener records the
    // vote once it confirms, so the client can treat this as pending.
    console.error('[vote] waiting for tx failed', e);
    throw error(504, 'ההצבעה טרם אושרה ברשת; היא תירשם כשתאושר');
  }
  if (!ev)                                                        throw error(400, 'העסקה אינה מכילה הצבעה');
  if (ev.proposalId.toString() !== onChainProposalId)             throw error(400, 'העסקה שייכת להצעה אחרת');
  if (ev.voter.toLowerCase() !== walletAddress.toLowerCase())     throw error(403, 'ההצבעה נשלחה מחשבון אחר');

  await recordVoteCast(ev, ctx.chaverId);

  const updated = await proposalRef.get();
  return json({ id: params.id, ...updated.data(), myVote: SUPPORT_NAMES[ev.support] ?? 'abstain' });
};
