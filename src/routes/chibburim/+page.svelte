<script lang="ts">
  import { href } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDeadline } from '$lib/utils/format';
  import StatusBadge from '$components/StatusBadge.svelte';
  import TalmidAvatar from '$components/TalmidAvatar.svelte';
  import ProgressBar from '$components/ProgressBar.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import type { MasimaStatus } from '$lib/types';

  let activeFilter = $state<MasimaStatus | 'all'>('all');

  const filters = [
    { l: 'הכל',      v: 'all' },
    { l: 'פתוח',     v: 'open' },
    { l: 'בביצוע',   v: 'in_progress' },
    { l: 'הוגש',     v: 'submitted' },
    { l: 'בביקורת',  v: 'in_review' },
    { l: 'אושר',     v: 'approved' },
    { l: 'פורסם',    v: 'published' },
  ];

  const mStatus: Record<string, string> = {
    open: '○', in_progress: '◐', submitted: '◑', in_review: '◑',
    revision_requested: '↺', approved: '●', published: '✦',
  };

  let filtered = $derived(app.masimot.filter(m => activeFilter === 'all' || m.status === activeFilter));
</script>

<div class="page-container space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">חיבורים</h1>
      <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">כל החיבורים בכל החבורות</p>
    </div>
    <a
      href={href(`/chibburim/new`)}
      class="px-4 py-2 text-sm font-semibold transition-colors duration-150"
      style="
        background-color: rgba(125,108,63,0.1);
        border: 1px solid var(--color-accent-secondary);
        border-radius: var(--radius-md);
        color: var(--color-accent-secondary);
        text-decoration: none;
      "
      onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.2)'; }}
      onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.1)'; }}
    >+ חיבור חדש</a>
  </div>

  <!-- Filter tabs -->
  <div
    class="flex gap-1 p-1 w-fit flex-wrap"
    style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg);"
  >
    {#each filters as f}
      <button
        onclick={() => activeFilter = f.v as typeof activeFilter}
        class="px-3 py-1.5 text-xs font-medium transition-all duration-150"
        style="
          border-radius: var(--radius-sm);
          color: {activeFilter === f.v ? 'var(--color-accent-secondary)' : 'var(--color-text-tertiary)'};
          background-color: {activeFilter === f.v ? 'rgba(125,108,63,0.1)' : 'transparent'};
        "
      >{f.l}</button>
    {/each}
  </div>

  <!-- List -->
  <div
    style="
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      background-color: var(--color-bg-secondary);
      overflow: hidden;
    "
  >
    {#each filtered as m}
      {@const mivtza     = app.getMivtza(m.chaburahId)}
      {@const assignee   = m.assigneeId ? app.getTalmid(m.assigneeId) : null}
      {@const reviewCount = app.getMasimaPeerReviews(m.id).length}
      {@const progress   = app.getMasimaProgress(m.id)}
      <a
        href={href(`/chibburim/${m.id}`)}
        class="flex items-center gap-5 px-6 py-5 transition-colors duration-150"
        style="border-bottom: 1px solid var(--color-border-secondary); text-decoration: none; color: inherit;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <!-- Status glyph -->
        <span class="text-xl w-6 text-center flex-shrink-0" style="color: var(--color-text-secondary);">
          {mStatus[m.status] ?? '○'}
        </span>

        <!-- Title + metadata — now gets the full remaining width -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="text-base font-semibold" style="color: var(--color-text-primary);">{m.shem}</span>
            <StatusBadge status={m.status} />
          </div>
          <div class="flex items-center gap-4 text-sm flex-wrap" style="color: var(--color-text-secondary);">
            {#if mivtza}
              <span>{mivtza.shem}</span>
            {/if}
            {#if assignee}
              <TalmidAvatar shem={assignee.shem} score={assignee.contribution_score} size="sm" />
              <span>{assignee.shem}</span>
            {:else}
              <span style="color: var(--color-accent-secondary);">פנוי לשיוך</span>
            {/if}
            {#if reviewCount > 0}
              <span style="color: var(--color-accent-primary);">{reviewCount} ביקורות</span>
            {/if}
          </div>
        </div>

        <!-- שכר + progress + deadline in one fixed-width panel -->
        <div class="flex-shrink-0 w-40 space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(m.tokenAllocation)}</span>
            {#if m.deadline}
              {@const dl = formatDeadline(m.deadline)}
              <span class="text-xs" style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-secondary)'};">{dl.text}</span>
            {/if}
          </div>
          <ProgressBar value={progress} color="primary" showLabel />
        </div>
      </a>
    {:else}
      <EmptyState icon="⎇" title="אין חיבורים" description="לא נמצאו חיבורים לסינון זה" />
    {/each}
  </div>
</div>
