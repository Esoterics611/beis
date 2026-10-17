<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { formatTmim } from '$lib/utils/format';
  import TalmidAvatar from '$components/TalmidAvatar.svelte';
  import RankInsignia from '$components/RankInsignia.svelte';
  import RankBadge from '$components/RankBadge.svelte';
  import LocationBadge from '$components/LocationBadge.svelte';

  let view           = $state<'roster' | 'groups'>('roster');
  let locationFilter = $state<string>('all');

  const tiers = [
    { label: 'מורים',    tiers: ['officer'], color: 'var(--color-tier-officer)' },
    { label: 'בקיאים',   tiers: ['nco'],     color: 'var(--color-tier-nco)' },
    { label: 'מתחילים', tiers: ['enlisted'], color: 'var(--color-tier-enlisted)' },
  ];

  function scoreTier(score: number): string {
    if (score >= 10000) return 'officer';
    if (score >= 1000)  return 'nco';
    return 'enlisted';
  }

  function getTalmidimByTier(tierNames: string[]) {
    return app.talmidim.filter(t => {
      const matchTier     = tierNames.includes(scoreTier(t.contribution_score));
      const matchLocation = locationFilter === 'all' || t.makomId === locationFilter;
      return matchTier && matchLocation;
    });
  }
</script>

<div class="page-container space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">חברים</h1>
      <p class="text-sm mt-1" style="color: var(--color-text-secondary);">כל חברי הרשת</p>
    </div>
    <div class="flex gap-2 flex-wrap">
      <!-- Location filter -->
      <select
        bind:value={locationFilter}
        style="
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: 0.75rem;
          font-family: var(--font-hebrew);
          outline: none;
        "
      >
        <option value="all">כל המקומות</option>
        {#each app.mekomot as makom}
          <option value={makom.id}>{makom.shem}</option>
        {/each}
      </select>
      <!-- View toggle -->
      <div
        class="flex gap-1 p-1"
        style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg);"
      >
        {#each ([['roster', 'רשימה'], ['groups', 'קבוצות']] as const) as [v, l]}
          <button
            onclick={() => view = v}
            class="px-3 py-1.5 text-xs font-medium transition-all duration-150"
            style="
              border-radius: var(--radius-sm);
              color: {view === v ? 'var(--color-accent-secondary)' : 'var(--color-text-tertiary)'};
              background-color: {view === v ? 'rgba(125,108,63,0.1)' : 'transparent'};
            "
          >{l}</button>
        {/each}
      </div>
    </div>
  </div>

  {#if view === 'roster'}
    <div class="space-y-8">
      {#each tiers as tier}
        {@const members = getTalmidimByTier(tier.tiers)}
        {#if members.length > 0}
          <div>
            <h3 class="text-xs uppercase tracking-wider mb-3 px-1 font-semibold" style="color: {tier.color};">
              {tier.label} ({members.length})
            </h3>
            <div
              style="
                border: 1px solid var(--color-border-primary);
                border-radius: var(--radius-xl);
                background-color: var(--color-bg-secondary);
                overflow: hidden;
              "
            >
              {#each members as t}
                {@const makom = app.getMakom(t.makomId)}
                <a
                  href="/anash/{t.id}"
                  class="flex items-center gap-4 px-6 py-4 transition-colors duration-150"
                  style="border-bottom: 1px solid var(--color-border-secondary); text-decoration: none; color: inherit;"
                  onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                  onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <TalmidAvatar shem={t.shem} score={t.contribution_score} isOnline={t.isOnline} size="md" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="text-base font-semibold" style="color: var(--color-text-primary);">{t.shem}</span>
                      <RankBadge score={t.contribution_score} size="sm" />
                      {#if makom}
                        <LocationBadge shem={makom.shem} status={makom.status} />
                      {/if}
                      {#if t.isOnline}
                        <span
                          class="inline-block w-1.5 h-1.5 rounded-full"
                          style="background-color: var(--color-status-success);"
                        ></span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-4 text-sm flex-wrap" style="color: var(--color-text-secondary);">
                      <span>מסלול: {t.track}</span>
                      <span class="font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenBalance)}</span>
                      <span>{t.seifimCompleted} שלבים · {t.papersPublished} מאמרים</span>
                    </div>
                  </div>
                  <RankInsignia score={t.contribution_score} size="md" />
                </a>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>

  {:else}
    <!-- Groups hierarchy -->
    <div class="space-y-4">
      {#each app.groups.filter(g => g.type === 'zal') as zal}
        <div
          style="
            border: 1px solid var(--color-accent-secondary);
            border-radius: var(--radius-xl);
            background-color: var(--color-bg-secondary);
            padding: 1rem;
          "
        >
          <div class="flex items-center gap-3 mb-4">
            <span style="color: var(--color-accent-secondary);">◆</span>
            <div>
              <p class="text-base font-semibold" style="color: var(--color-text-primary);">{zal.name}</p>
              <p class="text-sm" style="color: var(--color-text-secondary);">{zal.memberIds.length} חברים</p>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mr-4">
            {#each app.groups.filter(g => g.type === 'shiur' && g.parentGroupId === zal.id) as shiurGroup}
              <div
                style="
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-lg);
                  background-color: var(--color-bg-tertiary);
                  padding: 0.75rem;
                "
              >
                <div class="flex items-center gap-2 mb-2">
                  <span style="color: var(--color-accent-primary);">◈</span>
                  <p class="text-sm font-semibold" style="color: var(--color-text-primary);">{shiurGroup.name}</p>
                </div>
                <div class="space-y-1.5">
                  {#each shiurGroup.memberIds as mid}
                    {@const m = app.getTalmid(mid)}
                    {#if m}
                      <a
                        href="/anash/{m.id}"
                        class="flex items-center gap-2 px-2 py-1.5 transition-colors duration-150"
                        style="border-radius: var(--radius-sm); text-decoration: none;"
                        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-secondary)'; }}
                        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        <TalmidAvatar shem={m.shem} score={m.contribution_score} isOnline={m.isOnline} size="sm" />
                        <span class="text-sm" style="color: var(--color-text-primary);">{m.shem}</span>
                        <RankBadge score={m.contribution_score} size="sm" />
                      </a>
                    {/if}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
