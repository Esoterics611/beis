<script lang="ts">
  import { href } from '$lib/utils/nav';
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import { PROPOSAL_TYPE_LABELS } from '$lib/types';
  import { formatDate } from '$lib/utils/format';
  import { formatTmim } from '$lib/utils/format';
  import VotingPower from '$lib/components/VotingPower.svelte';
  import TalmidAvatar from '$lib/components/TalmidAvatar.svelte';
  import RankBadge from '$lib/components/RankBadge.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let proposalId = $derived($page.params.id);
  let proposal   = $derived(app.proposals.find(p => p.id === proposalId));

  let totalVotes = $derived(
    proposal ? proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain : 0
  );
  let forPct     = $derived(totalVotes > 0 && proposal ? Math.round((proposal.votesFor     / totalVotes) * 100) : 0);
  let againstPct = $derived(totalVotes > 0 && proposal ? Math.round((proposal.votesAgainst / totalVotes) * 100) : 0);
  let abstainPct = $derived(totalVotes > 0 && proposal ? Math.round((proposal.votesAbstain / totalVotes) * 100) : 0);
  let quorumPct  = $derived(
    proposal && proposal.quorumRequired > 0
      ? Math.min(100, Math.round((totalVotes / proposal.quorumRequired) * 100))
      : 0
  );

  let canVote = $derived(
    !!proposal && proposal.state === 'active' && !proposal.myVote && !!app.currentUser
  );
  let voting = $state(false);

  async function castVote(vote: 'for' | 'against' | 'abstain') {
    if (!proposal) return;
    voting = true;
    await app.castVote(proposal.id, vote);
    voting = false;
  }

  const stateLabel: Record<string, string> = {
    active: 'פעיל', passed: 'עבר', failed: 'נכשל',
    queued: 'בתור', executed: 'בוצע', cancelled: 'בוטל',
  };

  const stateBorder: Record<string, string> = {
    active: 'var(--color-accent-primary)', passed: 'var(--color-status-success)',
    failed: 'var(--color-status-error)',   queued: 'var(--color-status-warning)',
    executed: 'var(--color-text-tertiary)', cancelled: 'var(--color-text-tertiary)',
  };

  let proposerChaver = $derived(
    proposal?.proposerChaver ?? app.talmidim.find(t => t.walletAddress === proposal?.proposer)
  );
</script>

<div class="page-container">
  <a
    href={href(`/governance`)}
    class="inline-flex items-center gap-1 text-xs mb-6 transition-colors duration-150"
    style="color: var(--color-text-link); text-decoration: none;"
  >← חזור לממשל</a>

  {#if !proposal}
    <EmptyState icon="◇" title="הצעה לא נמצאה" description="ייתכן שהוסרה או שהקישור שגוי." />
  {:else}
    <div class="grid gap-6" style="grid-template-columns: 1fr 300px;">
      <!-- Main content -->
      <div class="space-y-6">
        <!-- Header card -->
        <div
          style="
            background-color: var(--color-bg-secondary);
            border: 1px solid var(--color-border-primary);
            border-right: 4px solid {stateBorder[proposal.state] ?? 'var(--color-border-primary)'};
            border-radius: var(--radius-xl);
            padding: 1.5rem;
          "
        >
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-mono" style="color: var(--color-text-tertiary);">#{proposal.id}</span>
                <span class="text-xs px-2 py-0.5" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-sm); color: var(--color-text-secondary);">
                  {PROPOSAL_TYPE_LABELS[proposal.type] ?? proposal.type}
                </span>
              </div>
              <h1 class="text-xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">{proposal.title}</h1>
            </div>
            <span
              class="text-sm font-semibold px-3 py-1 flex-shrink-0"
              style="
                border-radius: var(--radius-md);
                background-color: {proposal.state === 'passed' || proposal.state === 'executed' ? 'var(--color-status-success-light)' : proposal.state === 'failed' || proposal.state === 'cancelled' ? 'rgba(185,28,28,0.08)' : 'var(--color-bg-tertiary)'};
                color: {proposal.state === 'passed' || proposal.state === 'executed' ? 'var(--color-status-success)' : proposal.state === 'failed' || proposal.state === 'cancelled' ? 'var(--color-status-error)' : 'var(--color-accent-primary)'};
              "
            >{stateLabel[proposal.state] ?? proposal.state}</span>
          </div>

          <p class="text-sm leading-relaxed" style="color: var(--color-text-secondary); line-height: 1.8;">{proposal.description}</p>

          {#if proposal.callDataDecoded}
            <div class="mt-4 p-3 space-y-1" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-md);">
              <span class="text-xs font-semibold" style="color: var(--color-text-secondary);">פעולה מקודדת:</span>
              <code class="text-xs block" style="color: var(--color-text-primary); font-family: var(--font-mono); white-space: pre-wrap; word-break: break-all;">{proposal.callDataDecoded}</code>
            </div>
          {/if}
        </div>

        <!-- Vote results -->
        <div
          style="
            background-color: var(--color-bg-secondary);
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-xl);
            padding: 1.5rem;
          "
        >
          <h2 class="text-sm font-semibold mb-4" style="color: var(--color-text-secondary);">תוצאות הצבעה</h2>

          <div class="space-y-3">
            <!-- For -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span style="color: var(--color-status-success); font-weight: 600;">בעד</span>
                <span style="color: var(--color-text-secondary);">{forPct}% · {proposal.votesFor.toLocaleString()} כוח</span>
              </div>
              <div class="h-3 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
                <div class="h-full rounded-full transition-all duration-500" style="width: {forPct}%; background-color: var(--color-status-success);"></div>
              </div>
            </div>
            <!-- Against -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span style="color: var(--color-status-error); font-weight: 600;">נגד</span>
                <span style="color: var(--color-text-secondary);">{againstPct}% · {proposal.votesAgainst.toLocaleString()} כוח</span>
              </div>
              <div class="h-3 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
                <div class="h-full rounded-full transition-all duration-500" style="width: {againstPct}%; background-color: var(--color-status-error);"></div>
              </div>
            </div>
            <!-- Abstain -->
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span style="color: var(--color-text-tertiary); font-weight: 600;">נמנע</span>
                <span style="color: var(--color-text-secondary);">{abstainPct}% · {proposal.votesAbstain.toLocaleString()} כוח</span>
              </div>
              <div class="h-3 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
                <div class="h-full rounded-full transition-all duration-500" style="width: {abstainPct}%; background-color: var(--color-text-tertiary);"></div>
              </div>
            </div>

            <!-- Quorum -->
            <div class="pt-2" style="border-top: 1px solid var(--color-border-secondary);">
              <div class="flex justify-between text-xs mb-1">
                <span style="color: var(--color-text-secondary);">קוורום</span>
                <span style="color: {proposal.quorumReached ? 'var(--color-status-success)' : 'var(--color-text-secondary)'}; font-weight: 600;">
                  {quorumPct}% {proposal.quorumReached ? '✓ הושג' : `(${totalVotes.toLocaleString()} מתוך ${proposal.quorumRequired.toLocaleString()})`}
                </span>
              </div>
              <div class="h-2 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  style="width: {quorumPct}%; background-color: {proposal.quorumReached ? 'var(--color-status-success)' : 'var(--color-accent-primary)'};"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <!-- Vote action -->
        {#if canVote}
          <div
            style="
              background-color: var(--color-bg-secondary);
              border: 1px solid var(--color-accent-primary);
              border-radius: var(--radius-xl);
              padding: 1.25rem;
            "
          >
            <h3 class="text-sm font-semibold mb-3" style="color: var(--color-text-primary);">הצביע עכשיו</h3>
            <div class="space-y-2">
              <button
                onclick={() => castVote('for')}
                disabled={voting}
                class="w-full py-2.5 text-sm font-semibold transition-colors duration-150"
                style="background-color: var(--color-status-success); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; opacity: {voting ? 0.6 : 1};"
              >בעד — {app.myVotingPower.toLocaleString()} כוח</button>
              <button
                onclick={() => castVote('against')}
                disabled={voting}
                class="w-full py-2.5 text-sm font-semibold transition-colors duration-150"
                style="background-color: var(--color-status-error); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; opacity: {voting ? 0.6 : 1};"
              >נגד</button>
              <button
                onclick={() => castVote('abstain')}
                disabled={voting}
                class="w-full py-2 text-sm transition-colors duration-150"
                style="background-color: var(--color-bg-tertiary); color: var(--color-text-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); cursor: pointer; opacity: {voting ? 0.6 : 1};"
              >נמנע</button>
            </div>
            <VotingPower size="md" />
          </div>
        {:else if proposal.myVote}
          <div
            style="
              background-color: var(--color-bg-secondary);
              border: 1px solid var(--color-border-primary);
              border-radius: var(--radius-xl);
              padding: 1.25rem;
              text-align: center;
            "
          >
            <div class="text-2xl mb-2">✓</div>
            <p class="text-sm font-semibold" style="color: var(--color-text-primary);">הצבעת {proposal.myVote === 'for' ? 'בעד' : proposal.myVote === 'against' ? 'נגד' : 'נמנע'}</p>
            <p class="text-xs mt-1" style="color: var(--color-text-tertiary);">{app.myVotingPower.toLocaleString()} כוח הצבעה</p>
          </div>
        {/if}

        <!-- Info card -->
        <div
          class="space-y-3 text-xs"
          style="
            background-color: var(--color-bg-secondary);
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-xl);
            padding: 1.25rem;
          "
        >
          <div class="flex justify-between">
            <span style="color: var(--color-text-tertiary);">מגיש</span>
            {#if proposerChaver}
              <div class="flex items-center gap-1.5">
                <TalmidAvatar shem={proposerChaver.shem} score={proposerChaver.contribution_score} isOnline={proposerChaver.isOnline} size="sm" />
                <span style="color: var(--color-text-primary);">{proposerChaver.shem}</span>
              </div>
            {:else}
              <span style="color: var(--color-text-primary); font-family: var(--font-mono);">
                {proposal.proposer.slice(0, 6)}…{proposal.proposer.slice(-4)}
              </span>
            {/if}
          </div>
          <div class="flex justify-between">
            <span style="color: var(--color-text-tertiary);">תחילת הצבעה</span>
            <span style="color: var(--color-text-primary);">{formatDate(proposal.votingStartTime)}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--color-text-tertiary);">סיום הצבעה</span>
            <span style="color: var(--color-text-primary);">{formatDate(proposal.votingEndTime)}</span>
          </div>
          {#if proposal.executionTime}
            <div class="flex justify-between">
              <span style="color: var(--color-text-tertiary);">בוצע</span>
              <span style="color: var(--color-text-primary);">{formatDate(proposal.executionTime)}</span>
            </div>
          {/if}
          <div class="flex justify-between">
            <span style="color: var(--color-text-tertiary);">כוח הצבעה כולל</span>
            <span style="color: var(--color-text-primary); font-family: var(--font-mono);">{proposal.totalVotingTokens.toLocaleString()}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--color-text-tertiary);">גוש Snapshot</span>
            <span style="color: var(--color-text-primary); font-family: var(--font-mono);">{proposal.snapshotBlock.toLocaleString()}</span>
          </div>
        </div>

        <!-- Technical data -->
        <div
          class="space-y-2"
          style="
            background-color: var(--color-bg-secondary);
            border: 1px solid var(--color-border-primary);
            border-radius: var(--radius-xl);
            padding: 1.25rem;
          "
        >
          <h4 class="text-xs font-semibold" style="color: var(--color-text-secondary);">נתוני חוזה</h4>
          <div class="space-y-1 text-[11px]">
            <div>
              <span style="color: var(--color-text-tertiary);">Target: </span>
              <code style="color: var(--color-text-primary); font-family: var(--font-mono);">{proposal.target.slice(0, 10)}…</code>
            </div>
            <div>
              <span style="color: var(--color-text-tertiary);">Call data: </span>
              <code style="color: var(--color-text-primary); font-family: var(--font-mono);">{proposal.callData.slice(0, 18)}…</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
