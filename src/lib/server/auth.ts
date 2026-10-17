// Server-side auth helpers for API routes
import { error } from '@sveltejs/kit';
import { adminAuth } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

// Administrative authority is a role, never a contribution score.
// Score drives governance weight only (contributionVotingWeight in $lib/types).
export type Role = 'chaver' | 'mashpia' | 'admin';

export interface AuthContext {
  decoded: DecodedIdToken;
  uid: string;
  role: Role;
  makomId: string;
  chaverId: string;
}

/**
 * Verify Firebase ID token from Authorization header.
 * Throws 401 if missing/invalid, else returns decoded claims.
 */
export async function requireAuth(request: Request): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) throw error(401, 'נדרש אימות');

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw error(401, 'טוקן לא תקין');
  }

  return {
    decoded,
    uid:      decoded.uid,
    role:     (decoded.role as Role) ?? 'chaver',
    makomId:  (decoded.makomId as string) ?? '',
    chaverId: (decoded.chaverId as string) ?? decoded.uid,
  };
}

export function isMashpia(ctx: AuthContext): boolean {
  return ctx.role === 'mashpia' || ctx.role === 'admin';
}

export async function requireMashpia(request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(request);
  if (!isMashpia(ctx)) throw error(403, 'נדרשת הרשאת משפיע');
  return ctx;
}

export async function requireAdmin(request: Request): Promise<AuthContext> {
  const ctx = await requireAuth(request);
  if (ctx.role !== 'admin') throw error(403, 'נדרשת הרשאת מנהל');
  return ctx;
}

/**
 * Log an activity entry via batch write.
 */
export function activityEntry(
  actorId: string,
  actorShem: string,
  type: string,
  targetId: string,
  targetTitle: string,
  description: string,
) {
  return {
    type,
    actorId,
    actorShem,
    targetId,
    targetTitle,
    description,
    timestamp: new Date().toISOString(),
    metadata: {},
  };
}
