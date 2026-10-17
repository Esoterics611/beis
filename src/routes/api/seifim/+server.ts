import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
  await requireAuth(request);
  const snap = await adminDb.collection('seifim').orderBy('createdAt', 'desc').get();
  return json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const data = await request.json();
  const now = new Date().toISOString();
  const ref = adminDb.collection('seifim').doc();

  const batch = adminDb.batch();
  batch.set(ref, { ...data, createdAt: now });

  // Increment parent chibbur seifimCount
  if (data.chibburId) {
    const chibburRef = adminDb.collection('chibburim').doc(data.chibburId);
    const chibburDoc = await chibburRef.get();
    if (chibburDoc.exists) {
      batch.update(chibburRef, { seifimCount: (chibburDoc.data()?.seifimCount ?? 0) + 1, updatedAt: now });
    }
  }

  await batch.commit();
  const doc = await ref.get();
  return json({ id: ref.id, ...doc.data() }, { status: 201 });
};
