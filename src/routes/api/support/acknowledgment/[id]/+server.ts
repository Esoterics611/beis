import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMashpia } from '$lib/server/auth';
import { generateAcknowledgment } from '$lib/server/support-donations';

export const GET: RequestHandler = async ({ request, params }) => {
  await requireMashpia(request);
  const { id } = params;
  if (!id) throw error(400, 'מזהה תרומה נדרש');

  try {
    const result = await generateAcknowledgment(id);
    return json(result);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'donation not found') throw error(404, 'תרומה לא נמצאה');
    throw error(500, 'שגיאה בהפקת אישור');
  }
};
