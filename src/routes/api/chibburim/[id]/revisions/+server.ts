// GET /api/chibburim/[id]/revisions — list draft snapshots, newest first.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, request, url }) => {
  await requireAuth(request);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  const ref = adminDb.collection('chibburim').doc(params.id);
  if (!(await ref.get()).exists) throw error(404, 'חיבור לא נמצא');

  const snap = await ref.collection('revisions')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};
