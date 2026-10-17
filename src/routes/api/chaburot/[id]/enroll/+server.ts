import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia, activityEntry } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  // Allow enrolling another user if mashpia; otherwise enroll self
  const talmidId = (isMashpia(ctx) && body.talmidId) ? body.talmidId : ctx.uid;

  const ref = adminDb.collection('chaburot').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חבורה לא נמצאה');

  const mivtza = doc.data()!;
  if ((mivtza.enrolledIds as string[]).includes(talmidId)) {
    throw error(400, 'כבר רשום לחבורה זו');
  }

  const batch = adminDb.batch();
  batch.update(ref, { enrolledIds: FieldValue.arrayUnion(talmidId), updatedAt: new Date().toISOString() });

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(talmidId, ctx.decoded.name ?? 'חייל', 'talmid_enrolled', params.id, mivtza.shem, 'הצטרף לחבורה'));

  await batch.commit();
  return json({ success: true });
};
