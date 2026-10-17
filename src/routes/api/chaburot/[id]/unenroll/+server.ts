import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const talmidId = (isMashpia(ctx) && body.talmidId) ? body.talmidId : ctx.uid;

  const ref = adminDb.collection('chaburot').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חבורה לא נמצאה');

  await ref.update({ enrolledIds: FieldValue.arrayRemove(talmidId), updatedAt: new Date().toISOString() });
  return json({ success: true });
};
