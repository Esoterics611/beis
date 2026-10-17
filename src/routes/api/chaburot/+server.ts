import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, requireMashpia, activityEntry } from '$lib/server/auth';

// GET /api/chaburot — list all
export const GET: RequestHandler = async ({ request }) => {
  await requireAuth(request);
  const snap = await adminDb.collection('chaburot').orderBy('createdAt', 'desc').get();
  return json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

// POST /api/chaburot — create
export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireMashpia(request);
  const data = await request.json();

  const now = new Date().toISOString();
  const ref = adminDb.collection('chaburot').doc();

  const batch = adminDb.batch();
  batch.set(ref, {
    ...data,
    creatorId:   ctx.uid,
    tokensUsed:  0,
    masimotCount: 0,
    enrolledIds: [ctx.uid],
    createdAt:   now,
    updatedAt:   now,
  });

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'קצין', 'mivtza_created', ref.id, data.shem, 'יצר חבורה חדשה'));

  await batch.commit();
  const doc = await ref.get();
  return json({ id: ref.id, ...doc.data() }, { status: 201 });
};
