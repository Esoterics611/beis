import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const doc = await adminDb.collection('chibburim').doc(params.id).get();
  if (!doc.exists) throw error(404, 'חיבור לא נמצא');
  return json({ id: doc.id, ...doc.data() });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const data = await request.json();
  const ref = adminDb.collection('chibburim').doc(params.id);
  if (!(await ref.get()).exists) throw error(404, 'חיבור לא נמצא');
  await ref.update({ ...data, updatedAt: new Date().toISOString() });
  return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const ref = adminDb.collection('chibburim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חיבור לא נמצא');

  const batch = adminDb.batch();
  const chibburId = params.id;

  const [seifim, reviews, discussions] = await Promise.all([
    adminDb.collection('seifim').where('chibburId', '==', chibburId).get(),
    adminDb.collection('peerReviews').where('chibburId', '==', chibburId).get(),
    adminDb.collection('discussions').where('chibburId', '==', chibburId).get(),
  ]);
  seifim.docs.forEach(d => batch.delete(d.ref));
  reviews.docs.forEach(d => batch.delete(d.ref));
  discussions.docs.forEach(d => batch.delete(d.ref));
  batch.delete(ref);

  await batch.commit();
  return json({ success: true });
};
