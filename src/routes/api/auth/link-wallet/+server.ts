// POST /api/auth/link-wallet — attach a verified wallet to the signed-in
// chaver. The wallet is an optional linked credential, never an identity:
// same nonce/signature verification as the legacy wallet sign-in, but the
// resulting address is stored on the existing chaver doc.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';
import { verifyMessage } from 'ethers';

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => null);
  const { walletAddress, signature } = body ?? {};

  if (!walletAddress || !signature) {
    throw error(400, 'walletAddress ו-signature נדרשים');
  }
  const addr = walletAddress.toLowerCase();

  const nonceDoc = await adminDb.collection('nonces').doc(addr).get();
  if (!nonceDoc.exists) throw error(401, 'Nonce לא נמצא');

  const { nonce, expiresAt } = nonceDoc.data()!;
  if (new Date() > new Date(expiresAt)) {
    await adminDb.collection('nonces').doc(addr).delete();
    throw error(401, 'Nonce פג תוקף');
  }

  let recovered: string;
  try {
    recovered = verifyMessage(nonce, signature).toLowerCase();
  } catch {
    throw error(401, 'חתימה לא תקינה');
  }
  if (recovered !== addr) throw error(401, 'חתימה לא תואמת');

  await adminDb.collection('nonces').doc(addr).delete();

  // A wallet may back exactly one chaver
  const taken = await adminDb.collection('chaverim')
    .where('walletAddress', '==', addr)
    .limit(1)
    .get();
  if (!taken.empty && taken.docs[0].id !== ctx.chaverId) {
    throw error(409, 'הארנק כבר מקושר לחבר אחר');
  }

  const ref = adminDb.collection('chaverim').doc(ctx.chaverId);
  if (!(await ref.get()).exists) throw error(404, 'חבר לא נמצא');
  await ref.update({ walletAddress: addr });

  return json({ success: true, walletAddress: addr });
};
