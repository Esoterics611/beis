<script lang="ts">
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import { contributionVotingWeight } from '$lib/types';
  import { formatTmim } from '$lib/utils/format';
  import TalmidAvatar from '$components/TalmidAvatar.svelte';
  import RankInsignia from '$components/RankInsignia.svelte';
  import RankBadge from '$components/RankBadge.svelte';
  import LocationBadge from '$components/LocationBadge.svelte';
  import TokenDisplay from '$components/TokenDisplay.svelte';
  import ProgressBar from '$components/ProgressBar.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import EmptyState from '$components/EmptyState.svelte';
  import ConfirmDialog from '$components/ConfirmDialog.svelte';
  import { PROPOSAL_TYPE_LABELS } from '$lib/types';

  let id = $derived($page.params.id ?? '');
  let talmid = $derived(app.getTalmid(id));
  let makom = $derived(talmid ? app.getMakom(talmid.makomId) : null);
  let tafkidim = $derived(talmid ? app.tafkidim.filter(t => t.assigneeId === talmid!.id) : []);
  let mivtzaot = $derived(talmid ? app.getTalmidMivtzaot(talmid.id) : []);

  const tStatus: Record<string,string> = { todo:'○', in_progress:'◐', submitted:'◑', approved:'●', rejected:'✕' };

  interface ScoreMilestone { shem: string; required: number }

  let nextMilestone = $derived((): ScoreMilestone | null => {
    if (!talmid) return null;
    const score = talmid.contribution_score;
    if (score < 1000)  return { shem: 'בקי',  required: 1000  };
    if (score < 10000) return { shem: 'מורה', required: 10000 };
    return null;
  });

  let scoreTier = $derived(
    !talmid ? 'enlisted' :
    talmid.contribution_score >= 10000 ? 'officer' :
    talmid.contribution_score >= 1000  ? 'nco' : 'enlisted'
  );

  let recentEarnings = $derived(
    tafkidim.filter(t => t.status === 'approved').slice(-5).reverse()
  );

  // Voting history — proposals where this talmid voted (matched by walletAddress)
  let votedProposals = $derived(
    talmid && talmid.walletAddress
      ? app.proposals.filter(p => p.myVote && p.proposer !== talmid!.walletAddress)
      : []
  );

  let canPromote = $derived(
    app.isMashpia &&
    !!talmid &&
    talmid.id !== app.currentUserId
  );

  let showPromoteConfirm = $state(false);
  let showRedeemModal = $state(false);
  let redeemAmount = $state(0);
  let isSelf = $derived(talmid?.id === app.currentUserId);
</script>

{#if talmid}
<div class="page-container space-y-6">
  <!-- פרופיל ראשי -->
  <div
    class="p-6"
    style="
      border: 1px solid var(--color-tier-{scoreTier});
      border-radius: var(--radius-xl);
      background-color: var(--color-bg-secondary);
    "
  >
    <div class="flex items-start gap-6 flex-wrap">
      <TalmidAvatar shem={talmid.shem} score={talmid.contribution_score} isOnline={talmid.isOnline} size="lg" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 mb-2 flex-wrap">
          <h2 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">{talmid.shem}</h2>
          <RankBadge score={talmid.contribution_score} size="md" />
          {#if makom}
            <LocationBadge shem={makom.shem} status={makom.status} />
          {/if}
          {#if talmid.isOnline}
            <span class="flex items-center gap-1 text-xs" style="color: var(--color-status-success);">
              <span class="w-1.5 h-1.5 rounded-full inline-block" style="background-color: var(--color-status-success);"></span>מחובר
            </span>
          {/if}
        </div>
        <p class="text-sm mb-4" style="color: var(--color-text-secondary);">מסלול: {talmid.track}</p>

        <!-- סטטיסטיקות -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="p-3 text-center" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
            <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-secondary);">{talmid.seifimCompleted}</span>
            <span class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-tertiary);">שלבים</span>
          </div>
          <div class="p-3 text-center" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
            <span class="text-2xl font-bold font-mono block" style="color: #7c3aed;">{talmid.peerReviewsGiven}</span>
            <span class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-tertiary);">ביקורות</span>
          </div>
          <div class="p-3 text-center" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
            <span class="text-2xl font-bold font-mono block" style="color: var(--color-status-success);">{talmid.papersPublished}</span>
            <span class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-tertiary);">מאמרים</span>
          </div>
          <div class="p-3 text-center" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
            <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-primary);">{talmid.votingPower}</span>
            <span class="text-[10px] uppercase tracking-wide" style="color: var(--color-text-tertiary);">כח הצבעה</span>
          </div>
        </div>

        <!-- התקדמות התרומה -->
        {#if nextMilestone()}
          {@const next = nextMilestone()!}
          <div>
            <div class="flex justify-between text-xs mb-1" style="color: var(--color-text-tertiary);">
              <span>התקדמות ל: <span style="color: var(--color-text-primary);">{next.shem}</span></span>
              <span class="font-mono">{talmid.contribution_score.toLocaleString()} / {next.required.toLocaleString()} ניקוד</span>
            </div>
            <ProgressBar value={talmid.contribution_score} max={next.required} color="token" size="md" />
          </div>
        {:else}
          <div class="text-xs font-semibold" style="color: var(--color-accent-secondary);">✦ תרומה מירבית</div>
        {/if}
      </div>
      <div class="flex flex-col items-center gap-3">
        <RankInsignia score={talmid.contribution_score} size="xl" glow={true} />
        {#if canPromote}
          <button
            onclick={() => showPromoteConfirm = true}
            class="px-3 py-1.5 text-xs font-medium transition-colors duration-150"
            style="
              background-color: rgba(125,108,63,0.1);
              border: 1px solid rgba(125,108,63,0.3);
              border-radius: var(--radius-md);
              color: var(--color-accent-secondary);
              cursor: pointer;
            "
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.2)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.1)'; }}
          >קדם בתרומה ↑</button>
        {/if}
      </div>
    </div>
  </div>

  <!-- חשבון שכר -->
  <div
    class="p-5"
    style="
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      background-color: var(--color-bg-secondary);
    "
  >
    <h3 class="text-xs font-semibold uppercase tracking-widest mb-4" style="color: var(--color-text-tertiary);">חשבון שכר</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- יתרה -->
      <div class="p-4 text-center" style="background-color: rgba(125,108,63,0.05); border: 1px solid rgba(125,108,63,0.2); border-radius: var(--radius-lg);">
        <TokenDisplay amount={talmid.tokenBalance} size="lg" />
        <p class="text-[10px] mt-1" style="color: var(--color-text-tertiary);">יתרה נוכחית</p>
      </div>
      <!-- סה"כ שנצבר -->
      <div class="p-4 text-center" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
        <TokenDisplay amount={talmid.totalTokensEarned} size="lg" />
        <p class="text-[10px] mt-1" style="color: var(--color-text-tertiary);">סה"כ נצבר</p>
      </div>
      <!-- כח הצבעה -->
      <div class="p-4 text-center" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-lg);">
        <span class="text-2xl font-bold font-mono block" style="color: var(--color-accent-primary);">{contributionVotingWeight(talmid.contribution_score)}×</span>
        <p class="text-[10px] mt-1" style="color: var(--color-text-tertiary);">משקל הצבעה</p>
      </div>
    </div>
    {#if talmid.walletAddress}
      <div class="mt-3 flex items-center gap-2">
        <span class="text-[10px]" style="color: var(--color-text-tertiary);">חשבון:</span>
        <span class="text-[10px] font-mono" style="color: var(--color-text-primary);">{talmid.walletAddress.slice(0,10)}...{talmid.walletAddress.slice(-6)}</span>
      </div>
    {/if}
    <!-- פעילות אחרונה -->
    {#if recentEarnings.length > 0}
      <div class="mt-4">
        <p class="text-[10px] uppercase tracking-wide mb-2" style="color: var(--color-text-tertiary);">הכנסות אחרונות</p>
        <div class="space-y-1">
          {#each recentEarnings as t}
            <div class="flex items-center justify-between text-xs">
              <span class="truncate" style="color: var(--color-text-primary);">{t.shem}</span>
              <span class="font-mono font-semibold flex-shrink-0 mr-2" style="color: var(--color-accent-secondary);">+{formatTmim(t.tokenReward)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    {#if isSelf}
      <button
        onclick={() => { redeemAmount = 0; showRedeemModal = true; }}
        class="mt-4 w-full py-2 text-xs font-medium transition-colors duration-150"
        style="
          border: 1px solid rgba(125,108,63,0.3);
          border-radius: var(--radius-md);
          background-color: rgba(125,108,63,0.08);
          color: var(--color-accent-secondary);
          cursor: pointer;
        "
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.18)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(125,108,63,0.08)'; }}
      >פדה שכר</button>
    {/if}
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- שלבים -->
    <div
      class="lg:col-span-2"
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      <div class="px-5 py-3" style="border-bottom: 1px solid var(--color-border-primary);">
        <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">שלבים ({tafkidim.length})</h3>
      </div>
      <div>
        {#each tafkidim.slice(0, 8) as t}
          {@const masima = app.getMasima(t.chibburId)}
          <div class="flex items-center gap-3 px-5 py-3.5" style="border-bottom: 1px solid var(--color-border-secondary);">
            <span class="w-4 text-center flex-shrink-0 text-sm" style="color: var(--color-text-tertiary);">{tStatus[t.status] ?? '○'}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate" style="color: var(--color-text-primary);">{t.shem}</p>
              <p class="text-xs" style="color: var(--color-text-tertiary);">{masima?.shem ?? ''}</p>
            </div>
            <StatusBadge status={t.status} />
            <span class="text-xs font-mono font-semibold flex-shrink-0" style="color: var(--color-accent-secondary);">{formatTmim(t.tokenReward)}</span>
          </div>
        {:else}
          <EmptyState icon="▸" title="אין שלבים" />
        {/each}
      </div>
    </div>

    <!-- חבורות -->
    <div
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        background-color: var(--color-bg-secondary);
        overflow: hidden;
      "
    >
      <div class="px-5 py-3" style="border-bottom: 1px solid var(--color-border-primary);">
        <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">חבורות ({mivtzaot.length})</h3>
      </div>
      <div>
        {#each mivtzaot as mivtza}
          <a
            href="/chaburot/{mivtza.id}"
            class="block px-5 py-3.5 transition-colors duration-150"
            style="border-bottom: 1px solid var(--color-border-secondary); text-decoration: none;"
            onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
            onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <p class="text-sm truncate mb-1.5" style="color: var(--color-text-primary);">{mivtza.shem}</p>
            <ProgressBar value={app.getMivtzaProgress(mivtza.id)} max={100} showLabel color="token" />
          </a>
        {:else}
          <EmptyState icon="◈" title="לא רשום לחבורות" />
        {/each}
      </div>
    </div>
  </div>

  <!-- היסטוריית הצבעות -->
  {#if isSelf && app.proposals.length > 0}
    <div
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-xl);
        overflow: hidden;
      "
    >
      <div class="px-5 py-3" style="border-bottom: 1px solid var(--color-border-primary);">
        <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">היסטוריית הצבעות</h3>
      </div>
      {#if votedProposals.length === 0}
        <div class="px-5 py-8 text-center text-sm" style="color: var(--color-text-tertiary);">לא הצבעת עדיין על הצעות</div>
      {:else}
        <div>
          {#each votedProposals as p}
            <div class="flex items-center gap-3 px-5 py-3" style="border-bottom: 1px solid var(--color-border-secondary);">
              <span
                class="text-xs font-semibold px-2 py-0.5 flex-shrink-0"
                style="
                  border-radius: var(--radius-sm);
                  background-color: {p.myVote === 'for' ? 'rgba(30,111,80,0.1)' : p.myVote === 'against' ? 'rgba(185,28,28,0.08)' : 'var(--color-bg-tertiary)'};
                  color: {p.myVote === 'for' ? 'var(--color-status-success)' : p.myVote === 'against' ? 'var(--color-status-error)' : 'var(--color-text-tertiary)'};
                "
              >{p.myVote === 'for' ? 'בעד' : p.myVote === 'against' ? 'נגד' : 'נמנע'}</span>
              <div class="flex-1 min-w-0">
                <a href="/governance/{p.id}" class="text-sm" style="color: var(--color-text-primary); text-decoration: none;">{p.title}</a>
                <div class="text-[11px]" style="color: var(--color-text-tertiary);">{PROPOSAL_TYPE_LABELS[p.type] ?? p.type}</div>
              </div>
              <span
                class="text-xs px-2 py-0.5 flex-shrink-0"
                style="border-radius: var(--radius-sm); background-color: var(--color-bg-tertiary); color: var(--color-text-tertiary);"
              >{p.state}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
{:else}
  <div class="page-container text-center py-16 text-sm" style="color: var(--color-text-tertiary);">חבר לא נמצא</div>
{/if}

<!-- Promote Dialog -->
{#if talmid && canPromote}
  <ConfirmDialog
    open={showPromoteConfirm}
    title="הוספת תרומה"
    message="הוסף 5,000 ניקוד תרומה ל{talmid.shem}?"
    confirmLabel="קדם"
    onconfirm={() => { app.promoteTalmid(talmid!.id); showPromoteConfirm = false; }}
    oncancel={() => showPromoteConfirm = false}
  />
{/if}

<!-- Redeem שכר Modal -->
{#if showRedeemModal && talmid}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" dir="rtl">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={() => showRedeemModal = false}></div>
    <div
      class="relative z-10 w-full max-w-sm p-6 space-y-4"
      style="
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-2xl);
        background-color: var(--color-bg-secondary);
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      "
    >
      <h3 class="text-lg font-semibold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">פדיון שכר</h3>
      <p class="text-xs" style="color: var(--color-text-secondary);">יתרה: <span class="font-mono font-semibold" style="color: var(--color-accent-secondary);">{formatTmim(talmid.tokenBalance)}</span></p>
      <div class="space-y-1.5">
        <label class="text-xs" style="color: var(--color-text-tertiary);" for="redeem-amount">כמות</label>
        <input
          id="redeem-amount"
          type="number"
          bind:value={redeemAmount}
          min="1"
          max={talmid.tokenBalance}
          style="
            width: 100%;
            padding: 0.625rem 1rem;
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-md);
            background-color: var(--color-bg-primary);
            color: var(--color-text-primary);
            font-size: 0.875rem;
            outline: none;
          "
        />
      </div>
      {#if redeemAmount > 0}
        <div class="text-center text-sm">
          <span class="font-mono font-bold" style="color: var(--color-accent-secondary);">{redeemAmount} שכר</span>
          <span class="mx-2" style="color: var(--color-text-tertiary);">=</span>
          <span class="font-mono font-bold" style="color: var(--color-status-success);">${(redeemAmount * 0.10).toFixed(2)}</span>
        </div>
      {/if}
      <div class="flex gap-3 justify-end">
        <button
          onclick={() => showRedeemModal = false}
          class="px-4 py-2 text-sm transition-colors duration-150"
          style="
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-md);
            color: var(--color-text-secondary);
            background: none;
            cursor: pointer;
          "
        >ביטול</button>
        <button
          onclick={() => { app.redeemTmim(talmid!.id, redeemAmount); showRedeemModal = false; }}
          disabled={redeemAmount < 1 || redeemAmount > talmid.tokenBalance}
          class="px-4 py-2 text-sm font-medium transition-colors duration-150"
          style="
            background-color: rgba(125,108,63,0.15);
            border: 1px solid rgba(125,108,63,0.35);
            border-radius: var(--radius-md);
            color: var(--color-accent-secondary);
            cursor: pointer;
          "
        >פדה</button>
      </div>
    </div>
  </div>
{/if}
