import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

// POST — submit a contribution application
export const POST: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const statement: string = (body.statement ?? '').trim();

  if (!statement) throw error(400, 'הצהרה נדרשת');

  const words = statement.split(/\s+/).filter(Boolean).length;
  if (words > 300) throw error(400, `הצהרה ארוכה מדי (${words} מילים — המקסימום הוא 300)`);

  const mivtzaRef = adminDb.collection('chaburot').doc(params.id);
  const mivtzaDoc = await mivtzaRef.get();
  if (!mivtzaDoc.exists) throw error(404, 'חבורה לא נמצאה');

  // Check no duplicate pending application
  const existing = await adminDb
    .collection('mivtza_applications')
    .where('chaburahId', '==', params.id)
    .where('applicantId', '==', ctx.uid)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!existing.empty) throw error(409, 'כבר קיימת בקשה ממתינה עבור חבורה זה');

  const now = new Date().toISOString();
  const appRef = adminDb.collection('mivtza_applications').doc();
  await appRef.set({
    id: appRef.id,
    mivtzaId: params.id,
    applicantId: ctx.uid,
    statement,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return json({ id: appRef.id, status: 'pending' }, { status: 201 });
};

// GET — list applications for this mivtza (mashpia-only)
export const GET: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  if (!isMashpia(ctx)) throw error(403, 'נדרשת הרשאת מנחה');

  const snap = await adminDb
    .collection('mivtza_applications')
    .where('chaburahId', '==', params.id)
    .orderBy('createdAt', 'desc')
    .get();

  return json(snap.docs.map(d => d.data()));
};

// PATCH — approve or reject an application (mashpia-only)
export const PATCH: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  if (!isMashpia(ctx)) throw error(403, 'נדרשת הרשאת מנחה');

  const body = await request.json().catch(() => ({}));
  const applicationId: string = body.applicationId;
  const status: 'approved' | 'rejected' = body.status;
  const reviewNote: string = (body.reviewNote ?? '').trim();

  if (!applicationId) throw error(400, 'applicationId נדרש');
  if (status !== 'approved' && status !== 'rejected') throw error(400, 'status חייב להיות approved או rejected');

  const appRef = adminDb.collection('mivtza_applications').doc(applicationId);
  const appDoc = await appRef.get();
  if (!appDoc.exists) throw error(404, 'בקשה לא נמצאה');
  const appData = appDoc.data()!;
  if (appData.chaburahId !== params.id) throw error(403, 'בקשה לא שייכת לחבורה זו');

  const batch = adminDb.batch();
  batch.update(appRef, {
    status,
    reviewedBy: ctx.uid,
    reviewNote: reviewNote || FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });

  // Auto-enroll on approval
  if (status === 'approved') {
    const mivtzaRef = adminDb.collection('chaburot').doc(params.id);
    batch.update(mivtzaRef, {
      enrolledIds: FieldValue.arrayUnion(appData.applicantId),
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
  return json({ success: true, status });
};
