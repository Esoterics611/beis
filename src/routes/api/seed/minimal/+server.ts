// POST /api/seed/minimal — mashpia-only
// Seeds only infrastructure: mekomot + treasury/global
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia } from '$lib/server/auth';
import { MOCK_MEKOMOT, MOCK_TREASURY } from '$lib/stores/mock-data';

export const POST: RequestHandler = async ({ request }) => {
  await requireMashpia(request);

  const batch = adminDb.batch();
  for (const makom of MOCK_MEKOMOT) {
    const { id, ...data } = makom;
    batch.set(adminDb.collection('mekomot').doc(id), data, { merge: true });
  }
  await batch.commit();

  await adminDb.collection('treasury').doc('global').set(MOCK_TREASURY, { merge: true });

  return json({ ok: true, mekomot: MOCK_MEKOMOT.length, treasury: 1 });
};
