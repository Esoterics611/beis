<script lang="ts">
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import { formatTmim, formatDeadline, mivtzaCategoryLabel, formatMivtzaType, formatPublicationFormat, formatPublicationLicense } from '$lib/utils/format';
  import ProgressBar from '$components/ProgressBar.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import TalmidAvatar from '$components/TalmidAvatar.svelte';
  import RankBadge from '$components/RankBadge.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import PeerReviewCard from '$components/PeerReviewCard.svelte';
  import ConfirmDialog from '$components/ConfirmDialog.svelte';

  let id = $derived($page.params.id ?? '');
  let mivtza = $derived(app.getMivtza(id));
  let masimot = $derived(mivtza ? app.getMivtzaMasimot(mivtza.id) : []);
  let tafkidim = $derived(mivtza ? app.getMivtzaTafkidim(mivtza.id) : []);
  let enrolled = $derived(mivtza ? app.getMivtzaEnrolled(mivtza.id) : []);
  let creator = $derived(mivtza ? app.getTalmid(mivtza.creatorId) : null);
  let makom = $derived(mivtza ? app.getMakom(mivtza.locationId) : null);
  let progress = $derived(mivtza ? app.getMivtzaProgress(mivtza.id) : 0);
  let allReviews = $derived(masimot.flatMap(m => app.getMasimaPeerReviews(m.id)));

  let hasPublication = $derived(!!mivtza?.publicationMeta);
  let activeTab = $state<'masimot'|'tafkidim'|'chayalim'|'bikurot'|'publication'>('masimot');

  // Contributor stats for publication dashboard
  let contributorStats = $derived(enrolled.map(t => {
    if (!t) return null;
    const completed = masimot.filter(m => m.assigneeId === t.id && (m.status === 'approved' || m.status === 'published')).length;
    const tmimEarned = masimot
      .filter(m => m.assigneeId === t.id && (m.status === 'approved' || m.status === 'published'))
      .reduce((sum, m) => sum + m.tokenAllocation, 0);
    return { talmid: t, completed, tmimEarned };
  }).filter(Boolean));

  let isEnrolled = $derived(mivtza?.enrolledIds.includes(app.currentUserId ?? '') ?? false);
  let showDeleteConfirm = $state(false);
  let showUnenrollConfirm = $state(false);

  const mStatus: Record<string,string> = {
    open:'○', in_progress:'◐', submitted:'◑', in_review:'◑',
    revision_requested:'↺', approved:'●', published:'✦'
  };
  const tStatus: Record<string,string> = {
    todo:'○', in_progress:'◐', submitted:'◑', approved:'●', rejected:'✕'
  };
  const priColors: Record<string,string> = {
    low: 'var(--color-text-tertiary)',
    medium: 'var(--color-accent-primary)',
    high: 'var(--color-status-warning)',
    critical: 'var(--color-status-error)',
  };
</script>

{#if mivtza}
<div class="page-container space-y-6">
  <!-- ניווט -->
  <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-tertiary);">
    <a href="/chaburot" style="color: var(--color-text-tertiary); text-decoration: none;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-secondary)'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}>חבורות</a>
    <span>/</span>
    <span style="color: var(--color-text-primary);">{mivtza.shem}</span>
  </div>

  <!-- כרטיס ראשי -->
  <div
    class="p-6"
    style="
      border: 1px solid rgba(125,108,63,0.3);
      border-radius: var(--radius-xl);
      background-color: var(--color-bg-secondary);
    "
  >
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 mb-2 flex-wrap">
          <h2 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">{mivtza.shem}</h2>
          <StatusBadge status={mivtza.status} size="md" />
          <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">{formatMivtzaType(mivtza.type)}</span>
          <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary);">{mivtzaCategoryLabel(mivtza.category)}</span>
          {#if mivtza.isGlobal}
            <span class="badge" style="background-color: rgba(27,79,114,0.1); color: var(--color-accent-primary); border: 1px solid rgba(27,79,114,0.2);">🌐 גלובלי</span>
          {/if}
        </div>
        {#if mivtza.researchQuestion}
          <p class="text-sm italic mb-3" style="color: var(--color-accent-primary);">"{mivtza.researchQuestion}"</p>
        {/if}
        <p class="text-sm mb-4" style="color: var(--color-text-secondary);">{mivtza.description}</p>
        <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs" style="color: var(--color-text-tertiary);">
          {#if creator}<span>פתח: <span style="color: var(--color-text-primary);">{creator.shem}</span></span>{/if}
          {#if makom}<span>מיקום: <span style="color: var(--color-text-primary);">{makom.shem}</span></span>{/if}
          <span class="font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(mivtza.tokenAllocation)}</span>
          <span>{masimot.length} חיבורים · {tafkidim.length} שלבים</span>
          {#if mivtza.deadline}
            {@const dl = formatDeadline(mivtza.deadline)}
            <span style="color: {dl.urgent ? 'var(--color-status-error)' : 'var(--color-text-tertiary)'};">{dl.text}</span>
          {/if}
        </div>
        <div class="flex flex-wrap gap-1 mt-3">
          {#each mivtza.topics as tag}
            <span class="badge" style="background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);">{tag}</span>
          {/each}
        </div>
      </div>
      <div class="flex-shrink-0 w-36 space-y-3">
        <div class="text-center">
          <span class="text-3xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{progress}%</span>
          <p class="text-[10px] mb-1" style="color: var(--color-text-tertiary);">התקדמות</p>
          <ProgressBar value={progress} max={100} color="token" />
          <div class="mt-2 text-[10px]" style="color: var(--color-text-tertiary);">
            <div>תקציב: {formatTmim(mivtza.tokenAllocation)}</div>
            <div style="color: var(--color-accent-secondary);">שומש: {formatTmim(mivtza.tokensUsed)}</div>
          </div>
        </div>
        {#if isEnrolled}
          <button
            onclick={() => showUnenrollConfirm = true}
            class="w-full py-2 text-xs transition-colors duration-150"
            style="
              border: 1px solid var(--color-border-primary);
              border-radius: var(--radius-md);
              color: var(--color-text-secondary);
              background: none;
              cursor: pointer;
            "
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(185,28,28,0.4)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-status-error)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; }}
          >עזוב חבורה</button>
        {:else}
          <button
            onclick={() => { if (app.currentUserId) app.enrollInMivtza(app.currentUserId, mivtza!.id); }}
            class="w-full py-2 text-xs font-medium transition-colors duration-150"
            style="
              background-color: rgba(125,108,63,0.1);
              border: 1px solid rgba(125,108,63,0.3);
              border-radius: var(--radius-md);
              color: var(--color-accent-secondary);
              cursor: pointer;
            "
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.2)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.1)'; }}
          >הצטרף לחבורה</button>
        {/if}
        {#if app.isMashpia}
          <button
            onclick={() => showDeleteConfirm = true}
            class="w-full py-1.5 text-[10px] transition-colors duration-150"
            style="
              background-color: rgba(185,28,28,0.08);
              border: 1px solid rgba(185,28,28,0.2);
              border-radius: var(--radius-md);
              color: var(--color-status-error);
              cursor: pointer;
            "
          >מחק חבורה</button>
        {/if}
      </div>
    </div>
  </div>

  <!-- טאבים -->
  <div class="flex gap-1" style="border-bottom: 1px solid var(--color-border-primary); padding-bottom: 0;">
    {#each ([
      { k: 'masimot',     l: 'חיבורים',    n: masimot.length },
      { k: 'tafkidim',   l: 'שלבים',   n: tafkidim.length },
      { k: 'chayalim',   l: 'חברים',    n: enrolled.length },
      { k: 'bikurot',    l: 'ביקורות',   n: allReviews.length },
      ...(hasPublication ? [{ k: 'publication', l: '📖 פרסום', n: 0 }] : []),
    ]) as t}
      <button
        onclick={() => activeTab = t.k as typeof activeTab}
        class="px-4 py-2.5 text-sm font-medium transition-all duration-150"
        style="
          background: none; border: none; cursor: pointer; margin-bottom: -1px;
          color: {activeTab === t.k ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
          border-bottom: 2px solid {activeTab === t.k ? 'var(--color-accent-primary)' : 'transparent'};
        "
      >{t.l} <span style="opacity: 0.6; font-size: 0.75rem;">({t.n})</span></button>
    {/each}
  </div>

  <!-- חיבורים -->
  {#if activeTab === 'masimot'}
    {#if app.isMashpia}
      <div class="flex items-center justify-end gap-2">
        {#if hasPublication}
          <a
            href="/chaburot/{mivtza.id}/wizard"
            class="px-3 py-1.5 text-xs font-medium transition-colors duration-150"
            style="background-color: var(--color-accent-secondary-light); border: 1px solid var(--color-accent-secondary); border-radius: var(--radius-md); color: var(--color-accent-secondary); text-decoration: none;"
          >אשף יצירת חיבורים</a>
        {/if}
        <a
          href="/chibburim/new?mivtzaId={mivtza.id}"
          class="px-3 py-1.5 text-xs font-medium transition-colors duration-150"
          style="background-color: rgba(125,108,63,0.1); border: 1px solid rgba(125,108,63,0.3); border-radius: var(--radius-md); color: var(--color-accent-secondary); text-decoration: none;"
        >+ חיבור חדש</a>
      </div>
    {:else if !enrolled.find(t => t?.id === app.currentUserId)}
      <div class="flex justify-end">
        <a
          href="/chaburot/{mivtza.id}/apply"
          class="px-3 py-1.5 text-xs font-medium transition-colors duration-150"
          style="background-color: var(--color-accent-secondary-light); border: 1px solid var(--color-accent-secondary); border-radius: var(--radius-md); color: var(--color-accent-secondary); text-decoration: none;"
        >הגש מועמדות לתרום</a>
      </div>
    {/if}
    <div
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      {#each masimot as m}
        {@const assignee = m.assigneeId ? app.getTalmid(m.assigneeId) : null}
        {@const reviewCount = app.getMasimaPeerReviews(m.id).length}
        <a
          href="/chibburim/{m.id}"
          class="flex items-center gap-4 px-6 py-4 transition-colors duration-150"
          style="border-bottom: 1px solid var(--color-border-secondary); text-decoration: none; color: inherit;"
          onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
          onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <span class="text-lg w-5 text-center flex-shrink-0" style="color: var(--color-text-tertiary);">{mStatus[m.status] ?? '○'}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium" style="color: var(--color-text-primary);">{m.shem}</span>
              <StatusBadge status={m.status} />
            </div>
            <div class="flex items-center gap-4 text-xs flex-wrap" style="color: var(--color-text-tertiary);">
              {#if assignee}
                <TalmidAvatar shem={assignee.shem} score={assignee.contribution_score} size="sm" />
                <span>{assignee.shem}</span>
              {:else}
                <span style="color: var(--color-accent-secondary);">פנוי</span>
              {/if}
              {#if reviewCount > 0}
                <span style="color: #7c3aed;">{reviewCount} ביקורות · ★ {m.averageRating?.toFixed(1) ?? '-'}</span>
              {/if}
              <span>{formatTmim(m.tokenAllocation)}</span>
            </div>
          </div>
          <ProgressBar value={app.getMasimaProgress(m.id)} color="primary" showLabel />
        </a>
      {:else}
        <EmptyState icon="⎇" title="אין חיבורים" description="לא נוספו חיבורים לחבורה זו" />
      {/each}
    </div>

  <!-- שלבים -->
  {:else if activeTab === 'tafkidim'}
    <div
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      {#each tafkidim as t}
        {@const masima = app.getMasima(t.chibburId)}
        {@const a = t.assigneeId ? app.getTalmid(t.assigneeId) : null}
        <div class="flex items-center gap-4 px-6 py-4" style="border-bottom: 1px solid var(--color-border-secondary);">
          <div class="w-1.5 h-8 rounded-full flex-shrink-0" style="background-color: {priColors[t.priority] ?? 'var(--color-text-tertiary)'};"></div>
          <span class="w-5 text-center flex-shrink-0" style="color: var(--color-text-tertiary);">{tStatus[t.status] ?? '○'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate" style="color: var(--color-text-primary);">{t.shem}</p>
            <p class="text-xs" style="color: var(--color-text-tertiary);">{masima?.shem ?? ''}</p>
          </div>
          {#if a}
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <TalmidAvatar shem={a.shem} score={a.contribution_score} size="sm" />
              <span class="text-xs" style="color: var(--color-text-secondary);">{a.shem}</span>
            </div>
          {/if}
          <StatusBadge status={t.status} />
          <span class="text-xs font-mono font-semibold flex-shrink-0" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenReward)}</span>
        </div>
      {:else}
        <EmptyState icon="▸" title="אין שלבים" />
      {/each}
    </div>

  <!-- חברים -->
  {:else if activeTab === 'chayalim'}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each enrolled as t}
        {#if t}
          <a
            href="/anash/{t.id}"
            class="p-4 flex flex-col items-center gap-2 text-center transition-colors duration-150"
            style="
              border: 1px solid var(--color-border-primary);
              border-radius: var(--radius-xl);
              background-color: var(--color-bg-secondary);
              text-decoration: none;
            "
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-secondary)'; }}
          >
            <TalmidAvatar shem={t.shem} score={t.contribution_score} isOnline={t.isOnline} size="lg" />
            <span class="text-sm font-medium" style="color: var(--color-text-primary);">{t.shem}</span>
            <RankBadge score={t.contribution_score} size="sm" />
            <div class="text-[10px] space-y-0.5" style="color: var(--color-text-tertiary);">
              <div>{t.seifimCompleted} שלבים</div>
              <div class="font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenBalance)}</div>
            </div>
          </a>
        {/if}
      {:else}
        <EmptyState icon="⬡" title="אין חברים" />
      {/each}
    </div>

  <!-- פרסום -->
  {:else if activeTab === 'publication' && mivtza.publicationMeta}
    {@const pub = mivtza.publicationMeta}
    <div class="space-y-5">
      <!-- כרטיס פרטי הפרסום -->
      <div class="rounded-xl border p-5 space-y-4" style="border-color: rgba(122,31,43,0.25); background-color: rgba(122,31,43,0.03);">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-lg font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);" dir="rtl">{pub.titleHebrew}</h3>
            {#if pub.titleEnglish}<p class="text-sm" style="color: var(--color-text-secondary);">{pub.titleEnglish}</p>{/if}
            {#if pub.subtitle}<p class="text-xs italic" style="color: var(--color-text-tertiary);" dir="rtl">{pub.subtitle}</p>{/if}
          </div>
          <div class="flex-shrink-0 text-right space-y-1">
            <div class="text-xs px-2 py-1 rounded" style="background-color: var(--color-accent-secondary-light); color: var(--color-accent-secondary);">{formatPublicationFormat(pub.targetFormat)}</div>
            <div class="text-xs px-2 py-1 rounded" style="background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);">{formatPublicationLicense(pub.license)}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs" style="color: var(--color-text-tertiary);">
          {#if pub.targetAudience}<div><span class="block" style="color: var(--color-text-secondary);">קהל יעד</span>{pub.targetAudience}</div>{/if}
          {#if pub.targetLength}<div><span class="block" style="color: var(--color-text-secondary);">אורך</span>{pub.targetLength} עמ'</div>{/if}
          {#if pub.totalBudgetTmim}<div><span class="block" style="color: var(--color-text-secondary);">תקציב</span><span class="font-mono" style="color: var(--color-accent-secondary);">{formatTmim(pub.totalBudgetTmim)}</span></div>{/if}
          {#if pub.targetDeadline}
            {@const dl = formatDeadline(pub.targetDeadline)}
            <div><span class="block" style="color: var(--color-text-secondary);">יעד פרסום</span><span style="color: {dl.urgent ? 'var(--color-status-error)' : 'inherit'}">{dl.text}</span></div>
          {/if}
        </div>
        {#if pub.manuscriptIpfsCid}
          <div class="flex items-center gap-2 text-xs">
            <span style="color: var(--color-text-secondary);">כתב יד נוכחי (IPFS):</span>
            <a href="https://ipfs.io/ipfs/{pub.manuscriptIpfsCid}" target="_blank" rel="noopener"
              class="font-mono truncate max-w-xs hover:underline" style="color: var(--color-accent-primary);">{pub.manuscriptIpfsCid}</a>
          </div>
        {/if}
      </div>

      <!-- התקדמות ייצור -->
      <div class="grid grid-cols-3 gap-4">
        <div class="p-4 text-center rounded-xl border" style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);">
          <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{progress}%</span>
          <span class="text-[10px]" style="color: var(--color-text-tertiary);">התקדמות ייצור</span>
          <div class="mt-2"><ProgressBar value={progress} max={100} color="token" /></div>
        </div>
        <div class="p-4 text-center rounded-xl border" style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);">
          <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{masimot.filter(m => m.status === 'approved' || m.status === 'published').length}/{masimot.length}</span>
          <span class="text-[10px]" style="color: var(--color-text-tertiary);">חיבורים אושרו</span>
        </div>
        <div class="p-4 text-center rounded-xl border" style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);">
          <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{formatTmim(mivtza.tokensUsed)}</span>
          <span class="text-[10px]" style="color: var(--color-text-tertiary);">מתוך {formatTmim(mivtza.tokenAllocation)}</span>
        </div>
      </div>

      <!-- רשימת תורמים -->
      <div>
        <h4 class="text-sm font-semibold mb-3" style="color: var(--color-text-primary);">תורמי הפרסום</h4>
        {#if contributorStats.length > 0}
          <div class="rounded-xl border overflow-hidden" style="border-color: var(--color-border-primary); background-color: var(--color-bg-secondary);">
            {#each contributorStats as cs}
              {#if cs}
                <div class="flex items-center gap-4 px-5 py-3" style="border-bottom: 1px solid var(--color-border-secondary);">
                  <TalmidAvatar shem={cs.talmid.shem} score={cs.talmid.contribution_score} size="sm" />
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium" style="color: var(--color-text-primary);">{cs.talmid.shem}</span>
                  </div>
                  <RankBadge score={cs.talmid.contribution_score} size="sm" />
                  <div class="text-right text-xs" style="color: var(--color-text-tertiary);">
                    <div>{cs.completed} חיבורים הושלמו</div>
                    <div class="font-mono" style="color: var(--color-accent-secondary);">{formatTmim(cs.tmimEarned)}</div>
                  </div>
                </div>
              {/if}
            {:else}
              <EmptyState icon="⬡" title="אין תורמים עדיין" description="הצטרף לחבורה כדי לתרום לפרסום" />
            {/each}
          </div>
        {:else}
          <EmptyState icon="⬡" title="אין תורמים עדיין" />
        {/if}
      </div>

      <!-- קישור תמיכה -->
      <a
        href="/support?intent=mivtza_{mivtza.id}&title={encodeURIComponent(pub.titleHebrew)}"
        class="flex items-center justify-center gap-2 py-3 rounded-xl border font-medium text-sm transition-colors btn-primary"
        style="border-radius: var(--radius-xl);">
        ❤ תמוך בפרסום זה
      </a>
    </div>

  <!-- ביקורות -->
  {:else if activeTab === 'bikurot'}
    {#if allReviews.length > 0}
      <div class="space-y-4">
        <!-- סטטיסטיקות -->
        <div class="grid grid-cols-3 gap-4">
          <div class="p-4 text-center" style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); background-color: var(--color-bg-secondary);">
            <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{allReviews.length}</span>
            <span class="text-[10px]" style="color: var(--color-text-tertiary);">סה"כ ביקורות</span>
          </div>
          <div class="p-4 text-center" style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); background-color: var(--color-bg-secondary);">
            <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{(allReviews.reduce((s,r)=>s+r.rating,0)/allReviews.length).toFixed(1)}</span>
            <span class="text-[10px]" style="color: var(--color-text-tertiary);">ממוצע דירוג</span>
          </div>
          <div class="p-4 text-center" style="border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); background-color: var(--color-bg-secondary);">
            <span class="text-2xl font-bold font-mono block" style="color: var(--color-status-success);">{allReviews.filter(r=>r.status==='acknowledged').length}</span>
            <span class="text-[10px]" style="color: var(--color-text-tertiary);">נלקחו בחשבון</span>
          </div>
        </div>
        <!-- רשימת ביקורות -->
        <div class="grid gap-4 md:grid-cols-2">
          {#each allReviews as review}
            <PeerReviewCard {review} />
          {/each}
        </div>
      </div>
    {:else}
      <EmptyState icon="◑" title="אין ביקורות עדיין" description="ביקורות עמיתים יופיעו כאן לאחר הגשת חיבורים" />
    {/if}
  {/if}
</div>
{:else}
  <div class="page-container">
    <EmptyState icon="◈" title="חבורה לא נמצאה" />
  </div>
{/if}

<ConfirmDialog
  open={showDeleteConfirm}
  title="מחיקת חבורה"
  message="האם למחוק את '{mivtza?.shem ?? ''}'? כל החיבורים, השלבים והביקורות יימחקו. פעולה זו אינה הפיכה."
  confirmLabel="מחק"
  destructive={true}
  onconfirm={() => { if (mivtza) { app.deleteMivtza(mivtza.id); window.location.href = '/chaburot'; } }}
  oncancel={() => showDeleteConfirm = false}
/>

<ConfirmDialog
  open={showUnenrollConfirm}
  title="עזיבת חבורה"
  message="האם לעזוב את '{mivtza?.shem ?? ''}'?"
  confirmLabel="עזוב"
  destructive={true}
  onconfirm={() => { if (mivtza && app.currentUserId) { app.unenrollFromMivtza(app.currentUserId, mivtza.id); showUnenrollConfirm = false; } }}
  oncancel={() => showUnenrollConfirm = false}
/>
