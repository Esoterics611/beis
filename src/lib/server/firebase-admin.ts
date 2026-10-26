import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';

// Credentials are read at runtime, so the app builds without secrets.
// With FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY set, the admin SDK uses
// that service-account key. Without them it uses Application Default
// Credentials: the runtime service account on Cloud Run, or none against the
// Firestore/Auth emulators (FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST).
function getAdminApp() {
  if (getApps().length === 0) {
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (env.FIREBASE_CLIENT_EMAIL && privateKey) {
      initializeApp({
        credential: cert({
          projectId:   env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    } else {
      initializeApp({ projectId: env.FIREBASE_PROJECT_ID || undefined });
    }
  }
  return getApps()[0];
}

export function getAdminAuth(): Auth {
  getAdminApp();
  return getAuth();
}

export function getAdminDb(): Firestore {
  getAdminApp();
  return getFirestore();
}

// Convenience aliases
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getAdminAuth() as any)[prop];
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getAdminDb() as any)[prop];
  },
});
