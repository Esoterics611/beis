<script lang="ts">
  import { go, href, routeQuery } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';
  import type { TafkidType, TafkidPriority } from '$lib/types';
  import { page } from '$app/stores';

  const canCreate = $derived(app.isMashpia);

  const typeOptions: { value: TafkidType; label: string }[] = [
    { value: 'research', label: 'מחקר' },
    { value: 'write', label: 'כתיבה' },
    { value: 'review', label: 'ביקורת' },
    { value: 'present', label: 'הרצאה' },
    { value: 'edit', label: 'עריכה' },
    { value: 'source_collection', label: 'ליקוט מקורות' },
  ];

  const priorityOptions: { value: TafkidPriority; label: string; color: string }[] = [
    { value: 'low',      label: 'נמוכה', color: '#a1a1aa' },
    { value: 'medium',   label: 'רגילה', color: 'var(--color-accent-primary)' },
    { value: 'high',     label: 'גבוהה', color: '#fbbf24' },
    { value: 'critical', label: 'דחופה', color: '#f87171' },
  ];

  // ── form state ────────────────────────────────────────────────
  let shem = $state('');
  let description = $state('');
  let masimaId = $state(routeQuery($page.url, 'chibburId') ?? '');
  let type = $state<TafkidType>('research');
  let priority = $state<TafkidPriority>('medium');
  let assigneeId = $state('');
  let tmimReward = $state(25);
  let dueDate = $state('');
  let submitting = $state(false);
  let errors = $state<Record<string, string>>({});

  // derive mivtzaId from masima
  const selectedMasima = $derived(masimaId ? app.getMasima(masimaId) : undefined);
  const mivtzaId = $derived(selectedMasima?.chaburahId ?? '');
  const enrolledTalmidim = $derived(mivtzaId ? app.getMivtzaEnrolled(mivtzaId) : []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!shem.trim()) e.shem = 'שם נדרש';
    if (!masimaId) e.masima = 'יש לבחור חיבור';
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: Event) {
    ev.preventDefault();
    if (!validate() || submitting) return;
    submitting = true;
    try {
      await app.addTafkid({
        shem: shem.trim(),
        description: description.trim(),
        chibburId: masimaId,
        chaburahId: mivtzaId,
        type,
        status: 'todo',
        priority,
        assigneeId: assigneeId || undefined,
        tokenReward: tmimReward,
        deadline: dueDate || undefined,
      });
      go(`/chibburim/${masimaId}`);
    } finally {
      submitting = false;
    }
  }
</script>

{#if !canCreate}
  <div class="rounded-xl border p-6 text-center" style="
    border-color: rgba(239, 68, 68, 0.3);
    background-color: rgba(239, 68, 68, 0.1);
  ">
    <p class="font-medium text-red-400">נדרשת הרשאת מנחה ליצירת שלב</p>
    <a href={href(`/seifim`)} class="text-xs mt-2 block hover:underline" style="color: var(--color-accent-secondary);">חזור ←</a>
  </div>
{:else}
<div class="space-y-6 max-w-2xl">
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-secondary);">
    <a href={href(`/seifim`)} class="hover:underline" style="color: var(--color-accent-secondary);">שלבים</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">שלב חדש</span>
  </div>

  <div>
    <h2 class="text-xl font-semibold" style="color: var(--color-text-primary);">שלב חדש</h2>
    <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">צור חיבור קטנה בתוך חיבור</p>
  </div>

  <form
    class="rounded-xl border p-6 space-y-5"
    style="
      border-color: var(--color-border-primary);
      background-color: var(--color-bg-secondary);
    "
    onsubmit={handleSubmit}>
    <!-- שם -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="shem">שם השלב</label>
      <input id="shem" type="text" bind:value={shem}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style="
          background-color: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border-color: {errors.shem ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border-primary)'};
        "
        onfocus={(e) => {
          if (errors.shem) e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 1)';
          else e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        }}
        onblur={(e) => {
          if (errors.shem) e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          else e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        }}
        placeholder="שלב..." dir="rtl" />
      {#if errors.shem}<span class="text-[10px] text-red-400">{errors.shem}</span>{/if}
    </div>

    <!-- תיאור -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="desc">תיאור</label>
      <textarea id="desc" rows="2" bind:value={description}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors resize-none"
        style="
          background-color: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border-color: var(--color-border-primary);
        "
        onfocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        }}
        onblur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        }}
        placeholder="פרט את השלב..." dir="rtl"></textarea>
    </div>

    <!-- חיבור -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="masima">שייך לחיבור</label>
      <select id="masima" bind:value={masimaId}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style="
          background-color: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border-color: {errors.masima ? 'rgba(239, 68, 68, 0.5)' : 'var(--color-border-primary)'};
        "
        onfocus={(e) => {
          if (errors.masima) e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 1)';
          else e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        }}
        onblur={(e) => {
          if (errors.masima) e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          else e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        }}>
        <option value="">— בחרו חיבור —</option>
        {#each app.masimot.filter(m => m.status === 'open' || m.status === 'in_progress') as m}
          {@const mivtza = app.getMivtza(m.chaburahId)}
          <option value={m.id}>{m.shem} ({mivtza?.shem ?? ''})</option>
        {/each}
      </select>
      {#if errors.masima}<span class="text-[10px] text-red-400">{errors.masima}</span>{/if}
    </div>

    <!-- סוג + עדיפות -->
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="type">סוג</label>
        <select id="type" bind:value={type}
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style="
            background-color: var(--color-bg-tertiary);
            color: var(--color-text-primary);
            border-color: var(--color-border-primary);
          "
          onfocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
          }}
          onblur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
          }}>
          {#each typeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);">עדיפות</label>
        <div class="flex gap-1">
          {#each priorityOptions as opt}
            <button type="button" onclick={() => priority = opt.value}
              class="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
              style="
                color: {priority === opt.value ? opt.color : 'var(--color-text-secondary)'};
                border-color: {priority === opt.value ? opt.color : 'var(--color-border-primary)'};
                background-color: {priority === opt.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
              "
              onmouseenter={(e) => {
                if (priority !== opt.value) {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                }
              }}
              onmouseleave={(e) => {
                if (priority !== opt.value) {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }
              }}>
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- שיוך + פרס -->
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="assignee">שיוך לחבר</label>
        <select id="assignee" bind:value={assigneeId}
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style="
            background-color: var(--color-bg-tertiary);
            color: var(--color-text-primary);
            border-color: var(--color-border-primary);
          "
          onfocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
          }}
          onblur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
          }}>
          <option value="">פנוי לשיוך</option>
          {#each enrolledTalmidim as t}
            <option value={t.id}>{t.shem}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="tokens">פרס שכר</label>
        <input id="tokens" type="number" bind:value={tmimReward} min="0"
          class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
          style="
            background-color: var(--color-bg-tertiary);
            color: var(--color-text-primary);
            border-color: var(--color-border-primary);
          "
          onfocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
          }}
          onblur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
          }} />
      </div>
    </div>

    <!-- תאריך יעד -->
    <div class="space-y-1.5">
      <label class="text-xs font-medium uppercase tracking-wide" style="color: var(--color-text-secondary);" for="due">תאריך יעד</label>
      <input id="due" type="date" bind:value={dueDate}
        class="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
        style="
          background-color: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border-color: var(--color-border-primary);
        "
        onfocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        }}
        onblur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        }} />
    </div>

    <!-- כפתורים -->
    <div class="flex gap-3 pt-2">
      <button type="submit" disabled={submitting}
        class="flex-1 py-2.5 rounded-lg font-medium text-sm btn-primary disabled:opacity-50">
        {submitting ? 'יוצר...' : 'צור שלב'}
      </button>
      <a href={href(`/seifim`)} class="px-4 py-2.5 rounded-lg border text-sm hover:transition-all" style="
        border-color: var(--color-border-primary);
        color: var(--color-text-secondary);
        background-color: transparent;
      " onmouseenter={(e) => {
        e.currentTarget.style.color = 'var(--color-text-primary)';
        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
      }} onmouseleave={(e) => {
        e.currentTarget.style.color = 'var(--color-text-secondary)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}>
        ביטול
      </a>
    </div>
  </form>
</div>
{/if}
