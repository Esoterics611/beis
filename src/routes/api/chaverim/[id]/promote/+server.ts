import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia, activityEntry } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

const PROMOTE_SCORE_INCREMENT = 5000;

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireMashpia(request);
  const ref = adminDb.collection('chaverim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חבר לא נמצא');

  const talmid = doc.data()!;

  const batch = adminDb.batch();
  batch.update(ref, {
    contribution_score: FieldValue.increment(PROMOTE_SCORE_INCREMENT),
  });

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'מנהיג', 'chaver_promoted', params.id, talmid.shem, `הוסיף ${PROMOTE_SCORE_INCREMENT} ניקוד תרומה`));

  await batch.commit();

  return json({ success: true, scoreAdded: PROMOTE_SCORE_INCREMENT });
};
