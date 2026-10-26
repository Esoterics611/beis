<script lang="ts">
  import { go, href, routeQuery } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';
  import type { MasimaType } from '$lib/types';
  import { MASIMA_TYPE_DEFAULTS } from '$lib/types';
  import { page } from '$app/stores';

  const canCreate = $derived(app.isMashpia);

  const generalTypes: MasimaType[] = ['research_paper', 'chapter_draft', 'source_analysis', 'lecture_notes', 'presentation', 'peer_review'];
  const publicationTypes: MasimaType[] = ['translation', 'original_analysis', 'scholarly_footnote', 'editing', 'proofreading', 'formatting_typesetting', 'indexing', 'design_layout', 'source_collection'];

  // ── form state ────────────────────────────────────────────────
  let shem = $state('');
  let description = $state('');
  let mivtzaId = $state(routeQuery($page.url, 'mivtzaId') ?? '');
  let type = $state<MasimaType>('research_paper');
  let assigneeId = $state('');
  let tmimReward = $state(MASIMA_TYPE_DEFAULTS['research_paper'].baseReward);
  let dueDate = $state('');
  let submitting = $state(false);
  let errors = $state<Record<string, string>>({});

  const enrolledTalmidim = $derived(mivtzaId ? app.getMivtzaEnrolled(mivtzaId) : []);
  const selectedMivtza = $derived(mivtzaId ? app.getMivtza(mivtzaId) : null);
  const isPublicationMivtza = $derived(selectedMivtza?.type === 'publication');

  function onTypeChange(t: MasimaType) {
    type = t;
    tmimReward = MASIMA_TYPE_DEFAULTS[t].baseReward;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!shem.trim()) e.shem = 'שם נדרש';
    if (!mivtzaId) e.mivtza = 'יש לבחור חבורה';
    if (tmimReward < 0) e.tokens = 'ערך חיובי נדרש';
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: Event) {
    ev.preventDefault();
    if (!validate() || submitting) return;
    submitting = true;
    try {
      const masima = await app.addMasima({
        shem: shem.trim(),
        description: description.trim(),
        chaburahId: mivtzaId,
        type,
        assigneeId: assigneeId || undefined,
        status: 'open',
        tokenAllocation: tmimReward,
        deadline: dueDate || undefined,
        contentUrl: undefined,
        submissionNotes: undefined,
        reviewerId: undefined,
      });
      go(`/chibburim/${masima.id}`);
    } finally {
      submitting = false;
    }
  }

  const inputStyle = (hasErr = false) => `
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border-color: ${hasErr ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border-primary)'};
  `;
  const inputFocus = (e: FocusEvent, hasErr = false) => {
    (e.currentTarget as HTMLElement).style.borderColor = hasErr ? 'rgba(239, 68, 68, 1)' : 'var(--color-accent-primary)';
  };
  const inputBlur = (e: FocusEvent, hasErr = false) => {
    (e.currentTarget as HTMLElement).style.borderColor = hasErr ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border-primary)';
  };
</script>

{#if !canCreate}
  <div class="rounded-xl border p-6 text-center" style="border-color: rgba(239, 68, 68, 0.3); background-color: rgba(239, 68, 68, 0.1);">
    <p class="font-medium text-red-400">נדרשת הרשאת מנחה ליצירת חיבור</p>
    <a href={href(`/chibburim`)} class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור ←</a>
  </div>
{:else}
<div class="space-y-6 max-w-2xl">
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-secondary);">
    <a href={href(`/chibburim`)} class="hover:underline" style="color: var(--color-accent-secondary);">חיבורים</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">חיבור חדש</span>
  </div>

  <div>
    <h2 class="text-xl font-semibold" style="color: var(--color-text-primary);">חיבור חדש</h2>
    <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">צור משימת מחקר, כתיבה, תרגום, עריכה, ביקורת ועוד</p>
  </div>

  <form
    class="rounded-xl border p-6 space-y-5"
    style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);"
    onsubmit={handleSubmit}>

    <!-- חבורה -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="mivtza">שייך לחבורה</label>
      <select id="mivtza" bind:value={mivtzaId}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style={inputStyle(!!errors.mivtza)}
        onfocus={(e) => inputFocus(e, !!errors.mivtza)}
        onblur={(e) => inputBlur(e, !!errors.mivtza)}>
        <option value="">— בחרו חבורה —</option>
        {#each app.mivtzaot.filter(m => m.status === 'active' || m.status === 'in_progress') as m}
          <option value={m.id}>{m.shem}</option>
        {/each}
      </select>
      {#if errors.mivtza}<span class="text-[10px] text-red-400">{errors.mivtza}</span>{/if}
    </div>

    <!-- שם -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="shem">שם החיבור</label>
      <input id="shem" type="text" bind:value={shem}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style={inputStyle(!!errors.shem)}
        onfocus={(e) => inputFocus(e, !!errors.shem)}
        onblur={(e) => inputBlur(e, !!errors.shem)}
        placeholder="שם החיבור..." dir="rtl" />
      {#if errors.shem}<span class="text-[10px] text-red-400">{errors.shem}</span>{/if}
    </div>

    <!-- תיאור -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="desc">תיאור</label>
      <textarea id="desc" rows="3" bind:value={description}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors resize-none"
        style={inputStyle()}
        onfocus={(e) => inputFocus(e)}
        onblur={(e) => inputBlur(e)}
        placeholder="פרט את החיבור..." dir="rtl"></textarea>
    </div>

    <!-- סוג — general -->
    <div class="space-y-2">
      <span class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);">סוג — כללי</span>
      <div class="grid grid-cols-2 gap-2">
        {#each generalTypes as t}
          {@const meta = MASIMA_TYPE_DEFAULTS[t]}
          <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors" style="
            border-color: {type === t ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'};
            background-color: {type === t ? 'var(--color-accent-secondary-light)' : 'var(--color-bg-tertiary)'};
          "
          onmouseenter={(e) => { if (type !== t) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)'; }}
          onmouseleave={(e) => { if (type !== t) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'; }}>
            <input type="radio" name="type" value={t} checked={type === t} onchange={() => onTypeChange(t)} class="mt-0.5" />
            <div>
              <span class="text-sm font-medium" style="color: var(--color-text-primary);">{meta.label}</span>
              <span class="text-xs block" style="color: var(--color-text-secondary);">{meta.desc}</span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- סוג — publication specific -->
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);">סוג — ייחודי לפרסום</span>
        {#if isPublicationMivtza}
          <span class="text-[10px] px-1.5 py-0.5 rounded" style="background-color: var(--color-accent-secondary-light); color: var(--color-accent-secondary);">מומלץ לחבורה זו</span>
        {/if}
      </div>
      <div class="grid grid-cols-2 gap-2">
        {#each publicationTypes as t}
          {@const meta = MASIMA_TYPE_DEFAULTS[t]}
          <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors" style="
            border-color: {type === t ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'};
            background-color: {type === t ? 'var(--color-accent-secondary-light)' : 'var(--color-bg-tertiary)'};
          "
          onmouseenter={(e) => { if (type !== t) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)'; }}
          onmouseleave={(e) => { if (type !== t) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'; }}>
            <input type="radio" name="type" value={t} checked={type === t} onchange={() => onTypeChange(t)} class="mt-0.5" />
            <div>
              <span class="text-sm font-medium" style="color: var(--color-text-primary);">{meta.label}</span>
              <span class="text-xs block" style="color: var(--color-text-secondary);">{meta.desc}</span>
              <span class="text-[10px] font-mono" style="color: var(--color-accent-secondary);">{meta.baseReward} שכר</span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- שיוך + פרס -->
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="assignee">שיוך לחבר</label>
        <select id="assignee" bind:value={assigneeId}
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style={inputStyle()}
          onfocus={(e) => inputFocus(e)}
          onblur={(e) => inputBlur(e)}>
          <option value="">פנוי לשיוך</option>
          {#each enrolledTalmidim as t}
            <option value={t.id}>{t.shem}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="tokens">
          פרס שכר
          <span class="text-[10px] normal-case ml-1" style="color: var(--color-text-tertiary);">(ברירת מחדל לסוג: {MASIMA_TYPE_DEFAULTS[type].baseReward})</span>
        </label>
        <input id="tokens" type="number" bind:value={tmimReward} min="0"
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style={inputStyle(!!errors.tokens)}
          onfocus={(e) => inputFocus(e, !!errors.tokens)}
          onblur={(e) => inputBlur(e, !!errors.tokens)} />
        {#if errors.tokens}<span class="text-[10px] text-red-400">{errors.tokens}</span>{/if}
      </div>
    </div>

    <!-- תאריך יעד -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="due">תאריך יעד</label>
      <input id="due" type="date" bind:value={dueDate}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style={inputStyle()}
        onfocus={(e) => inputFocus(e)}
        onblur={(e) => inputBlur(e)} />
    </div>

    <!-- כפתורים -->
    <div class="flex gap-3 pt-2">
      <button type="submit" disabled={submitting}
        class="flex-1 py-2.5 rounded-lg font-medium text-sm btn-primary disabled:opacity-50">
        {submitting ? 'יוצר...' : 'צור חיבור'}
      </button>
      <a href={href(`/chibburim`)} class="px-4 py-2.5 rounded-lg border text-sm" style="border-color: var(--color-border-primary); color: var(--color-text-secondary); background: transparent;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
        ביטול
      </a>
    </div>
  </form>
</div>
{/if}
