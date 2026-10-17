// כלי עיצוב ופורמוט

import type { MivtzaType, MasimaType } from '$lib/types';

export function formatTmim(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M שכר`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K שכר`;
  return `${amount.toLocaleString('he-IL')} שכר`;
}

/** @deprecated use formatTmim */
export function formatHasmada(amount: number): string {
  return formatTmim(amount);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) return `לפני ${Math.floor(diffMs / 60000)} דק'`;
  if (diffHours < 24) return `לפני ${Math.floor(diffHours)} שע'`;
  if (diffDays < 7) return `לפני ${Math.floor(diffDays)} ימים`;
  if (diffDays < 365) return d.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('he-IL', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDeadline(iso: string): { text: string; urgent: boolean; overdue: boolean } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return { text: `${Math.abs(Math.floor(diffDays))} ימים באיחור`, urgent: true, overdue: true };
  if (diffDays < 3) return { text: `${Math.floor(diffDays)} ימים נותרו`, urgent: true, overdue: false };
  if (diffDays < 30) return { text: `${Math.floor(diffDays)} ימים נותרו`, urgent: false, overdue: false };
  return { text: d.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }), urgent: false, overdue: false };
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft:              'text-zinc-400 bg-zinc-400/10',
    active:             'text-yellow-400 bg-yellow-400/10',
    in_progress:        'text-amber-400 bg-amber-400/10',
    completed:          'text-emerald-400 bg-emerald-400/10',
    archived:           'text-zinc-400 bg-zinc-400/10',
    cancelled:          'text-red-400 bg-red-400/10',
    open:               'text-yellow-400 bg-yellow-400/10',
    submitted:          'text-purple-400 bg-purple-400/10',
    in_review:          'text-blue-400 bg-blue-400/10',
    revision_requested: 'text-orange-400 bg-orange-400/10',
    approved:           'text-emerald-400 bg-emerald-400/10',
    published:          'text-cyan-400 bg-cyan-400/10',
    rejected:           'text-red-400 bg-red-400/10',
    todo:               'text-zinc-400 bg-zinc-400/10',
    acknowledged:       'text-emerald-400 bg-emerald-400/10',
    pending:            'text-zinc-400 bg-zinc-400/10',
    // legacy
    to_learn:           'text-zinc-400 bg-zinc-400/10',
    studying:           'text-blue-400 bg-blue-400/10',
  };
  return map[status] ?? 'text-zinc-400 bg-zinc-400/10';
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft:              'טיוטה',
    active:             'פעיל',
    in_progress:        'בביצוע',
    completed:          'הושלם',
    archived:           'בארכיון',
    cancelled:          'בוטל',
    open:               'פתוח',
    submitted:          'הוגש',
    in_review:          'בביקורת',
    revision_requested: 'נדרש תיקון',
    approved:           'אושר',
    published:          'פורסם',
    rejected:           'נדחה',
    todo:               'לביצוע',
    acknowledged:       'נלקח בחשבון',
    pending:            'ממתין',
    // legacy
    to_learn:           'ללמוד',
    studying:           'לומד',
    forming:            'בהקמה',
    inactive:           'לא פעיל',
  };
  return labels[status] ?? status;
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    low:      'text-zinc-400',
    medium:   'text-blue-400',
    high:     'text-amber-400',
    critical: 'text-red-400',
  };
  return map[priority] ?? 'text-zinc-400';
}

export function tierColor(tier: string): string {
  const map: Record<string, string> = {
    enlisted: 'text-zinc-400',
    nco:      'text-emerald-400',
    officer:  'text-yellow-400',
    // legacy
    guest:      'text-zinc-400',
    bochur:     'text-emerald-400',
    avreich:    'text-blue-400',
    leadership: 'text-yellow-400',
  };
  return map[tier] ?? 'text-zinc-400';
}

export function formatMivtzaType(type: MivtzaType): string {
  const labels: Record<MivtzaType, string> = {
    course:      'קורס',
    research:    'מחקר',
    publication: 'פרסום',
    chaburah:    'חבורה',
  };
  return labels[type] ?? type;
}

export function formatMasimaType(type: MasimaType): string {
  const labels: Record<MasimaType, string> = {
    lecture_notes:          'סיכום שיעור',
    research_paper:         'מאמר מחקרי',
    chapter_draft:          'טיוטת פרק',
    source_analysis:        'ניתוח מקורות',
    peer_review:            'ביקורת עמיתים',
    presentation:           'מצגת',
    translation:            'תרגום',
    original_analysis:      'חידוש',
    scholarly_footnote:     'הערת שוליים',
    editing:                'עריכה',
    proofreading:           'הגהה',
    formatting_typesetting: 'עיצוב גופני',
    indexing:               'אינדקס',
    design_layout:          'עיצוב גרפי',
    source_collection:      'ליקוט מקורות',
  };
  return labels[type] ?? type;
}

export function formatPublicationFormat(fmt: string): string {
  const labels: Record<string, string> = {
    print:            'דפוס',
    ebook:            'ספר דיגיטלי',
    web_native:       'פרסום ברשת',
    source_anthology: 'אנתולוגיית מקורות',
    hybrid:           'מעורב',
  };
  return labels[fmt] ?? fmt;
}

export function formatPublicationLicense(lic: string): string {
  const labels: Record<string, string> = {
    cc_by_sa:           'CC BY-SA',
    cc_by_nc:           'CC BY-NC',
    all_rights_reserved:'כל הזכויות שמורות',
    custom:             'רישיון מותאם',
  };
  return labels[lic] ?? lic;
}

export function trackColor(track: string): string {
  const map: Record<string, string> = {
    'נגלה':    'text-emerald-400 bg-emerald-400/10',
    'חסידות': 'text-blue-400 bg-blue-400/10',
    'תמים':    'text-yellow-400 bg-yellow-400/10',
  };
  return map[track] ?? 'text-zinc-400 bg-zinc-400/10';
}

export function sederTypeColor(type: string): string {
  const map: Record<string, string> = {
    chassidus: 'text-blue-400',
    nigleh:    'text-emerald-400',
    tefila:    'text-purple-400',
    break:     'text-zinc-500',
  };
  return map[type] ?? 'text-zinc-400';
}

export function mivtzaCategoryColor(category: string): string {
  const map: Record<string, string> = {
    nigleh:    'text-emerald-400 bg-emerald-400/10',
    chassidus: 'text-blue-400 bg-blue-400/10',
    halacha:   'text-amber-400 bg-amber-400/10',
    machshava: 'text-purple-400 bg-purple-400/10',
    kabbalah:  'text-cyan-400 bg-cyan-400/10',
  };
  return map[category] ?? 'text-zinc-400 bg-zinc-400/10';
}

export function mivtzaCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    nigleh:    'נגלה',
    chassidus: 'חסידות',
    halacha:   'הלכה',
    machshava: 'מחשבה',
    kabbalah:  'קבלה',
  };
  return labels[category] ?? category;
}
