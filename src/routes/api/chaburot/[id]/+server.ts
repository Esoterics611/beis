import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia, requireMashpia } from '$lib/server/auth';

// GET /api/chaburot/:id
export const GET: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const doc = await adminDb.collection('chaburot').doc(params.id).get();
  if (!doc.exists) throw error(404, 'חבורה לא נמצאה');
  return json({ id: doc.id, ...doc.data() });
};

// PATCH /api/chaburot/:id
export const PATCH: RequestHandler = async ({ params, request }) => {
  const ctx = await requireMashpia(request);
  const data = await request.json();
  const ref = adminDb.collection('chaburot').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חבורה לא נמצאה');

  // Officers can only update their own chaburot (or admin)
  if (doc.data()!.creatorId !== ctx.uid && !isMashpia(ctx)) {
    throw error(403, 'אין הרשאה לעדכן חבורה זה');
  }

  await ref.update({ ...data, updatedAt: new Date().toISOString() });
  return json({ success: true });
};

// DELETE /api/chaburot/:id
export const DELETE: RequestHandler = async ({ params, request }) => {
  await requireMashpia(request);
  const ref = adminDb.collection('chaburot').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חבורה לא נמצאה');

  const batch = adminDb.batch();

  // Cascade: delete chibburim + their seifim/reviews/discussions
  const chibburimSnap = await adminDb.collection('chibburim').where('chaburahId', '==', params.id).get();
  for (const chibburDoc of chibburimSnap.docs) {
    const chibburId = chibburDoc.id;
    batch.delete(chibburDoc.ref);

    const [seifim, reviews, discussions] = await Promise.all([
      adminDb.collection('seifim').where('chibburId', '==', chibburId).get(),
      adminDb.collection('peerReviews').where('chibburId', '==', chibburId).get(),
      adminDb.collection('discussions').where('chibburId', '==', chibburId).get(),
    ]);
    seifim.docs.forEach(d => batch.delete(d.ref));
    reviews.docs.forEach(d => batch.delete(d.ref));
    discussions.docs.forEach(d => batch.delete(d.ref));
  }

  batch.delete(ref);
  await batch.commit();
  return json({ success: true });
};
