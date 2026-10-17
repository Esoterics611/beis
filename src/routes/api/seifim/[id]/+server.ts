import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const doc = await adminDb.collection('seifim').doc(params.id).get();
  if (!doc.exists) throw error(404, 'שלב לא נמצא');
  return json({ id: doc.id, ...doc.data() });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const data = await request.json();
  const ref = adminDb.collection('seifim').doc(params.id);
  if (!(await ref.get()).exists) throw error(404, 'שלב לא נמצא');
  await ref.update(data);
  return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const ref = adminDb.collection('seifim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'שלב לא נמצא');

  const batch = adminDb.batch();
  batch.delete(ref);

  if (doc.data()?.chibburId) {
    const chibburRef = adminDb.collection('chibburim').doc(doc.data()!.chibburId);
    const chibburDoc = await chibburRef.get();
    if (chibburDoc.exists) {
      batch.update(chibburRef, {
        seifimCount: Math.max(0, (chibburDoc.data()?.seifimCount ?? 1) - 1),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  await batch.commit();
  return json({ success: true });
};
