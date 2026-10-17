<script lang="ts">
  import { app } from '$stores/app.svelte';
  import type { MivtzaType, MivtzaCategory, PublicationFormat, PublicationLicense } from '$lib/types';
  import { formatPublicationFormat, formatPublicationLicense } from '$lib/utils/format';
  import { goto } from '$app/navigation';

  const typeOptions: { value: MivtzaType; label: string; desc: string }[] = [
    { value: 'course',       label: 'קורס',    desc: 'שיעורים ועבודות מסודרות' },
    { value: 'research',     label: 'מחקר',    desc: 'ייצור מאמרים מקוריים' },
    { value: 'publication',  label: 'פרסום',   desc: 'ספר / קובץ שיתופי לדפוס / דיגיטל' },
    { value: 'chaburah',     label: 'חבורה',   desc: 'חבורת לימוד מעמיקה' },
  ];

  const categoryOptions: { value: MivtzaCategory; label: string }[] = [
    { value: 'nigleh',    label: 'נגלה' },
    { value: 'chassidus', label: 'חסידות' },
    { value: 'halacha',   label: 'הלכה' },
    { value: 'machshava', label: 'מחשבה' },
    { value: 'kabbalah',  label: 'קבלה' },
  ];

  const formatOptions: PublicationFormat[] = ['print', 'ebook', 'web_native', 'source_anthology', 'hybrid'];
  const licenseOptions: PublicationLicense[] = ['cc_by_sa', 'cc_by_nc', 'all_rights_reserved', 'custom'];

  // ── form state ────────────────────────────────────────────────
  let shem = $state('');
  let description = $state('');
  let type = $state<MivtzaType>('course');
  let category = $state<MivtzaCategory>('chassidus');
  let locationId = $state(app.mekomot[0]?.id ?? '');
  let tokenAllocation = $state(1000);
  let isGlobal = $state(false);
  let submitting = $state(false);
  let errors = $state<Record<string, string>>({});

  // publication metadata
  let pubTitleHebrew = $state('');
  let pubTitleEnglish = $state('');
  let pubSubtitle = $state('');
  let pubFormat = $state<PublicationFormat>('print');
  let pubAudience = $state('');
  let pubLength = $state<number | undefined>(undefined);
  let pubDeadline = $state('');
  let pubBudget = $state<number | undefined>(undefined);
  let pubLicense = $state<PublicationLicense>('cc_by_sa');

  const isPublication = $derived(type === 'publication');

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!shem.trim()) e.shem = 'שם נדרש';
    if (tokenAllocation < 1) e.tokens = 'נדרשת הקצאה חיובית';
    if (isPublication && !pubTitleHebrew.trim()) e.pubTitle = 'שם הפרסום בעברית נדרש';
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: Event) {
    ev.preventDefault();
    if (!validate() || submitting) return;
    submitting = true;
    try {
      const mivtza = await app.addMivtza({
        shem: shem.trim(),
        description: description.trim(),
        type,
        category,
        creatorId: app.currentUserId ?? '',
        locationId,
        isGlobal,
        status: 'active',
        tokenAllocation,
        topics: [],
        ...(isPublication && {
          publicationMeta: {
            titleHebrew: pubTitleHebrew.trim(),
            titleEnglish: pubTitleEnglish.trim() || undefined,
            subtitle: pubSubtitle.trim() || undefined,
            targetFormat: pubFormat,
            targetAudience: pubAudience.trim() || undefined,
            targetLength: pubLength,
            targetDeadline: pubDeadline || undefined,
            totalBudgetTmim: pubBudget,
            license: pubLicense,
          },
        }),
      });
      goto(`/chaburot/${mivtza.id}`);
    } finally {
      submitting = false;
    }
  }

  const inputStyle = (hasErr = false) => `
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border-color: ${hasErr ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border-primary)'};
  `;
  const onFocus = (e: FocusEvent, hasErr = false) => {
    (e.currentTarget as HTMLElement).style.borderColor = hasErr ? 'rgba(239, 68, 68, 1)' : 'var(--color-accent-primary)';
  };
  const onBlur = (e: FocusEvent, hasErr = false) => {
    (e.currentTarget as HTMLElement).style.borderColor = hasErr ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border-primary)';
  };
</script>

{#if !app.isMashpia}
  <div class="rounded-xl border p-6 text-center" style="border-color: rgba(239,68,68,0.3); background-color: rgba(239,68,68,0.1);">
    <p class="font-medium text-red-400">נדרשת הרשאה לפתיחת חבורה</p>
    <a href="/chaburot" class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור ←</a>
  </div>
{:else}
<div class="space-y-6 max-w-2xl">
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-secondary);">
    <a href="/chaburot" class="hover:underline" style="color: var(--color-accent-secondary);">חבורות</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">חבורה חדשה</span>
  </div>

  <div>
    <h2 class="text-xl font-semibold" style="color: var(--color-text-primary);">חבורה חדשה</h2>
    <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">צור קמפיין, קורס, מחקר, פרסום, או חבורה</p>
  </div>

  <form
    class="rounded-xl border p-6 space-y-5"
    style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);"
    onsubmit={handleSubmit}>

    <!-- שם -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="shem">שם החבורה</label>
      <input id="shem" type="text" bind:value={shem}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style={inputStyle(!!errors.shem)}
        onfocus={(e) => onFocus(e, !!errors.shem)}
        onblur={(e) => onBlur(e, !!errors.shem)}
        placeholder="חבורה..." dir="rtl" />
      {#if errors.shem}<span class="text-[10px] text-red-400">{errors.shem}</span>{/if}
    </div>

    <!-- תיאור -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="desc">תיאור</label>
      <textarea id="desc" rows="3" bind:value={description}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors resize-none"
        style={inputStyle()}
        onfocus={(e) => onFocus(e)}
        onblur={(e) => onBlur(e)}
        placeholder="תאר את החבורה..." dir="rtl"></textarea>
    </div>

    <!-- סוג -->
    <div class="space-y-2">
      <span class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);">סוג</span>
      <div class="grid grid-cols-2 gap-2">
        {#each typeOptions as opt}
          <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors" style="
            border-color: {type === opt.value ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'};
            background-color: {type === opt.value ? 'var(--color-accent-secondary-light)' : 'var(--color-bg-tertiary)'};
          "
          onmouseenter={(e) => { if (type !== opt.value) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)'; }}
          onmouseleave={(e) => { if (type !== opt.value) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'; }}>
            <input type="radio" name="type" value={opt.value} bind:group={type} class="mt-0.5" />
            <div>
              <span class="text-sm font-medium" style="color: var(--color-text-primary);">{opt.label}</span>
              <span class="text-xs block" style="color: var(--color-text-secondary);">{opt.desc}</span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- === פרסום — מטא-נתונים (shown when type=publication) === -->
    {#if isPublication}
    <div class="rounded-lg border p-4 space-y-4" style="border-color: rgba(122,31,43,0.25); background-color: rgba(122,31,43,0.03);">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold" style="color: var(--color-accent-secondary);">📖 פרטי הפרסום</span>
        <span class="text-[10px]" style="color: var(--color-text-tertiary);">ניתן להשלים לאחר מכן</span>
      </div>

      <!-- שם עברי + אנגלי -->
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubTitleHe">שם הספר (עברית) *</label>
          <input id="pubTitleHe" type="text" bind:value={pubTitleHebrew}
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle(!!errors.pubTitle)}
            onfocus={(e) => onFocus(e, !!errors.pubTitle)}
            onblur={(e) => onBlur(e, !!errors.pubTitle)}
            placeholder="שם הספר..." dir="rtl" />
          {#if errors.pubTitle}<span class="text-[10px] text-red-400">{errors.pubTitle}</span>{/if}
        </div>
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubTitleEn">שם הספר (אנגלית)</label>
          <input id="pubTitleEn" type="text" bind:value={pubTitleEnglish}
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)}
            placeholder="Book title..." />
        </div>
      </div>

      <!-- כותרת משנה -->
      <div class="space-y-1">
        <label class="text-xs" style="color: var(--color-text-secondary);" for="pubSub">כותרת משנה</label>
        <input id="pubSub" type="text" bind:value={pubSubtitle}
          class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
          style={inputStyle()}
          onfocus={(e) => onFocus(e)}
          onblur={(e) => onBlur(e)}
          placeholder="כותרת משנה..." dir="rtl" />
      </div>

      <!-- פורמט + רישיון -->
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubFmt">פורמט יעד</label>
          <select id="pubFmt" bind:value={pubFormat}
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)}>
            {#each formatOptions as f}
              <option value={f}>{formatPublicationFormat(f)}</option>
            {/each}
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubLic">רישיון</label>
          <select id="pubLic" bind:value={pubLicense}
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)}>
            {#each licenseOptions as l}
              <option value={l}>{formatPublicationLicense(l)}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- קהל + אורך -->
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubAud">קהל יעד</label>
          <input id="pubAud" type="text" bind:value={pubAudience}
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)}
            placeholder={'ת"ח מובהקים, בחורי ישיבה...'} dir="rtl" />
        </div>
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubLen">אורך (עמודים)</label>
          <input id="pubLen" type="number" bind:value={pubLength} min="1"
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)}
            placeholder="200" />
        </div>
      </div>

      <!-- דדליין + תקציב שכר -->
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubDl">תאריך יעד לפרסום</label>
          <input id="pubDl" type="date" bind:value={pubDeadline}
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)} />
        </div>
        <div class="space-y-1">
          <label class="text-xs" style="color: var(--color-text-secondary);" for="pubBudget">תקציב כולל (שכר)</label>
          <input id="pubBudget" type="number" bind:value={pubBudget} min="0"
            class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors"
            style={inputStyle()}
            onfocus={(e) => onFocus(e)}
            onblur={(e) => onBlur(e)}
            placeholder="10000" />
        </div>
      </div>
    </div>
    {/if}

    <!-- קטגוריה -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="cat">קטגוריה</label>
      <select id="cat" bind:value={category}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style={inputStyle()}
        onfocus={(e) => onFocus(e)}
        onblur={(e) => onBlur(e)}>
        {#each categoryOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <!-- מיקום + הקצאה -->
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="makom">מיקום</label>
        <select id="makom" bind:value={locationId}
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style={inputStyle()}
          onfocus={(e) => onFocus(e)}
          onblur={(e) => onBlur(e)}>
          {#each app.mekomot as makom}
            <option value={makom.id}>{makom.shem}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="tokens">הקצאת שכר</label>
        <input id="tokens" type="number" bind:value={tokenAllocation} min="1"
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style={inputStyle(!!errors.tokens)}
          onfocus={(e) => onFocus(e, !!errors.tokens)}
          onblur={(e) => onBlur(e, !!errors.tokens)} />
        {#if errors.tokens}<span class="text-[10px] text-red-400">{errors.tokens}</span>{/if}
      </div>
    </div>

    <label class="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" bind:checked={isGlobal} class="rounded" />
      <span class="text-sm" style="color: var(--color-text-primary);">חבורה גלובלית — פתוח לכל מקומות הרשת</span>
    </label>

    <!-- כפתורים -->
    <div class="flex gap-3 pt-2">
      <button type="submit" disabled={submitting}
        class="flex-1 py-2.5 rounded-lg font-medium text-sm btn-primary disabled:opacity-50">
        {submitting ? 'יוצר...' : 'צור חבורה'}
      </button>
      <a href="/chaburot" class="px-4 py-2.5 rounded-lg border text-sm" style="border-color: var(--color-border-primary); color: var(--color-text-secondary); background: transparent;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
        ביטול
      </a>
    </div>
  </form>
</div>
{/if}
