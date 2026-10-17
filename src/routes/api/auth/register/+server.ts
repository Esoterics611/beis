// POST /api/auth/register — idempotent post-sign-in registration.
// Works for any signed-in Firebase user (email/Google, or wallet custom token).
// Creates the chaver doc if missing and stamps role/chaverId/makomId custom
// claims so subsequent ID tokens carry them. Pass { probe: true } to check
// registration status without creating a doc (claims still stamped when the
// doc exists).
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb, adminAuth } from '$lib/server/firebase-admin';
import { requireAuth, activityEntry, type Role } from '$lib/server/auth';
import { env } from '$env/dynamic/private';

function adminEmails(): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export const POST: RequestHandler = async ({ request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => ({}));

  const ref = adminDb.collection('chaverim').doc(ctx.uid);
  const existing = await ref.get();

  if (!existing.exists && body.probe) {
    return json({ chaver: null, isNewUser: true });
  }

  const email = (ctx.decoded.email ?? '').toLowerCase();
  const role: Role = existing.exists
    ? ((existing.data()!.role as Role) ?? 'chaver')
    : email && adminEmails().includes(email) ? 'admin' : 'chaver';

  let chaver: Record<string, unknown>;
  if (existing.exists) {
    chaver = { id: ref.id, ...existing.data() };
  } else {
    const now = new Date().toISOString();
    const data = {
      shem: body.shem || ctx.decoded.name || (email ? email.split('@')[0] : 'חבר'),
      email: email || null,
      walletAddress: body.walletAddress?.toLowerCase() ?? null,
      makomId: body.makomId ?? '',
      track: body.track ?? 'תמים',
      role,
      contribution_score: 0,
      tokenBalance: 50,
      totalTokensEarned: 50,
      peerReviewsGiven: 0,
      peerReviewsReceived: 0,
      papersPublished: 0,
      votingPower: 0,
      seifimCompleted: 0,
      chavrusaId: null,
      shiurGroupId: null,
      zalId: null,
      avatarUrl: null,
      nirashemAt: now,
      isOnline: true,
    };
    const batch = adminDb.batch();
    batch.set(ref, data);
    const actRef = adminDb.collection('activities').doc();
    batch.set(actRef, activityEntry(ctx.uid, data.shem, 'chaver_enrolled', ctx.uid, data.shem, 'חבר חדש הצטרף'));
    await batch.commit();
    chaver = { id: ref.id, ...data };
  }

  await adminAuth.setCustomUserClaims(ctx.uid, {
    role,
    chaverId: ref.id,
    makomId: (chaver.makomId as string) ?? '',
  });

  return json({ chaver, isNewUser: !existing.exists });
};
