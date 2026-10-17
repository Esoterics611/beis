// PATCH /api/chibburim/[id]/draft — autosave the working draft.
// Only the assignee (or a mashpia) may write; no activity entries, this is
// called on a debounce from the editor.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { requireAuth, isMashpia } from '$lib/server/auth';

const MAX_DRAFT_BYTES = 900_000; // stay under Firestore's 1MB doc limit

export const PATCH: RequestHandler = async ({ params, request }) => {
  const ctx = await requireAuth(request);
  const body = await request.json().catch(() => null);
  const { content, wordCount } = body ?? {};

  if (typeof content !== 'string') throw error(400, 'content נדרש');
  if (new TextEncoder().encode(content).length > MAX_DRAFT_BYTES) {
    throw error(413, 'הטיוטה גדולה מדי');
  }
  try {
    JSON.parse(content);
  } catch {
    throw error(400, 'content אינו JSON תקין');
  }

  const ref = adminDb.collection('chibburim').doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) throw error(404, 'חיבור לא נמצא');

  const masima = doc.data()!;
  if (masima.assigneeId !== ctx.uid && !isMashpia(ctx)) {
    throw error(403, 'רק בעל החיבור רשאי לערוך את הטיוטה');
  }
  if (!['open', 'in_progress', 'revision_requested'].includes(masima.status)) {
    throw error(400, `לא ניתן לערוך טיוטה במצב: ${masima.status}`);
  }

  await ref.update({
    draftContent:   content,
    draftWordCount: typeof wordCount === 'number' ? wordCount : null,
    draftUpdatedAt: new Date().toISOString(),
  });

  return json({ success: true });
};
