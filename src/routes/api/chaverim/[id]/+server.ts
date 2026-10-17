import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const doc = await adminDb.collection('chaverim').doc(params.id).get();
  if (!doc.exists) throw error(404, 'חבר לא נמצא');
  return json({ id: doc.id, ...doc.data() });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  // Can only update own profile, or mashpia can update anyone
  if (ctx.uid !== params.id && !isMashpia(ctx)) {
    throw error(403, 'אין הרשאה לעדכן פרופיל זה');
  }
  const data = await request.json();
  const ref = adminDb.collection('chaverim').doc(params.id);
  if (!(await ref.get()).exists) throw error(404, 'חבר לא נמצא');

  // Strip fields that shouldn't be user-editable
  const { tokenBalance, totalTokensEarned, role, contribution_score, ...safeData } = data;
  await ref.update(safeData);
  return json({ success: true });
};
