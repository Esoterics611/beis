import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia, activityEntry } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireMashpia(request);
  const ref = adminDb.collection('chibburim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חיבור לא נמצא');
  const masima = doc.data()!;
  if (masima.status !== 'approved') throw error(400, `לא ניתן לפרסם חיבור במצב: ${masima.status}`);

  const batch = adminDb.batch();
  const now = new Date().toISOString();
  batch.update(ref, { status: 'published', updatedAt: now });

  // Increment assignee's papersPublished
  if (masima.assigneeId) {
    const talmidRef = adminDb.collection('chaverim').doc(masima.assigneeId);
    batch.set(talmidRef, { papersPublished: FieldValue.increment(1) }, { merge: true });
  }

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'קצין', 'paper_published', params.id, masima.shem, 'פרסם חיבור'));

  await batch.commit();
  return json({ success: true });
};
