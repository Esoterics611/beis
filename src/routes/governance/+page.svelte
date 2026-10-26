<script lang="ts">
  import { href } from '$lib/utils/nav';
  import { app } from '$stores/app.svelte';
  import ProposalCard from '$lib/components/ProposalCard.svelte';
  import VotingPower from '$lib/components/VotingPower.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { PROPOSAL_TYPE_LABELS } from '$lib/types';
  import type { ProposalType } from '$lib/types';
  import { formatDate } from '$lib/utils/format';

  let activeTab = $state<'active' | 'history' | 'create'>('active');

  // Create form state
  let form = $state({
    type: 'signal' as ProposalType,
    title: '',
    description: '',
    target: '',
    callData: '0x',
    quorumRequired: 10000,
    votingStartTime: new Date().toISOString().slice(0, 16),
    votingEndTime: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 16),
  });

  let isSignal = $derived(form.type === 'signal');

  let submitting = $state(false);

  async function submitProposal() {
    if (!form.title.trim() || !form.description.trim()) return;
    submitting = true;
    await app.createProposal({
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      target: form.target.trim() || '0x0000000000000000000000000000000000000000',
      callData: form.callData.trim() || '0x',
      quorumRequired: form.quorumRequired,
      totalVotingTokens: app.treasuryStats?.tmimCirculating ?? 0,
      votingStartTime: new Date(form.votingStartTime).toISOString(),
      votingEndTime: new Date(form.votingEndTime).toISOString(),
    });
    submitting = false;
    activeTab = 'active';
    form.title = '';
    form.description = '';
  }

  let history = $derived(app.proposals.filter(p => p.state !== 'active'));
</script>

<div class="page-container">
  <!-- Page header -->
  <div class="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-hebrew);">ממשל</h1>
      <p class="text-sm mt-0.5" style="color: var(--color-text-secondary);">הצעות, הצבעות וניהול האוצר הדמוקרטי</p>
    </div>
    <VotingPower size="md" />
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 mb-6" style="border-bottom: 1px solid var(--color-border-primary); padding-bottom: 0;">
    {#each ([['active', 'הצעות פעילות', app.activeProposals.length], ['history', 'היסטוריה', history.length], ['create', 'הגשת הצעה', 0]] as const) as [tab, label, count]}
      <button
        onclick={() => activeTab = tab}
        class="px-4 py-2.5 text-sm font-medium transition-colors duration-150 relative"
        style="
          background: none;
          border: none;
          cursor: pointer;
          color: {activeTab === tab ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
          border-bottom: 2px solid {activeTab === tab ? 'var(--color-accent-primary)' : 'transparent'};
          margin-bottom: -1px;
        "
      >
        {label}{count > 0 ? ` (${count})` : ''}
      </button>
    {/each}
  </div>

  <!-- Tab: Active Proposals -->
  {#if activeTab === 'active'}
    {#if app.activeProposals.length === 0}
      <EmptyState
        icon="⚖"
        title="אין הצעות פעילות"
        description="כל ההצעות הסתיימו. ניתן להגיש הצעה חדשה דרך טאב 'הגשת הצעה'."
        actionLabel="הגשת הצעה"
        onaction={() => activeTab = 'create'}
      />
    {:else}
      <div class="space-y-4">
        {#each app.activeProposals as proposal}
          <ProposalCard {proposal} />
        {/each}
      </div>
    {/if}

  <!-- Tab: History -->
  {:else if activeTab === 'history'}
    {#if history.length === 0}
      <EmptyState icon="◇" title="אין היסטוריה עדיין" description="הצעות שהסתיימו יופיעו כאן." />
    {:else}
      <div
        class="overflow-x-auto"
        style="
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-secondary);
        "
      >
        <table class="w-full text-sm" style="border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--color-border-primary);">
              {#each ['#', 'כותרת', 'סוג', 'תוצאה', 'בעד', 'נגד', 'תאריך'] as col}
                <th
                  class="text-right px-4 py-3 text-xs font-semibold"
                  style="color: var(--color-text-secondary);"
                >{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each history as p}
              <tr
                style="border-bottom: 1px solid var(--color-border-secondary);"
                onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <td class="px-4 py-3 font-mono text-xs" style="color: var(--color-text-tertiary);">{p.id}</td>
                <td class="px-4 py-3">
                  <a href={href(`/governance/${p.id}`)} style="color: var(--color-text-primary); text-decoration: none;">
                    {p.title}
                  </a>
                </td>
                <td class="px-4 py-3 text-xs" style="color: var(--color-text-secondary);">{PROPOSAL_TYPE_LABELS[p.type] ?? p.type}</td>
                <td class="px-4 py-3">
                  <span
                    class="text-xs font-semibold px-2 py-0.5"
                    style="
                      border-radius: var(--radius-sm);
                      background-color: {p.state === 'passed' || p.state === 'executed' ? 'var(--color-status-success-light)' : 'var(--color-status-error-light)'};
                      color: {p.state === 'passed' || p.state === 'executed' ? 'var(--color-status-success)' : 'var(--color-status-error)'};
                    "
                  >{p.state === 'passed' ? 'עבר' : p.state === 'executed' ? 'בוצע' : p.state === 'failed' ? 'נכשל' : p.state === 'cancelled' ? 'בוטל' : p.state}</span>
                </td>
                <td class="px-4 py-3 text-xs font-mono" style="color: var(--color-status-success);">{p.votesFor.toLocaleString()}</td>
                <td class="px-4 py-3 text-xs font-mono" style="color: var(--color-status-error);">{p.votesAgainst.toLocaleString()}</td>
                <td class="px-4 py-3 text-xs" style="color: var(--color-text-tertiary);">{formatDate(p.votingEndTime)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

  <!-- Tab: Create Proposal -->
  {:else if activeTab === 'create'}
    {#if !app.isMashpia}
      <EmptyState
        icon="⚖"
        title="נדרשת הרשאת קצין"
        description="רק חברים עם תרומה מאומתת יכולים להגיש הצעות. השג תרומה כדי לקבל הרשאה זו."
      />
    {:else}
      <div
        class="max-w-2xl space-y-5"
        style="
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        "
      >
        <h2 class="text-base font-semibold" style="color: var(--color-text-primary);">הגשת הצעה חדשה</h2>

        <div class="space-y-4">
          <!-- Type -->
          <div class="space-y-1">
            <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-type">סוג הצעה</label>
            <select
              id="prop-type"
              bind:value={form.type}
              style="
                width: 100%;
                background-color: var(--color-bg-primary);
                border: 1px solid var(--color-border-primary);
                border-radius: var(--radius-md);
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--color-text-primary);
                font-family: var(--font-hebrew);
              "
            >
              {#each Object.entries(PROPOSAL_TYPE_LABELS) as [value, label]}
                <option {value}>{label}</option>
              {/each}
            </select>
          </div>

          <!-- Title -->
          <div class="space-y-1">
            <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-title">כותרת</label>
            <input
              id="prop-title"
              type="text"
              bind:value={form.title}
              placeholder="תיאור קצר של ההצעה"
              dir="rtl"
              style="
                width: 100%;
                background-color: var(--color-bg-primary);
                border: 1px solid var(--color-border-primary);
                border-radius: var(--radius-md);
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--color-text-primary);
                font-family: var(--font-hebrew);
              "
            />
          </div>

          <!-- Description -->
          <div class="space-y-1">
            <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-desc">תיאור מפורט</label>
            <textarea
              id="prop-desc"
              bind:value={form.description}
              rows="4"
              placeholder="הסבר מלא על ההצעה, הנימוקים, והשפעתה..."
              dir="rtl"
              style="
                width: 100%;
                background-color: var(--color-bg-primary);
                border: 1px solid var(--color-border-primary);
                border-radius: var(--radius-md);
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--color-text-primary);
                font-family: var(--font-hebrew);
                resize: vertical;
              "
            ></textarea>
          </div>

          <!-- Target + CallData (non-SIGNAL only) -->
          {#if !isSignal}
            <div class="space-y-1">
              <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-target">כתובת יעד (Contract Address)</label>
              <input
                id="prop-target"
                type="text"
                bind:value={form.target}
                placeholder="0x..."
                dir="ltr"
                style="
                  width: 100%;
                  background-color: var(--color-bg-primary);
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: var(--color-text-primary);
                  font-family: monospace;
                "
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-calldata">CallData (hex)</label>
              <input
                id="prop-calldata"
                type="text"
                bind:value={form.callData}
                placeholder="0x..."
                dir="ltr"
                style="
                  width: 100%;
                  background-color: var(--color-bg-primary);
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: var(--color-text-primary);
                  font-family: monospace;
                "
              />
            </div>
          {/if}

          <!-- Voting period -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-start">תחילת הצבעה</label>
              <input
                id="prop-start"
                type="datetime-local"
                bind:value={form.votingStartTime}
                style="
                  width: 100%;
                  background-color: var(--color-bg-primary);
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: var(--color-text-primary);
                "
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-end">סיום הצבעה</label>
              <input
                id="prop-end"
                type="datetime-local"
                bind:value={form.votingEndTime}
                style="
                  width: 100%;
                  background-color: var(--color-bg-primary);
                  border: 1px solid var(--color-border-primary);
                  border-radius: var(--radius-md);
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  color: var(--color-text-primary);
                "
              />
            </div>
          </div>

          <!-- Quorum -->
          <div class="space-y-1">
            <label class="text-xs font-semibold" style="color: var(--color-text-secondary);" for="prop-quorum">קוורום (כוח הצבעה)</label>
            <input
              id="prop-quorum"
              type="number"
              bind:value={form.quorumRequired}
              min="0"
              style="
                width: 100%;
                background-color: var(--color-bg-primary);
                border: 1px solid var(--color-border-primary);
                border-radius: var(--radius-md);
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--color-text-primary);
              "
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            onclick={() => activeTab = 'active'}
            class="px-4 py-2 text-sm transition-colors duration-150"
            style="background: none; border: 1px solid var(--color-border-primary); border-radius: var(--radius-md); color: var(--color-text-secondary); cursor: pointer;"
          >ביטול</button>
          <button
            onclick={submitProposal}
            disabled={submitting || !form.title.trim() || !form.description.trim()}
            class="px-5 py-2 text-sm font-semibold transition-colors duration-150"
            style="
              background-color: var(--color-accent-primary);
              color: var(--color-text-inverse);
              border: none;
              border-radius: var(--radius-md);
              cursor: pointer;
              opacity: {submitting || !form.title.trim() || !form.description.trim() ? 0.5 : 1};
            "
          >{submitting ? 'שולח...' : 'הגש הצעה'}</button>
        </div>
      </div>
    {/if}
  {/if}
</div>
