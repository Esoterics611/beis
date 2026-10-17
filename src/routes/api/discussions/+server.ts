import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const data = await request.json();
  const now = new Date().toISOString();

  if (!data.chibburId || !data.content?.trim()) {
    throw error(400, 'masimaId ו-content נדרשים');
  }

  // Validate masima exists
  const masimaDoc = await adminDb.collection('chibburim').doc(data.chibburId).get();
  if (!masimaDoc.exists) throw error(404, 'חיבור לא נמצא');

  const tokensEarned: number = data.parentId ? 3 : 5; // replies earn less
  const ref = adminDb.collection('discussions').doc();

  const batch = adminDb.batch();
  batch.set(ref, {
    masimaId:    data.chibburId,
    authorId:    ctx.uid,
    parentId:    data.parentId ?? null,
    content:     data.content.trim(),
    tokensEarned,
    createdAt:   now,
  });

  // Award tokens to author
  if (tokensEarned > 0) {
    const talmidRef = adminDb.collection('chaverim').doc(ctx.uid);
    const awarded = tokensEarned;
    batch.set(talmidRef, {
      tokenBalance:      FieldValue.increment(awarded),
      totalTokensEarned: FieldValue.increment(awarded),
    }, { merge: true });
    batch.set(adminDb.collection('treasury').doc('global'), {
      totalTmimDistributed: FieldValue.increment(awarded),
      tmimCirculating:      FieldValue.increment(awarded),
    }, { merge: true });
  }

  await batch.commit();
  const doc = await ref.get();
  return json({ id: ref.id, ...doc.data() }, { status: 201 });
};
