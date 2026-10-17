<script lang="ts">
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import { goto } from '$app/navigation';

  let mivtzaId = $derived($page.params.id ?? '');
  let mivtza = $derived(mivtzaId ? app.getMivtza(mivtzaId) : null);

  let statement = $state('');
  let submitting = $state(false);
  let submitted = $state(false);
  let error = $state('');

  const wordCount = $derived(statement.trim().split(/\s+/).filter(Boolean).length);
  const isOverLimit = $derived(wordCount > 300);
  const isAlreadyEnrolled = $derived(mivtza?.enrolledIds.includes(app.currentUserId ?? '') ?? false);

  async function handleSubmit(ev: Event) {
    ev.preventDefault();
    if (submitting || isOverLimit) return;
    if (!statement.trim()) { error = 'נדרשת הצהרה'; return; }
    submitting = true;
    error = '';
    try {
      await app.addMivtzaApplication(mivtzaId, statement.trim());
      submitted = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'שגיאה בשליחת הבקשה';
    } finally {
      submitting = false;
    }
  }
</script>

{#if !mivtza}
  <div class="page-container">
    <div class="rounded-xl border p-6 text-center" style="border-color: rgba(239,68,68,0.3); background-color: rgba(239,68,68,0.1);">
      <p class="font-medium text-red-400">חבורה לא נמצאה</p>
      <a href="/chaburot" class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור ←</a>
    </div>
  </div>
{:else if isAlreadyEnrolled}
  <div class="page-container">
    <div class="rounded-xl border p-6 text-center" style="border-color: rgba(34,197,94,0.3); background-color: rgba(34,197,94,0.06);">
      <p class="font-medium" style="color: var(--color-status-success);">כבר נרשמת לחבורה זו</p>
      <a href="/chaburot/{mivtzaId}" class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור לחבורה ←</a>
    </div>
  </div>
{:else if submitted}
  <div class="page-container">
    <div class="rounded-xl border p-8 text-center space-y-3" style="border-color: var(--color-status-success); background-color: var(--color-status-success-light);">
      <div class="text-4xl">✓</div>
      <h3 class="text-lg font-semibold" style="color: var(--color-text-primary);">הבקשה נשלחה!</h3>
      <p class="text-sm" style="color: var(--color-text-secondary);">בקשתך להצטרף ל"{mivtza.shem}" התקבלה ותסוקר על ידי המשפיע. תקבל עדכון בקרוב.</p>
      <a href="/chaburot/{mivtzaId}" class="inline-block mt-2 text-xs hover:underline" style="color: var(--color-accent-secondary);">חזור לחבורה ←</a>
    </div>
  </div>
{:else}
<div class="page-container space-y-6 max-w-2xl">
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-tertiary);">
    <a href="/chaburot" style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>חבורות</a>
    <span>/</span>
    <a href="/chaburot/{mivtzaId}" style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>{mivtza.shem}</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">מועמדות</span>
  </div>

  <!-- כותרת -->
  <div class="rounded-xl border p-5 space-y-2" style="border-color: rgba(122,31,43,0.25); background-color: rgba(122,31,43,0.03);">
    <h2 class="text-xl font-bold" style="color: var(--color-text-primary);">מועמדות לתרום לפרסום</h2>
    <p class="text-sm" style="color: var(--color-text-secondary);" dir="rtl">{mivtza.shem}</p>
    {#if mivtza.publicationMeta}
      <p class="text-xs" style="color: var(--color-text-tertiary);" dir="rtl">
        {mivtza.publicationMeta.titleHebrew}
        {#if mivtza.publicationMeta.subtitle} — {mivtza.publicationMeta.subtitle}{/if}
      </p>
    {/if}
  </div>

  <form
    class="rounded-xl border p-6 space-y-5"
    style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);"
    onsubmit={handleSubmit}>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="stmt">
          רקע מלומד ומניע להשתתפות (עד 300 מילים)
        </label>
        <span class="text-xs font-mono" style="color: {isOverLimit ? 'var(--color-status-error)' : wordCount > 250 ? 'var(--color-status-warning)' : 'var(--color-text-tertiary)'};">
          {wordCount}/300
        </span>
      </div>
      <textarea
        id="stmt"
        rows="10"
        bind:value={statement}
        class="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none transition-colors resize-none"
        style="
          background-color: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border-color: {isOverLimit ? 'rgba(239,68,68,0.5)' : 'var(--color-border-primary)'};
          line-height: 1.7;
        "
        onfocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isOverLimit ? 'rgba(239,68,68,1)' : 'var(--color-accent-primary)'; }}
        onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isOverLimit ? 'rgba(239,68,68,0.5)' : 'var(--color-border-primary)'; }}
        placeholder="תאר את הרקע הלימודי שלך, הניסיון הרלוונטי, ומדוע אתה מעוניין לתרום לפרסום זה..." dir="rtl"></textarea>
      {#if isOverLimit}<p class="text-[10px] text-red-400">חרגת מ-300 מילים — קצר את ההצהרה</p>{/if}
    </div>

    <div class="rounded-lg p-3 text-xs space-y-1" style="background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);">
      <p>• המועמדות תסוקר על ידי המשפיע ותקבל תשובה בתוך כמה ימים.</p>
      <p>• אישור מועמדות מזכה בגישה לחיבורים הפרסום ובהקצאת שכר בגין עבודה מאושרת.</p>
      <p>• שם התורם יופיע בפרסום בכפוף להסכמה.</p>
    </div>

    {#if error}
      <p class="text-sm text-red-400 text-center">{error}</p>
    {/if}

    <div class="flex gap-3 pt-1">
      <button
        type="submit"
        disabled={submitting || isOverLimit || !statement.trim()}
        class="flex-1 py-2.5 rounded-lg font-medium text-sm btn-primary disabled:opacity-50">
        {submitting ? 'שולח...' : 'שלח מועמדות'}
      </button>
      <a
        href="/chaburot/{mivtzaId}"
        class="px-4 py-2.5 rounded-lg border text-sm"
        style="border-color: var(--color-border-primary); color: var(--color-text-secondary); background: transparent;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
        ביטול
      </a>
    </div>
  </form>
</div>
{/if}
