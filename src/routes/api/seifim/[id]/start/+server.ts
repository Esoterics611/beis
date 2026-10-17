import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async ({ params, request }) => {
  await requireAuth(request);
  const ref = adminDb.collection('seifim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'שלב לא נמצא');
  const tafkid = doc.data()!;
  if (tafkid.status !== 'todo') throw error(400, `לא ניתן להתחיל שלב במצב: ${tafkid.status}`);
  await ref.update({ status: 'in_progress' });
  return json({ success: true });
};
