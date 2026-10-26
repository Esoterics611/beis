<script lang="ts">
  import { go, href } from '$lib/utils/nav';
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import type { MasimaType } from '$lib/types';
  import { MASIMA_TYPE_DEFAULTS } from '$lib/types';

  let mivtzaId = $derived($page.params.id ?? '');
  let mivtza = $derived(mivtzaId ? app.getMivtza(mivtzaId) : null);

  type WizardRow = {
    shem: string;
    type: MasimaType;
    reward: number;
    deadline: string;
  };

  const DEFAULT_TYPE: MasimaType = 'chapter_draft';

  let rows = $state<WizardRow[]>([
    { shem: '', type: DEFAULT_TYPE, reward: MASIMA_TYPE_DEFAULTS[DEFAULT_TYPE].baseReward, deadline: '' },
    { shem: '', type: DEFAULT_TYPE, reward: MASIMA_TYPE_DEFAULTS[DEFAULT_TYPE].baseReward, deadline: '' },
    { shem: '', type: DEFAULT_TYPE, reward: MASIMA_TYPE_DEFAULTS[DEFAULT_TYPE].baseReward, deadline: '' },
  ]);

  let globalDeadline = $state('');
  let submitting = $state(false);
  let submitted = $state(0);
  let errors = $state<string[]>([]);

  const publicationTypes: MasimaType[] = [
    'chapter_draft', 'research_paper', 'source_analysis', 'translation', 'original_analysis',
    'scholarly_footnote', 'editing', 'proofreading', 'formatting_typesetting',
    'indexing', 'design_layout', 'source_collection', 'peer_review', 'presentation',
  ];

  function addRow() {
    rows = [...rows, { shem: '', type: DEFAULT_TYPE, reward: MASIMA_TYPE_DEFAULTS[DEFAULT_TYPE].baseReward, deadline: '' }];
  }

  function removeRow(i: number) {
    rows = rows.filter((_, idx) => idx !== i);
  }

  function onRowTypeChange(i: number, t: MasimaType) {
    rows[i].type = t;
    rows[i].reward = MASIMA_TYPE_DEFAULTS[t].baseReward;
  }

  function applyGlobalDeadline() {
    rows = rows.map(r => ({ ...r, deadline: globalDeadline }));
  }

  function validate(): boolean {
    const errs: string[] = [];
    rows.forEach((r, i) => {
      if (!r.shem.trim()) errs.push(`שורה ${i + 1}: שם נדרש`);
    });
    errors = errs;
    return errs.length === 0;
  }

  async function handleSubmit(ev: Event) {
    ev.preventDefault();
    if (!validate() || submitting) return;
    submitting = true;
    submitted = 0;
    try {
      for (const row of rows) {
        if (!row.shem.trim()) continue;
        await app.addMasima({
          shem: row.shem.trim(),
          description: '',
          chaburahId: mivtzaId,
          type: row.type,
          status: 'open',
          tokenAllocation: row.reward,
          deadline: row.deadline || undefined,
          contentUrl: undefined,
          submissionNotes: undefined,
          reviewerId: undefined,
          assigneeId: undefined,
        });
        submitted++;
      }
      go(`/chaburot/${mivtzaId}`);
    } finally {
      submitting = false;
    }
  }

  const inputStyle = `background-color: var(--color-bg-tertiary); color: var(--color-text-primary); border-color: var(--color-border-primary);`;
  const inputFocus = (e: FocusEvent) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent-primary)'; };
  const inputBlur = (e: FocusEvent) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'; };
</script>

{#if !app.isMashpia}
  <div class="page-container">
    <div class="rounded-xl border p-6 text-center" style="border-color: rgba(239,68,68,0.3); background-color: rgba(239,68,68,0.1);">
      <p class="font-medium text-red-400">נדרשת הרשאת מנחה</p>
      <a href={href(`/chaburot/${mivtzaId}`)} class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור ←</a>
    </div>
  </div>
{:else if !mivtza}
  <div class="page-container">
    <div class="rounded-xl border p-6 text-center" style="border-color: rgba(239,68,68,0.3); background-color: rgba(239,68,68,0.1);">
      <p class="font-medium text-red-400">חבורה לא נמצאה</p>
      <a href={href(`/chaburot`)} class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור ←</a>
    </div>
  </div>
{:else}
<div class="page-container space-y-6">
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-tertiary);">
    <a href={href(`/chaburot`)} style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>חבורות</a>
    <span>/</span>
    <a href={href(`/chaburot/${mivtzaId}`)} style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>{mivtza.shem}</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">אשף חיבורים</span>
  </div>

  <div>
    <h2 class="text-xl font-semibold" style="color: var(--color-text-primary);">אשף יצירת חיבורים</h2>
    <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">הגדר את שלד החיבורים לפרסום "{mivtza.publicationMeta?.titleHebrew ?? mivtza.shem}" בבת אחת</p>
  </div>

  <!-- תאריך גלובלי -->
  <div class="flex items-end gap-3 p-4 rounded-xl border" style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);">
    <div class="flex-1 space-y-1">
      <label class="text-xs" style="color: var(--color-text-secondary);" for="gd">תאריך יעד גלובלי לכל החיבורים</label>
      <input id="gd" type="date" bind:value={globalDeadline}
        class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
        style={inputStyle}
        onfocus={inputFocus}
        onblur={inputBlur} />
    </div>
    <button type="button" onclick={applyGlobalDeadline}
      class="px-3 py-2 rounded-lg text-xs font-medium btn-primary">
      החל לכולן
    </button>
  </div>

  <!-- טבלת חיבורים -->
  <form onsubmit={handleSubmit} class="space-y-3">
    <div class="rounded-xl border overflow-hidden" style="border-color: var(--color-border-primary);">
      <!-- כותרת -->
      <div class="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wide" style="background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);">
        <span class="col-span-4">שם החיבור</span>
        <span class="col-span-3">סוג</span>
        <span class="col-span-2">שכר</span>
        <span class="col-span-2">דדליין</span>
        <span class="col-span-1"></span>
      </div>

      <!-- שורות -->
      {#each rows as row, i}
        <div class="grid grid-cols-12 gap-2 px-4 py-2 items-center" style="border-top: 1px solid var(--color-border-secondary); background-color: var(--color-bg-secondary);">
          <div class="col-span-4">
            <input type="text" bind:value={row.shem}
              class="w-full px-2 py-1.5 rounded border text-xs focus:outline-none transition-colors"
              style={inputStyle}
              onfocus={inputFocus}
              onblur={inputBlur}
              placeholder="שם החיבור..." dir="rtl" />
          </div>
          <div class="col-span-3">
            <select
              value={row.type}
              onchange={(e) => onRowTypeChange(i, (e.currentTarget as HTMLSelectElement).value as MasimaType)}
              class="w-full px-2 py-1.5 rounded border text-xs focus:outline-none transition-colors"
              style={inputStyle}
              onfocus={inputFocus}
              onblur={inputBlur}>
              {#each publicationTypes as t}
                <option value={t}>{MASIMA_TYPE_DEFAULTS[t].label}</option>
              {/each}
            </select>
          </div>
          <div class="col-span-2">
            <input type="number" bind:value={row.reward} min="0"
              class="w-full px-2 py-1.5 rounded border text-xs focus:outline-none transition-colors font-mono"
              style={inputStyle}
              onfocus={inputFocus}
              onblur={inputBlur} />
          </div>
          <div class="col-span-2">
            <input type="date" bind:value={row.deadline}
              class="w-full px-2 py-1.5 rounded border text-xs focus:outline-none transition-colors"
              style={inputStyle}
              onfocus={inputFocus}
              onblur={inputBlur} />
          </div>
          <div class="col-span-1 flex justify-center">
            <button type="button" onclick={() => removeRow(i)}
              class="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
              style="color: var(--color-text-tertiary);"
              onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-status-error)'; }}
              onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>
              ✕
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- הוסף שורה -->
    <button type="button" onclick={addRow}
      class="w-full py-2 rounded-xl border text-xs font-medium transition-colors"
      style="border-color: var(--color-border-primary); color: var(--color-text-secondary); background: transparent; border-style: dashed;"
      onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)'; }}
      onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'; }}>
      + הוסף חיבור
    </button>

    {#if errors.length > 0}
      <div class="rounded-lg p-3 space-y-1" style="background-color: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);">
        {#each errors as err}
          <p class="text-xs text-red-400">{err}</p>
        {/each}
      </div>
    {/if}

    <!-- סיכום -->
    <div class="flex items-center justify-between text-xs" style="color: var(--color-text-tertiary);">
      <span>{rows.length} חיבורים · סה"כ {rows.reduce((s, r) => s + r.reward, 0).toLocaleString('he-IL')} שכר</span>
      {#if submitting}
        <span style="color: var(--color-accent-primary);">יוצר {submitted}/{rows.length}...</span>
      {/if}
    </div>

    <div class="flex gap-3">
      <button type="submit" disabled={submitting || rows.length === 0}
        class="flex-1 py-2.5 rounded-lg font-medium text-sm btn-primary disabled:opacity-50">
        {submitting ? `יוצר ${submitted}/${rows.length}...` : `צור ${rows.length} חיבורים`}
      </button>
      <a href={href(`/chaburot/${mivtzaId}`)} class="px-4 py-2.5 rounded-lg border text-sm"
        style="border-color: var(--color-border-primary); color: var(--color-text-secondary); background: transparent;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
        ביטול
      </a>
    </div>
  </form>
</div>
{/if}
