import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
  await requireAuth(request);
  const snap = await adminDb.collection('chibburim').orderBy('createdAt', 'desc').get();
  return json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const data = await request.json();
  const now = new Date().toISOString();

  const ref = adminDb.collection('chibburim').doc();
  const batch = adminDb.batch();

  batch.set(ref, {
    ...data,
    seifimCount:   0,
    reviewCount:   0,
    averageRating: null,
    createdAt:     now,
    updatedAt:     now,
  });

  // Increment parent chaburah chibburimCount
  if (data.chaburahId) {
    const chaburahRef = adminDb.collection('chaburot').doc(data.chaburahId);
    const chaburahSnap = await chaburahRef.get();
    const curCount = (chaburahSnap.data()?.chibburimCount as number | undefined) ?? 0;
    batch.update(chaburahRef, { chibburimCount: curCount + 1, updatedAt: now });
  }

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'חבר', 'chibbur_opened', ref.id, data.shem, 'פתח חיבור חדש'));

  await batch.commit();
  const doc = await ref.get();
  return json({ id: ref.id, ...doc.data() }, { status: 201 });
};
