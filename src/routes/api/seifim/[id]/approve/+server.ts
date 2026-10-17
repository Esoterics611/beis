import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { mintTafkidReward, BASESCAN_BASE_SEPOLIA } from '$lib/server/contracts';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const ref = adminDb.collection('seifim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'שלב לא נמצא');
  const tafkid = doc.data()!;
  if (tafkid.status !== 'submitted') throw error(400, `לא ניתן לאשר שלב במצב: ${tafkid.status}`);

  const batch = adminDb.batch();
  batch.update(ref, { status: 'approved' });

  // Award tokens to assignee
  let assigneeWallet: string | undefined;
  let awarded = 0;

  if (tafkid.assigneeId) {
    const talmidRef = adminDb.collection('chaverim').doc(tafkid.assigneeId);
    const talmidDoc = await talmidRef.get();
    const talmidData = talmidDoc.data();
    awarded = tafkid.tokenReward ?? 0;
    assigneeWallet = talmidData?.walletAddress as string | undefined;

    if (awarded > 0) {
      batch.set(talmidRef, {
        tokenBalance:        FieldValue.increment(awarded),
        totalTokensEarned:   FieldValue.increment(awarded),
        seifimCompleted:   FieldValue.increment(1),
      }, { merge: true });
      batch.set(adminDb.collection('treasury').doc('global'), {
        totalTmimDistributed: FieldValue.increment(awarded),
        tmimCirculating:      FieldValue.increment(awarded),
      }, { merge: true });
      const tmimAct = adminDb.collection('activities').doc();
      batch.set(tmimAct, activityEntry(ctx.uid, ctx.decoded.name ?? 'קצין', 'tmim_distributed', params.id, tafkid.shem, `חולקו ${awarded} שכר`));
    }
  }

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'קצין', 'tafkid_completed', params.id, tafkid.shem, 'אישר שלב'));

  await batch.commit();

  // Mint on-chain — non-blocking failure
  let txHash: string | null = null;
  if (assigneeWallet && awarded > 0) {
    try {
      txHash = await mintTafkidReward(params.id, assigneeWallet, awarded);
    } catch (e) {
      console.error('[contracts] mintTafkidReward failed:', e);
    }
  }

  return json({
    success: true,
    txHash,
    txUrl: txHash ? `${BASESCAN_BASE_SEPOLIA}/${txHash}` : null,
  });
};
