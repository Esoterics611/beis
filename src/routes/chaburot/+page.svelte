<script lang="ts">
  import { href } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDeadline, mivtzaCategoryLabel, formatMivtzaType } from '$lib/utils/format';
  import ProgressBar from '$components/ProgressBar.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import type { MivtzaStatus, MivtzaType } from '$lib/types';

  let search       = $state('');
  let statusFilter = $state<MivtzaStatus | 'all'>('all');
  let typeFilter   = $state<MivtzaType | 'all'>('all');

  const statusFilters: { label: string; value: MivtzaStatus | 'all' }[] = [
    { label: 'הכל', value: 'all' },
    { label: 'פעיל', value: 'active' },
    { label: 'בביצוע', value: 'in_progress' },
    { label: 'הושלם', value: 'completed' },
    { label: 'טיוטה', value: 'draft' },
  ];

  const typeFilters: { label: string; value: MivtzaType | 'all' }[] = [
    { label: 'הכל', value: 'all' },
    { label: 'קורס', value: 'course' },
    { label: 'מחקר', value: 'research' },
    { label: 'פרסום', value: 'publication' },
    { label: 'חבורה', value: 'chaburah' },
  ];

  const typeIcon: Record<MivtzaType, string> = {
    course: '◈', research: '⎇', publication: '◆', chaburah: '⬡',
  };

  let filtered = $derived(
    app.mivtzaot.filter(m => {
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchType   = typeFilter   === 'all' || m.type   === typeFilter;
      const matchSearch = !search || m.shem.includes(search) || m.topics.some(t => t.includes(search));
      return matchStatus && matchType && matchSearch;
    })
  );

  function filterBtnStyle(active: boolean, accent: 'gold' | 'primary' = 'gold') {
    const color = accent === 'gold' ? 'var(--color-accent-secondary)' : 'var(--color-accent-primary)';
    return active
      ? `background-color: rgba(125,108,63,0.1); color: ${color}; border-radius: var(--radius-sm);`
      : `color: var(--color-text-tertiary); border-radius: var(--radius-sm);`;
  }
</script>

<div class="page-container space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">חבורות</h1>
      <p class="text-sm mt-1" style="color: var(--color-text-secondary);">קמפיינים, קורסים, מחקרים ופרסומים</p>
    </div>
    {#if app.isMashpia}
      <a
        href={href(`/chaburot/new`)}
        class="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors duration-150"
        style="
          background-color: rgba(125,108,63,0.1);
          border: 1px solid var(--color-accent-secondary);
          border-radius: var(--radius-md);
          color: var(--color-accent-secondary);
          text-decoration: none;
        "
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.2)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.1)'; }}
      >+ חבורה חדשה</a>
    {/if}
  </div>

  <!-- Filters -->
  <div class="flex flex-col gap-3">
    <!-- Status filter -->
    <div
      class="flex gap-1 p-1 w-fit"
      style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg);"
    >
      {#each statusFilters as f}
        <button
          onclick={() => statusFilter = f.value}
          class="px-3 py-1.5 text-xs font-medium transition-all duration-150"
          style={filterBtnStyle(statusFilter === f.value)}
        >{f.label}</button>
      {/each}
    </div>
    <!-- Type filter + search -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div
        class="flex gap-1 p-1"
        style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg);"
      >
        {#each typeFilters as f}
          <button
            onclick={() => typeFilter = f.value}
            class="px-3 py-1.5 text-xs font-medium transition-all duration-150"
            style={filterBtnStyle(typeFilter === f.value, 'primary')}
          >{f.label}</button>
        {/each}
      </div>
      <input
        type="text"
        bind:value={search}
        placeholder="חיפוש חבורה..."
        dir="rtl"
        style="
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: 0.875rem;
          font-family: var(--font-hebrew);
          outline: none;
        "
      />
    </div>
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
    {#each filtered as mivtza}
      {@const masimot  = app.getMivtzaMasimot(mivtza.id)}
      {@const creator  = app.getTalmid(mivtza.creatorId)}
      {@const makom    = app.getMakom(mivtza.locationId)}
      {@const progress = app.getMivtzaProgress(mivtza.id)}
      <a
        href={href(`/chaburot/${mivtza.id}`)}
        class="block px-6 py-5 transition-colors duration-150"
        style="border-bottom: 1px solid var(--color-border-secondary); text-decoration: none; color: inherit;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <div class="flex items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-base font-semibold" style="color: var(--color-text-primary);">{mivtza.shem}</span>
              <StatusBadge status={mivtza.status} />
              <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">
                {typeIcon[mivtza.type]} {formatMivtzaType(mivtza.type)}
              </span>
              <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">
                {mivtzaCategoryLabel(mivtza.category)}
              </span>
              {#if mivtza.isGlobal}
                <span class="badge" style="background-color: rgba(27,79,114,0.1); color: var(--color-accent-primary);">🌐 גלובלי</span>
              {:else if makom}
                <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);">{makom.shem}</span>
              {/if}
            </div>
            {#if mivtza.researchQuestion}
              <p class="text-sm italic mb-2" style="color: var(--color-accent-primary);">"{mivtza.researchQuestion}"</p>
            {:else}
              <p class="text-sm mb-2 line-clamp-2" style="color: var(--color-text-secondary);">{mivtza.description}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
              {#if creator}
                <span class="text-sm" style="color: var(--color-text-secondary);">
                  פתח: <span style="color: var(--color-text-primary);">{creator.shem}</span>
                </span>
              {/if}
              <span class="text-sm font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(mivtza.tokenAllocation)}</span>
              <span class="text-sm" style="color: var(--color-text-secondary);">{masimot.length} חיבורים · {mivtza.enrolledIds.length} חברים</span>
              {#if mivtza.deadline}
                {@const dl = formatDeadline(mivtza.deadline)}
                <span class="text-sm" style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-secondary)'};">{dl.text}</span>
              {/if}
            </div>
            <div class="flex flex-wrap gap-1 mt-2">
              {#each mivtza.topics as tag}
                <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">{tag}</span>
              {/each}
            </div>
          </div>
          <!-- Progress -->
          <div class="flex-shrink-0 w-32 flex flex-col items-end gap-2">
            <span class="text-sm font-mono" style="color: var(--color-text-secondary);">{progress}%</span>
            <ProgressBar value={progress} max={100} showLabel={false} color="token" size="md" />
            <span class="text-xs" style="color: var(--color-text-secondary);">
              {masimot.filter(m => m.status === 'approved' || m.status === 'published').length}/{masimot.length} חיבורים
            </span>
          </div>
        </div>
      </a>
    {:else}
      <EmptyState icon="◈" title="לא נמצאו חבורות" description="נסה לשנות את הסינון" />
    {/each}
  </div>
</div>
