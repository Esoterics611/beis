import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const ref = adminDb.collection('chibburim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חיבור לא נמצא');

  const masima = doc.data()!;
  if (!['in_progress', 'revision_requested'].includes(masima.status)) {
    throw error(400, `לא ניתן להגיש חיבור במצב: ${masima.status}`);
  }

  const batch = adminDb.batch();
  const now = new Date().toISOString();
  batch.update(ref, { status: 'submitted', contentUrl: body.contentUrl ?? masima.contentUrl ?? null, updatedAt: now });

  // Freeze the working draft as a revision snapshot
  if (masima.draftContent) {
    const revRef = ref.collection('revisions').doc();
    batch.set(revRef, {
      content:   masima.draftContent,
      wordCount: masima.draftWordCount ?? 0,
      createdAt: now,
      createdBy: ctx.uid,
      kind:      'submit',
    });
  }

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'חבר', 'masima_completed', params.id, masima.shem, 'הגיש חיבור'));

  await batch.commit();
  return json({ success: true });
};
