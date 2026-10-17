import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
  await requireAuth(request);
  const snap = await adminDb.collection('chaverim').get();
  return json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const data = await request.json();
  const now = new Date().toISOString();

  // Use Firebase UID as document ID (wallet_0x...)
  const ref = adminDb.collection('chaverim').doc(ctx.uid);

  // Check if already exists
  const existing = await ref.get();
  if (existing.exists) {
    return json({ id: ref.id, ...existing.data() });
  }

  const talmidData = {
    ...data,
    role: 'chaver',
    nirashemAt: now,
    isOnline: true,
  };

  const batch = adminDb.batch();
  batch.set(ref, talmidData);

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, data.shem, 'chaver_enrolled', ctx.uid, data.shem, 'חבר חדש הצטרף'));

  await batch.commit();
  return json({ id: ref.id, ...talmidData }, { status: 201 });
};
