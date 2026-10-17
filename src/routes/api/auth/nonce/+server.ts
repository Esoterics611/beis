import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { randomBytes } from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const walletAddress = body?.walletAddress?.toLowerCase();

  if (!walletAddress || !/^0x[0-9a-f]{40}$/.test(walletAddress)) {
    throw error(400, 'כתובת חשבון לא תקינה');
  }

  const nonce = `Beis — אמת: ${randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  await adminDb.collection('nonces').doc(walletAddress).set({
    nonce,
    createdAt: new Date().toISOString(),
    expiresAt,
  });

  return json({ nonce });
};
