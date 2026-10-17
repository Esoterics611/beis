<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDeadline } from '$lib/utils/format';
  import StatusBadge from '$components/StatusBadge.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import type { TafkidStatus } from '$lib/types';

  let view      = $state<'board' | 'list'>('board');
  let showAll   = $state(false);
  let listFilter = $state<TafkidStatus | 'all'>('all');

  let tafkidim    = $derived(showAll ? app.tafkidim : app.myTafkidim);
  let listFiltered = $derived(tafkidim.filter(t => listFilter === 'all' || t.status === listFilter));

  const columns: { status: TafkidStatus; heb: string; color: string }[] = [
    { status: 'todo',        heb: 'לביצוע',  color: 'var(--color-text-tertiary)' },
    { status: 'in_progress', heb: 'בביצוע',  color: 'var(--color-accent-primary)' },
    { status: 'submitted',   heb: 'הוגש',    color: 'var(--color-status-warning)' },
    { status: 'approved',    heb: 'אושר',    color: 'var(--color-status-success)' },
  ];

  const tStatus: Record<string, string> = {
    todo: '○', in_progress: '◐', submitted: '◑', approved: '●', rejected: '✕',
  };

  const priColors: Record<string, string> = {
    low: 'var(--color-text-tertiary)', medium: 'var(--color-accent-primary)',
    high: 'var(--color-status-warning)', critical: 'var(--color-status-error)',
  };

  const listFilters: { l: string; v: TafkidStatus | 'all' }[] = [
    { l: 'הכל', v: 'all' }, { l: 'לביצוע', v: 'todo' }, { l: 'בביצוע', v: 'in_progress' },
    { l: 'הוגש', v: 'submitted' }, { l: 'אושר', v: 'approved' },
  ];
</script>

<div class="page-container space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">שלבים</h1>
      <p class="text-sm mt-1" style="color: var(--color-text-secondary);">מעקב שלבים אישיים</p>
    </div>
    <div class="flex gap-2 flex-wrap">
      <a
        href="/seifim/new"
        class="px-3 py-1.5 text-xs font-semibold transition-colors duration-150"
        style="
          background-color: rgba(125,108,63,0.1);
          border: 1px solid var(--color-accent-secondary);
          border-radius: var(--radius-md);
          color: var(--color-accent-secondary);
          text-decoration: none;
        "
      >+ שלב חדש</a>
      <button
        onclick={() => showAll = !showAll}
        class="px-3 py-1.5 text-xs font-medium transition-all duration-150"
        style="
          border: 1px solid {showAll ? 'var(--color-accent-secondary)' : 'var(--color-border-primary)'};
          border-radius: var(--radius-md);
          color: {showAll ? 'var(--color-accent-secondary)' : 'var(--color-text-secondary)'};
          background: none;
          cursor: pointer;
        "
      >{showAll ? 'כל השלבים' : 'השלבים שלי'}</button>
      <!-- View toggle -->
      <div
        class="flex gap-1 p-1"
        style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg);"
      >
        {#each ([['board', 'לוח'], ['list', 'רשימה']] as const) as [v, l]}
          <button
            onclick={() => view = v}
            class="px-3 py-1 text-xs font-medium transition-all duration-150"
            style="
              border-radius: var(--radius-sm);
              color: {view === v ? 'var(--color-accent-secondary)' : 'var(--color-text-tertiary)'};
              background-color: {view === v ? 'rgba(125,108,63,0.1)' : 'transparent'};
              border: none; cursor: pointer;
            "
          >{l}</button>
        {/each}
      </div>
    </div>
  </div>

  {#if view === 'board'}
    <!-- Kanban board -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {#each columns as col}
        {@const cards = tafkidim.filter(t => t.status === col.status)}
        <div
          style="
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-xl);
            background-color: var(--color-bg-secondary);
            overflow: hidden;
          "
        >
          <div
            class="flex items-center justify-between px-4 py-3"
            style="border-bottom: 1px solid var(--color-border-primary);"
          >
            <span class="text-sm font-semibold" style="color: {col.color};">{col.heb}</span>
            <span
              class="text-xs font-mono px-2 py-0.5"
              style="
                color: {col.color};
                background-color: var(--color-bg-tertiary);
                border-radius: var(--radius-sm);
              "
            >{cards.length}</span>
          </div>
          <div class="p-2 space-y-2">
            {#each cards as t}
              {@const masima = app.getMasima(t.chibburId)}
              {@const dl     = t.deadline ? formatDeadline(t.deadline) : null}
              <div
                class="p-3 space-y-2"
                style="
                  border: 1px solid var(--color-border-secondary);
                  border-radius: var(--radius-lg);
                  background-color: var(--color-bg-tertiary);
                "
              >
                <div class="flex items-start gap-2">
                  <div
                    class="w-1.5 h-4 rounded-full mt-0.5 flex-shrink-0"
                    style="background-color: {priColors[t.priority] ?? 'var(--color-text-tertiary)'};"
                  ></div>
                  <p class="text-sm font-medium leading-snug" style="color: var(--color-text-primary);">{t.shem}</p>
                </div>
                <p class="text-sm" style="color: var(--color-text-secondary);">{masima?.shem ?? ''}</p>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenReward)}</span>
                  {#if dl}
                    <span class="text-xs" style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-secondary)'};">{dl.text}</span>
                  {/if}
                </div>
                {#if t.status === 'todo' && t.assigneeId === app.currentUserId}
                  <button
                    onclick={() => app.startTafkid(t.id)}
                    class="w-full py-1 text-xs font-semibold transition-colors duration-150"
                    style="
                      background-color: rgba(27,79,114,0.1);
                      color: var(--color-accent-primary);
                      border: 1px solid rgba(27,79,114,0.3);
                      border-radius: var(--radius-sm);
                      cursor: pointer;
                    "
                  >התחל ←</button>
                {:else if t.status === 'in_progress' && t.assigneeId === app.currentUserId}
                  <button
                    onclick={() => app.submitTafkid(t.id)}
                    class="w-full py-1 text-xs font-semibold transition-colors duration-150"
                    style="
                      background-color: rgba(146,64,14,0.1);
                      color: var(--color-status-warning);
                      border: 1px solid rgba(146,64,14,0.3);
                      border-radius: var(--radius-sm);
                      cursor: pointer;
                    "
                  >הגש ←</button>
                {:else if t.status === 'submitted' && app.isMashpia}
                  <button
                    onclick={() => app.approveTafkid(t.id)}
                    class="w-full py-1 text-xs font-semibold transition-colors duration-150"
                    style="
                      background-color: rgba(30,111,80,0.1);
                      color: var(--color-status-success);
                      border: 1px solid rgba(30,111,80,0.3);
                      border-radius: var(--radius-sm);
                      cursor: pointer;
                    "
                  >אשר ✓</button>
                {/if}
              </div>
            {:else}
              <div class="py-6 text-center text-sm" style="color: var(--color-text-secondary);">ריק</div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

  {:else}
    <!-- List view -->
    <div
      class="flex gap-1 p-1 w-fit"
      style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg);"
    >
      {#each listFilters as f}
        <button
          onclick={() => listFilter = f.v}
          class="px-3 py-1.5 text-xs font-medium transition-all duration-150"
          style="
            border-radius: var(--radius-sm); border: none; cursor: pointer;
            color: {listFilter === f.v ? 'var(--color-accent-secondary)' : 'var(--color-text-tertiary)'};
            background-color: {listFilter === f.v ? 'rgba(125,108,63,0.1)' : 'transparent'};
          "
        >{f.l}</button>
      {/each}
    </div>
    <div
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      {#each listFiltered as t}
        {@const masima = app.getMasima(t.chibburId)}
        {@const mivtza = app.getMivtza(t.chaburahId)}
        {@const dl     = t.deadline ? formatDeadline(t.deadline) : null}
        <div
          class="flex items-center gap-4 px-6 py-3.5"
          style="border-bottom: 1px solid var(--color-border-secondary);"
        >
          <div
            class="w-1 h-8 rounded-full flex-shrink-0"
            style="background-color: {priColors[t.priority] ?? 'var(--color-text-tertiary)'};"
          ></div>
          <span class="w-4 flex-shrink-0 text-center" style="color: var(--color-text-tertiary);">{tStatus[t.status]}</span>
          <div class="flex-1 min-w-0">
            <p class="text-base font-medium truncate" style="color: var(--color-text-primary);">{t.shem}</p>
            <p class="text-sm" style="color: var(--color-text-secondary);">{mivtza?.shem ?? ''} · {masima?.shem ?? ''}</p>
          </div>
          <StatusBadge status={t.status} />
          <span class="text-xs font-mono font-semibold flex-shrink-0" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenReward)}</span>
          {#if dl}
            <span class="text-xs flex-shrink-0" style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-secondary)'};">{dl.text}</span>
          {/if}
        </div>
      {:else}
        <EmptyState icon="▸" title="אין שלבים" description="לא נמצאו שלבים לסינון זה" />
      {/each}
    </div>
  {/if}
</div>
