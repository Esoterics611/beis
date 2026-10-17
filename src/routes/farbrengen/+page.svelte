<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { formatDate } from '$lib/utils/format';

  let activeTab = $state<'stream'|'maamarim'|'farbrengens'>('stream');

  const activityIcons: Record<string,string> = {
    mivtza_created:'◈', masima_opened:'⎇', masima_completed:'●', tafkid_completed:'●',
    tafkid_submitted:'▸', tafkid_approved:'✓', peer_review_submitted:'◑',
    talmid_promoted:'★', talmid_enrolled:'⬡',
    tmim_distributed:'◆', farbrengen_announced:'◆', maamar_shared:'◈',
  };

</script>

<div class="page-container space-y-6">
  <div>
    <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">פארבריינגען</h1>
    <p class="text-sm mt-1" style="color: var(--color-text-secondary);">מאמרים, פגישות, ופעילות בית המדרש</p>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1" style="border-bottom: 1px solid var(--color-border-primary); padding-bottom: 0;">
    {#each ([
      { k: 'stream',       l: 'עדכונים' },
      { k: 'maamarim',    l: 'מאמרים' },
      { k: 'farbrengens', l: 'פארבריינגען' },
    ]) as t}
      <button
        onclick={() => activeTab = t.k as typeof activeTab}
        class="px-4 py-2.5 text-sm font-medium transition-all duration-150"
        style="
          background: none; border: none; cursor: pointer; margin-bottom: -1px;
          color: {activeTab === t.k ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
          border-bottom: 2px solid {activeTab === t.k ? 'var(--color-accent-primary)' : 'transparent'};
        "
      >{t.l}</button>
    {/each}
  </div>

  {#if activeTab === 'stream'}
    <div class="space-y-2">
      {#each app.activities as activity}
        <div
          class="flex gap-4 px-5 py-4 transition-colors duration-150"
          style="
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-xl);
            background-color: var(--color-bg-secondary);
          "
        >
          <div
            class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm"
            style="
              border-radius: var(--radius-lg);
              background-color: var(--color-bg-tertiary);
              border: 1px solid var(--color-border-primary);
              color: var(--color-text-tertiary);
            "
          >
            {activityIcons[activity.type] ?? '·'}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm" style="color: var(--color-text-primary);">
              <span class="font-medium" style="color: var(--color-accent-secondary);">{activity.actorShem}</span>
              {' '}{activity.description}{' '}
              <span class="font-medium">{activity.targetTitle}</span>
            </p>
            <span class="text-xs" style="color: var(--color-text-secondary);">{formatDate(activity.timestamp)}</span>
          </div>
        </div>
      {:else}
        <div class="text-center py-12 text-sm" style="color: var(--color-text-tertiary);">אין פעילות אחרונה</div>
      {/each}
    </div>

  {:else if activeTab === 'maamarim'}
    <div class="grid gap-4">
      {#each app.maamarim as m}
        {@const author = app.getTalmid(m.authorId)}
        <div
          class="p-5"
          style="
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-xl);
            background-color: var(--color-bg-secondary);
          "
        >
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="text-base font-semibold" style="color: var(--color-text-primary);">{m.title}</h3>
                {#if m.hemshechNumber}
                  <span
                    class="text-[10px] px-2 py-0.5"
                    style="border-radius: 9999px; background-color: rgba(124,58,237,0.1); color: #7c3aed;"
                  >המשך #{m.hemshechNumber}</span>
                {/if}
              </div>
              {#if m.hemshech}
                <span
                  class="text-[10px] px-2 py-0.5"
                  style="border-radius: 9999px; color: var(--color-text-tertiary); background-color: var(--color-bg-tertiary);"
                >{m.hemshech}</span>
              {/if}
            </div>
            <span class="text-[10px] flex-shrink-0" style="color: var(--color-text-tertiary);">{formatDate(m.sharedAt)}</span>
          </div>
          <p class="text-sm leading-relaxed mb-3" style="color: var(--color-text-secondary);">{m.summary}</p>
          {#if author}
            <p class="text-sm mb-2" style="color: var(--color-text-secondary);">מאת: <span style="color: var(--color-text-primary);">{author.shem}</span></p>
          {/if}
          <div class="flex flex-wrap gap-1">
            {#each m.tags as topic}
              <span
                class="text-[10px] px-2 py-0.5"
                style="border-radius: 9999px; background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);"
              >{topic}</span>
            {/each}
          </div>
        </div>
      {:else}
        <div class="text-center py-12 text-sm" style="color: var(--color-text-tertiary);">אין מאמרים עדיין</div>
      {/each}
    </div>

  {:else}
    <div class="grid gap-4">
      {#each app.farbrengens as f}
        <div
          class="p-5"
          style="
            border: 1px solid {f.status === 'upcoming' ? 'rgba(125,108,63,0.4)' : 'var(--color-border-primary)'};
            border-radius: var(--radius-xl);
            background-color: var(--color-bg-secondary);
          "
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                {#if f.status === 'upcoming'}
                  <span
                    class="text-[10px] px-2 py-0.5"
                    style="border-radius: 9999px; background-color: rgba(125,108,63,0.1); color: var(--color-accent-secondary);"
                  >קרוב</span>
                {:else}
                  <span
                    class="text-[10px] px-2 py-0.5"
                    style="border-radius: 9999px; background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);"
                  >הסתיים</span>
                {/if}
                <h3 class="text-base font-semibold" style="color: var(--color-text-primary);">{f.title}</h3>
              </div>
              <p class="text-sm mb-2" style="color: var(--color-text-secondary);">{f.description}</p>
              <div class="flex items-center gap-4 text-sm flex-wrap" style="color: var(--color-text-secondary);">
                <span class="font-mono">{new Date(f.scheduledAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span>👥 {f.attendeeIds.length} משתתפים</span>
              </div>
            </div>
          </div>
          {#if f.status === 'upcoming'}
            <div class="mt-4">
              <button
                class="px-4 py-2 text-sm font-medium transition-colors duration-150"
                style="
                  background-color: rgba(125,108,63,0.1);
                  border: 1px solid rgba(125,108,63,0.3);
                  border-radius: var(--radius-md);
                  color: var(--color-accent-secondary);
                  cursor: pointer;
                "
                onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.2)'; }}
                onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.1)'; }}
              >הוסף ליומן</button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="text-center py-12 text-sm" style="color: var(--color-text-tertiary);">אין פארבריינגענס</div>
      {/each}
    </div>
  {/if}
</div>
