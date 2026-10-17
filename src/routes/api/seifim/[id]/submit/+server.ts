import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const ref = adminDb.collection('seifim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'שלב לא נמצא');
  const tafkid = doc.data()!;
  if (tafkid.status !== 'in_progress') throw error(400, `לא ניתן להגיש שלב במצב: ${tafkid.status}`);

  const batch = adminDb.batch();
  batch.update(ref, { status: 'submitted', submissionNotes: body.notes ?? tafkid.submissionNotes ?? null });

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'חייל', 'tafkid_submitted', params.id, tafkid.shem, 'הגיש שלב'));

  await batch.commit();
  return json({ success: true });
};
