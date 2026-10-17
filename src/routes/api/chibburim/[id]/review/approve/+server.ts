import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia, activityEntry } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { mintMasimaReward, BASESCAN_BASE_SEPOLIA } from '$lib/server/contracts';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireMashpia(request);
  const masimaRef = adminDb.collection('chibburim').doc(params.id);
  const masimaDoc = await masimaRef.get();
  if (!masimaDoc.exists) throw error(404, 'חיבור לא נמצא');

  const masima = masimaDoc.data()!;
  if (masima.status !== 'in_review') throw error(400, `לא ניתן לאשר חיבור במצב: ${masima.status}`);

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  batch.update(masimaRef, { status: 'approved', updatedAt: now });

  // Award tokens to assignee with rank multiplier
  let assigneeWallet: string | undefined;
  let awarded = 0;

  if (masima.assigneeId) {
    const talmidRef = adminDb.collection('chaverim').doc(masima.assigneeId);
    const talmidDoc = await talmidRef.get();
    const talmidData = talmidDoc.data();
    awarded = masima.tokenAllocation ?? 0;
    assigneeWallet = talmidData?.walletAddress as string | undefined;

    if (awarded > 0) {
      batch.set(talmidRef, {
        tokenBalance:      FieldValue.increment(awarded),
        totalTokensEarned: FieldValue.increment(awarded),
      }, { merge: true });

      batch.set(adminDb.collection('treasury').doc('global'), {
        totalTmimDistributed: FieldValue.increment(awarded),
        tmimCirculating:      FieldValue.increment(awarded),
      }, { merge: true });

      const tmimAct = adminDb.collection('activities').doc();
      batch.set(tmimAct, activityEntry(ctx.uid, ctx.decoded.name ?? 'קצין', 'tmim_distributed', params.id, masima.shem, `חולקו ${awarded} שכר`));
    }
  }

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'קצין', 'masima_completed', params.id, masima.shem, 'אישר חיבור'));

  await batch.commit();

  // Mint on-chain — non-blocking failure (Firestore is source of truth)
  let txHash: string | null = null;
  if (assigneeWallet && awarded > 0) {
    try {
      txHash = await mintMasimaReward(params.id, assigneeWallet, awarded);
    } catch (e) {
      console.error('[contracts] mintMasimaReward failed:', e);
    }
  }

  return json({
    success: true,
    txHash,
    txUrl: txHash ? `${BASESCAN_BASE_SEPOLIA}/${txHash}` : null,
  });
};
