<script lang="ts">
  import { href } from '$lib/utils/nav';
  import type { Proposal } from '$lib/types';
  import { PROPOSAL_TYPE_LABELS } from '$lib/types';
  import { app } from '$stores/app.svelte';
  import { formatDate } from '$lib/utils/format';
  import StatusBadge from './StatusBadge.svelte';

  interface Props {
    proposal: Proposal;
    compact?: boolean;
  }

  let { proposal, compact = false }: Props = $props();

  // Border color by state
  const stateBorder: Record<string, string> = {
    active:    'var(--color-accent-primary)',
    passed:    'var(--color-status-success)',
    failed:    'var(--color-status-error)',
    queued:    'var(--color-status-warning)',
    executed:  'var(--color-text-tertiary)',
    cancelled: 'var(--color-text-tertiary)',
  };

  let totalVotes = $derived(proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain);
  let forPct    = $derived(totalVotes > 0 ? Math.round((proposal.votesFor     / totalVotes) * 100) : 0);
  let againstPct = $derived(totalVotes > 0 ? Math.round((proposal.votesAgainst / totalVotes) * 100) : 0);
  let abstainPct = $derived(totalVotes > 0 ? Math.round((proposal.votesAbstain / totalVotes) * 100) : 0);

  let quorumPct = $derived(
    proposal.quorumRequired > 0
      ? Math.min(100, Math.round((totalVotes / proposal.quorumRequired) * 100))
      : 0
  );

  let timeLeft = $derived((): string => {
    const end = new Date(proposal.votingEndTime).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 'הסתיים';
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `${hours}ש' נותרו`;
    return `${Math.floor(hours / 24)}י' נותרו`;
  });

  let canVote = $derived(proposal.state === 'active' && !proposal.myVote && !!app.currentUser);

  async function vote(v: 'for' | 'against' | 'abstain') {
    await app.castVote(proposal.id, v);
  }
</script>

<a
  href={href(`/governance/${proposal.id}`)}
  class="block space-y-3 transition-shadow duration-150"
  style="
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-right: 4px solid {stateBorder[proposal.state] ?? 'var(--color-border-primary)'};
    border-radius: var(--radius-lg);
    padding: {compact ? '0.75rem 1rem' : '1.25rem'};
    text-decoration: none;
    color: inherit;
    display: block;
  "
  onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
  onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
>
  <!-- Header row -->
  <div class="flex items-start justify-between gap-3">
    <div class="flex-1 min-w-0 space-y-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-mono" style="color: var(--color-text-tertiary);">#{ proposal.id }</span>
        <span class="text-[11px] px-1.5 py-0.5" style="background-color: var(--color-bg-tertiary); border-radius: var(--radius-sm); color: var(--color-text-secondary);">
          {PROPOSAL_TYPE_LABELS[proposal.type] ?? proposal.type}
        </span>
      </div>
      <h3 class="text-sm font-semibold leading-snug" style="color: var(--color-text-primary);">{proposal.title}</h3>
    </div>
    <div class="flex flex-col items-end gap-1 flex-shrink-0">
      <StatusBadge status={proposal.state} />
      {#if proposal.state === 'active'}
        <span class="text-[11px]" style="color: var(--color-text-tertiary);">{timeLeft()}</span>
      {/if}
    </div>
  </div>

  {#if !compact}
    <!-- Description snippet -->
    <p class="text-xs leading-relaxed line-clamp-2" style="color: var(--color-text-secondary);">{proposal.description}</p>
  {/if}

  <!-- Vote bars -->
  <div class="space-y-1.5">
    <!-- For / Against / Abstain bar -->
    <div class="flex h-2 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
      {#if forPct > 0}
        <div class="h-full transition-all duration-300" style="width: {forPct}%; background-color: var(--color-status-success);"></div>
      {/if}
      {#if againstPct > 0}
        <div class="h-full transition-all duration-300" style="width: {againstPct}%; background-color: var(--color-status-error);"></div>
      {/if}
      {#if abstainPct > 0}
        <div class="h-full transition-all duration-300" style="width: {abstainPct}%; background-color: var(--color-text-tertiary);"></div>
      {/if}
    </div>
    <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-tertiary);">
      <span style="color: var(--color-status-success);">בעד {forPct}%</span>
      <span>קוורום {quorumPct}%{proposal.quorumReached ? ' ✓' : ''}</span>
      <span style="color: var(--color-status-error);">נגד {againstPct}%</span>
    </div>
  </div>

  <!-- Vote buttons — only when active and not yet voted -->
  {#if canVote && !compact}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="flex gap-2 pt-1" onclick={(e) => e.preventDefault()}>
      <button
        onclick={() => vote('for')}
        class="flex-1 text-xs font-semibold py-1.5 transition-colors duration-150"
        style="border: 1px solid var(--color-status-success); color: var(--color-status-success); border-radius: var(--radius-sm); background: none; cursor: pointer;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(30,111,80,0.08)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >בעד</button>
      <button
        onclick={() => vote('against')}
        class="flex-1 text-xs font-semibold py-1.5 transition-colors duration-150"
        style="border: 1px solid var(--color-status-error); color: var(--color-status-error); border-radius: var(--radius-sm); background: none; cursor: pointer;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(185,28,28,0.08)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >נגד</button>
      <button
        onclick={() => vote('abstain')}
        class="flex-1 text-xs font-semibold py-1.5 transition-colors duration-150"
        style="border: 1px solid var(--color-border-primary); color: var(--color-text-secondary); border-radius: var(--radius-sm); background: none; cursor: pointer;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >נמנע</button>
    </div>
  {/if}

  {#if proposal.myVote}
    <div class="text-[11px] font-semibold pt-1" style="color: var(--color-text-tertiary);">
      הצבעתך: {proposal.myVote === 'for' ? 'בעד' : proposal.myVote === 'against' ? 'נגד' : 'נמנע'}
    </div>
  {/if}
</a>
