import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { redeemTmimOnChain, BASESCAN_BASE_SEPOLIA } from '$lib/server/contracts';

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const { talmidId, amount } = await request.json();

  if (!amount || amount <= 0) throw error(400, 'סכום לא תקין');

  // Can only redeem own tokens (unless mashpia)
  const targetId = talmidId ?? ctx.uid;
  if (targetId !== ctx.uid && !isMashpia(ctx)) {
    throw error(403, 'אין הרשאה לפדות טוקנים של חבר אחר');
  }

  const talmidRef = adminDb.collection('chaverim').doc(targetId);
  const talmidDoc = await talmidRef.get();
  if (!talmidDoc.exists) throw error(404, 'חבר לא נמצא');

  const currentBalance = talmidDoc.data()!.tokenBalance ?? 0;
  if (currentBalance < amount) throw error(400, 'אין מספיק שכר');

  const batch = adminDb.batch();
  batch.set(talmidRef, { tokenBalance: FieldValue.increment(-amount) }, { merge: true });
  batch.set(adminDb.collection('treasury').doc('global'), {
    totalTmimRedeemed: FieldValue.increment(amount),
    tmimCirculating:   FieldValue.increment(-amount),
    currentBalance:    FieldValue.increment(-(amount * 0.10)),
  }, { merge: true });

  await batch.commit();

  // Burn on-chain and send ETH to user — non-blocking failure
  let txHash: string | null = null;
  const talmidData = talmidDoc.data()!;
  const userWallet = talmidData.walletAddress as string | undefined;
  if (userWallet) {
    try {
      txHash = await redeemTmimOnChain(userWallet, amount);
    } catch (e) {
      console.error('[contracts] redeemTmimOnChain failed:', e);
    }
  }

  const usd = (amount * 0.10).toFixed(2);
  return json({
    success: true,
    tmimRedeemed: amount,
    usdValue: usd,
    txHash,
    txUrl: txHash ? `${BASESCAN_BASE_SEPOLIA}/${txHash}` : null,
  });
};
