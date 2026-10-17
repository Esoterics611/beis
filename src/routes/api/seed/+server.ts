// ═══════════════════════════════════════════════════════════════
// POST /api/seed  — mashpia-only Firestore seeder
// Populates: mekomot, treasury/global, chaburot, chibburim, seifim
// ═══════════════════════════════════════════════════════════════
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireMashpia } from '$lib/server/auth';
import {
  MOCK_MEKOMOT,
  MOCK_CHABUROT,
  MOCK_CHIBBURIM,
  MOCK_SEIFIM,
  MOCK_TREASURY,
} from '$lib/stores/mock-data';

export const POST: RequestHandler = async ({ request }) => {
  await requireMashpia(request);

  const results: Record<string, number> = {};

  // ── mekomot ────────────────────────────────────────────────────
  {
    const batch = adminDb.batch();
    for (const makom of MOCK_MEKOMOT) {
      const { id, ...data } = makom;
      batch.set(adminDb.collection('mekomot').doc(id), data, { merge: true });
    }
    await batch.commit();
    results.mekomot = MOCK_MEKOMOT.length;
  }

  // ── treasury/global ────────────────────────────────────────────
  {
    await adminDb
      .collection('treasury')
      .doc('global')
      .set(MOCK_TREASURY, { merge: true });
    results.treasury = 1;
  }

  // ── chaburot ───────────────────────────────────────────────────
  {
    const batch = adminDb.batch();
    for (const ch of MOCK_CHABUROT) {
      const { id, ...data } = ch;
      batch.set(adminDb.collection('chaburot').doc(id), data, { merge: true });
    }
    await batch.commit();
    results.chaburot = MOCK_CHABUROT.length;
  }

  // ── chibburim ──────────────────────────────────────────────────
  {
    // Firestore batches are limited to 500 writes; chunk if needed
    const chunks = chunkArray(MOCK_CHIBBURIM, 400);
    let count = 0;
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const ch of chunk) {
        const { id, ...data } = ch;
        batch.set(adminDb.collection('chibburim').doc(id), data, { merge: true });
      }
      await batch.commit();
      count += chunk.length;
    }
    results.chibburim = count;
  }

  // ── seifim ─────────────────────────────────────────────────────
  {
    const chunks = chunkArray(MOCK_SEIFIM, 400);
    let count = 0;
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const sf of chunk) {
        const { id, ...data } = sf;
        batch.set(adminDb.collection('seifim').doc(id), data, { merge: true });
      }
      await batch.commit();
      count += chunk.length;
    }
    results.seifim = count;
  }

  return json({ ok: true, seeded: results });
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
