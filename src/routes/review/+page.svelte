<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDate } from '$lib/utils/format';
  import TalmidAvatar from '$components/TalmidAvatar.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import EmptyState from '$components/EmptyState.svelte';

  let activeTab     = $state<'masimot' | 'tafkidim'>('masimot');
  let expandedMasima = $state<string | null>(null);
  let reviewText    = $state<Record<string, string>>({});

  let pendingMasimot  = $derived(app.masimot.filter(m => m.status === 'in_review' || m.status === 'submitted'));
  let pendingSeifim = $derived(app.tafkidim.filter(t => t.status === 'submitted'));
</script>

<div class="page-container space-y-6">
  <div>
    <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">חדר המשפיע</h1>
    <p class="text-sm mt-1" style="color: var(--color-text-secondary);">בדיקת עבודות ואישור שלבים</p>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1" style="border-bottom: 1px solid var(--color-border-primary); padding-bottom: 0;">
    {#each ([
      { k: 'masimot',  l: 'חיבורים לאישור',  n: pendingMasimot.length },
      { k: 'tafkidim', l: 'הגשות שלבים', n: pendingSeifim.length },
    ]) as t}
      <button
        onclick={() => activeTab = t.k as typeof activeTab}
        class="px-4 py-2.5 text-sm font-medium transition-all duration-150"
        style="
          background: none; border: none; cursor: pointer; margin-bottom: -1px;
          color: {activeTab === t.k ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
          border-bottom: 2px solid {activeTab === t.k ? 'var(--color-accent-primary)' : 'transparent'};
        "
      >
        {t.l}
        {#if t.n > 0}
          <span
            class="mr-1.5 px-1.5 py-0.5 text-[10px]"
            style="
              border-radius: 9999px;
              background-color: {activeTab === t.k ? 'rgba(27,79,114,0.15)' : 'var(--color-bg-tertiary)'};
              color: {activeTab === t.k ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)'};
            "
          >{t.n}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if activeTab === 'masimot'}
    <div class="space-y-3">
      {#each pendingMasimot as m}
        {@const mivtza   = app.getMivtza(m.chaburahId)}
        {@const assignee = m.assigneeId ? app.getTalmid(m.assigneeId) : null}
        {@const tafkidim = app.getMasimaTafkidim(m.id)}
        {@const reviews  = app.getMasimaPeerReviews(m.id)}
        <div
          style="
            border: 1px solid rgba(27,79,114,0.3);
            border-radius: var(--radius-xl);
            background-color: var(--color-bg-secondary);
            overflow: hidden;
          "
        >
          <button
            onclick={() => expandedMasima = expandedMasima === m.id ? null : m.id}
            class="w-full flex items-center gap-4 px-6 py-4 text-right transition-colors duration-150"
            style="background: none; border: none; cursor: pointer; width: 100%;"
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <span style="color: var(--color-accent-primary); font-size: 1.125rem;">◑</span>
            <div class="flex-1 min-w-0 text-right">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base font-semibold" style="color: var(--color-text-primary);">{m.shem}</span>
                <StatusBadge status={m.status} />
                {#if reviews.length > 0}
                  <span class="text-xs" style="color: var(--color-accent-primary);">{reviews.length} ביקורות עמיתים</span>
                {/if}
              </div>
              <p class="text-sm" style="color: var(--color-text-secondary);">{mivtza?.shem ?? ''} · {tafkidim.length} שלבים</p>
            </div>
            {#if assignee}
              <div class="flex items-center gap-2 flex-shrink-0">
                <TalmidAvatar shem={assignee.shem} score={assignee.contribution_score} isOnline={assignee.isOnline} size="sm" />
                <span class="text-xs" style="color: var(--color-text-secondary);">{assignee.shem}</span>
              </div>
            {/if}
            <span class="text-xs font-mono font-semibold flex-shrink-0" style="color: var(--color-accent-secondary);">{formatTmim(m.tokenAllocation)}</span>
            <span style="color: var(--color-text-tertiary);">{expandedMasima === m.id ? '▴' : '▾'}</span>
          </button>

          {#if expandedMasima === m.id}
            <div
              class="px-6 pb-5 pt-4 space-y-4"
              style="border-top: 1px solid var(--color-border-primary);"
            >
              <p class="text-sm" style="color: var(--color-text-secondary);">{m.description}</p>

              {#if m.contentUrl}
                <div
                  class="p-3"
                  style="background-color: rgba(27,79,114,0.06); border: 1px solid rgba(27,79,114,0.2); border-radius: var(--radius-md);"
                >
                  <p class="text-xs" style="color: var(--color-accent-primary);">קישור: <a href={m.contentUrl} target="_blank" style="text-decoration: underline;">{m.contentUrl}</a></p>
                </div>
              {/if}

              {#if m.submissionNotes}
                <div class="p-3 callout">
                  <p class="text-xs mb-1" style="color: var(--color-text-tertiary);">הערות הגשה:</p>
                  <p class="text-sm" style="color: var(--color-text-primary);">{m.submissionNotes}</p>
                </div>
              {/if}

              {#if reviews.length > 0}
                <div
                  class="p-3"
                  style="background-color: rgba(27,79,114,0.04); border: 1px solid rgba(27,79,114,0.15); border-radius: var(--radius-md);"
                >
                  <p class="text-xs font-semibold mb-2" style="color: var(--color-accent-primary);">ביקורות עמיתים ({reviews.length})</p>
                  {#each reviews as r}
                    {@const rv = app.getTalmid(r.reviewerId)}
                    <div class="flex items-center gap-2 text-xs mb-1">
                      <span style="color: var(--color-text-secondary);">{rv?.shem ?? 'מבקר'}</span>
                      <span style="color: var(--color-accent-secondary);">{'★'.repeat(r.rating)}</span>
                      <span class="flex-1 truncate" style="color: var(--color-text-secondary);">{r.comments}</span>
                    </div>
                  {/each}
                </div>
              {/if}

              <textarea
                bind:value={reviewText[m.id]}
                placeholder="הערת המשפיע (אופציונלי)..."
                rows={2}
                dir="rtl"
                style="
                  width: 100%;
                  padding: 0.625rem 0.75rem;
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  background-color: var(--color-bg-primary);
                  color: var(--color-text-primary);
                  font-size: 0.875rem;
                  font-family: var(--font-hebrew);
                  resize: none;
                  outline: none;
                "
              ></textarea>
              <div class="flex gap-3 flex-wrap">
                <button
                  onclick={() => { if (m.status === 'submitted') app.startReviewMasima(m.id); app.approveMasima(m.id); }}
                  class="px-4 py-2 text-sm font-semibold transition-colors duration-150"
                  style="
                    background-color: rgba(30,111,80,0.1);
                    border: 1px solid rgba(30,111,80,0.3);
                    color: var(--color-status-success);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                  "
                >✓ אשר חיבור</button>
                <button
                  onclick={() => { if (m.status === 'submitted') app.startReviewMasima(m.id); app.requestRevisionMasima(m.id, reviewText[m.id]); }}
                  class="px-4 py-2 text-sm font-semibold transition-colors duration-150"
                  style="
                    background-color: rgba(146,64,14,0.1);
                    border: 1px solid rgba(146,64,14,0.3);
                    color: var(--color-status-warning);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                  "
                >↩ בקש תיקון</button>
                <button
                  onclick={() => app.updateMasima(m.id, { status: 'open', submissionNotes: reviewText[m.id] || undefined })}
                  class="px-4 py-2 text-sm font-semibold transition-colors duration-150"
                  style="
                    background-color: rgba(185,28,28,0.08);
                    border: 1px solid rgba(185,28,28,0.25);
                    color: var(--color-status-error);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                  "
                >✕ דחה</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <EmptyState icon="◑" title="אין חיבורים לבדיקה" description="כל החיבורים נבדקו" />
      {/each}
    </div>

  {:else}
    <!-- Tafkidim submissions -->
    <div
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      {#each pendingSeifim as t}
        {@const masima = app.getMasima(t.chibburId)}
        {@const mivtza = app.getMivtza(t.chaburahId)}
        {@const a      = t.assigneeId ? app.getTalmid(t.assigneeId) : null}
        <div class="px-6 py-5 space-y-4" style="border-bottom: 1px solid var(--color-border-secondary);">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-base font-semibold" style="color: var(--color-text-primary);">{t.shem}</span>
                <StatusBadge status={t.status} />
              </div>
              <p class="text-sm" style="color: var(--color-text-secondary);">{mivtza?.shem ?? ''} · {masima?.shem ?? ''}</p>
              {#if t.submissionNotes}
                <p class="text-sm mt-2" style="color: var(--color-text-secondary);">{t.submissionNotes}</p>
              {/if}
            </div>
            {#if a}
              <div class="flex items-center gap-2 flex-shrink-0">
                <TalmidAvatar shem={a.shem} score={a.contribution_score} isOnline={a.isOnline} size="md" />
                <div>
                  <p class="text-sm font-semibold" style="color: var(--color-text-primary);">{a.shem}</p>
                  <p class="text-sm" style="color: var(--color-text-secondary);">{a.track}</p>
                </div>
              </div>
            {/if}
          </div>
          <div class="flex items-center justify-between">
            <div class="flex gap-3">
              <button
                onclick={() => app.approveTafkid(t.id)}
                class="px-4 py-2 text-sm font-semibold transition-colors duration-150"
                style="
                  background-color: rgba(30,111,80,0.1);
                  border: 1px solid rgba(30,111,80,0.3);
                  color: var(--color-status-success);
                  border-radius: var(--radius-md);
                  cursor: pointer;
                "
              >✓ אשר</button>
              <button
                onclick={() => app.rejectTafkid(t.id)}
                class="px-4 py-2 text-sm font-semibold transition-colors duration-150"
                style="
                  background-color: rgba(185,28,28,0.08);
                  border: 1px solid rgba(185,28,28,0.25);
                  color: var(--color-status-error);
                  border-radius: var(--radius-md);
                  cursor: pointer;
                "
              >✕ דחה</button>
            </div>
            <span class="text-xs font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenReward)}</span>
          </div>
        </div>
      {:else}
        <EmptyState icon="◑" title="אין הגשות לבדיקה" description="כל השלבים נבדקו" />
      {/each}
    </div>
  {/if}
</div>
