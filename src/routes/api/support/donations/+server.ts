import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia } from '$lib/server/auth';
import { logDonation } from '$lib/server/support-donations';

// GET — public ledger (anonymized per consent)
export const GET: RequestHandler = async () => {
  const snap = await adminDb
    .collection('support_donations')
    .orderBy('createdAt', 'desc')
    .get();

  const docs = snap.docs.map(d => {
    const data = d.data();
    const consent = data.attributionConsent as boolean;
    return {
      id:          d.id,
      displayName: consent ? (data.displayName as string) : 'אנונימי',
      amount:      data.amount as number,
      currency:    data.currency as string,
      intent:      data.intent as string | null,
      tmimMinted:  data.tmimMinted as number,
      txHash:      data.txHash as string | null,
      createdAt:   data.createdAt as string,
    };
  });

  return json(docs);
};

// POST — mashpia-only, log a manually received donation
export const POST: RequestHandler = async ({ request }) => {
  await requireMashpia(request);
  const data = await request.json();

  const { donor, amount, currency, intent, channel, contactEmail, notes, attributionConsent } = data;

  if (!donor?.trim())       throw error(400, 'שם תורם נדרש');
  if (!amount || amount <= 0) throw error(400, 'סכום לא תקין');
  if (!currency)            throw error(400, 'אמצעי תשלום נדרש');

  const result = await logDonation({
    donor:              donor.trim(),
    amount:             Number(amount),
    currency:           currency as 'cash' | 'check' | 'zelle' | 'venmo' | 'usdc' | 'other',
    intent:             intent?.trim() || undefined,
    channel:            channel?.trim() || undefined,
    contactEmail:       contactEmail?.trim() || undefined,
    notes:              notes?.trim() || undefined,
    attributionConsent: Boolean(attributionConsent),
  });

  return json(result, { status: 201 });
};
