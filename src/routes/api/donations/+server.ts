import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry } from '$lib/server/auth';
import { FieldValue } from 'firebase-admin/firestore';

export const GET: RequestHandler = async ({ request }) => {
  await requireAuth(request);
  const snap = await adminDb.collection('donations').orderBy('createdAt', 'desc').get();
  return json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const data = await request.json();
  if (!data.amount || data.amount <= 0) throw error(400, 'סכום לא תקין');

  const now = new Date().toISOString();
  const tmimMinted = Math.floor(data.amount * 10); // 1 USD = 10 שכר
  const ref = adminDb.collection('donations').doc();

  const batch = adminDb.batch();
  batch.set(ref, {
    donorName:   data.donorName ?? 'אנונימי',
    donorWallet: data.donorWallet ?? null,
    amount:      data.amount,
    tmimMinted,
    makomId:     data.makomId ?? null,
    mivtzaId:    data.chaburahId ?? null,
    message:     data.message ?? null,
    createdAt:   now,
  });

  // Update treasury
  batch.set(adminDb.collection('treasury').doc('global'), {
    totalDonated:    FieldValue.increment(data.amount),
    totalTmimMinted: FieldValue.increment(tmimMinted),
    tmimCirculating: FieldValue.increment(tmimMinted),
    currentBalance:  FieldValue.increment(data.amount),
  }, { merge: true });

  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, data.donorName ?? 'תורם', 'donation_received', ref.id, `תרומה $${data.amount}`, 'קיבלנו תרומה'));

  await batch.commit();
  return json({ id: ref.id, tmimMinted }, { status: 201 });
};
