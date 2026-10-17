import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const ref = adminDb.collection('chibburim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חיבור לא נמצא');
  const masima = doc.data()!;
  if (masima.status !== 'in_review') throw error(400, `לא ניתן לבקש תיקון במצב: ${masima.status}`);

  await ref.update({
    status: 'revision_requested',
    submissionNotes: body.notes ?? masima.submissionNotes ?? null,
    updatedAt: new Date().toISOString(),
  });
  return json({ success: true });
};
