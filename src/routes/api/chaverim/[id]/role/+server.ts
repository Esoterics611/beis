// PATCH /api/chaverim/[id]/role — admin-only role assignment.
// Updates both the chaver doc and the Firebase custom claims, so authority
// changes take effect on the next token refresh.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb, adminAuth } from '$lib/server/firebase-admin';
import { requireAdmin, activityEntry, type Role } from '$lib/server/auth';

const VALID_ROLES: Role[] = ['chaver', 'mashpia', 'admin'];

export const PATCH: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAdmin(request);
  const { role } = await request.json().catch(() => ({}));
  if (!VALID_ROLES.includes(role)) throw error(400, 'תפקיד לא תקין');

  const ref = adminDb.collection('chaverim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חבר לא נמצא');

  const batch = adminDb.batch();
  batch.update(ref, { role });
  const actRef = adminDb.collection('activities').doc();
  batch.set(actRef, activityEntry(ctx.uid, ctx.decoded.name ?? 'מנהל', 'role_changed', params.id, doc.data()!.shem, `תפקיד עודכן ל-${role}`));
  await batch.commit();

  try {
    const user = await adminAuth.getUser(params.id);
    await adminAuth.setCustomUserClaims(params.id, {
      ...(user.customClaims ?? {}),
      role,
    });
  } catch {
    // Auth user may not exist for seeded chaverim — Firestore role still applies via doc fallback
  }

  return json({ success: true, role });
};
