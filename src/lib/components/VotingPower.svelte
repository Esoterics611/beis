<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { contributionVotingWeight } from '$lib/types';
  import { formatTmim } from '$lib/utils/format';

  interface Props {
    size?: 'sm' | 'md' | 'lg';
  }

  let { size = 'md' }: Props = $props();

  let user   = $derived(app.currentUser);
  let score  = $derived(user?.contribution_score ?? 0);
  let weight = $derived(contributionVotingWeight(score));
  let power  = $derived(app.myVotingPower);
</script>

{#if size === 'sm'}
  <!-- Inline chip -->
  <span
    class="inline-flex items-center gap-1 text-[11px] font-semibold"
    style="
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-sm);
      padding: 0.125rem 0.5rem;
      color: var(--color-accent-primary);
      font-family: var(--font-mono);
    "
    title="כוח הצבעה: {power}"
  >
    ⚖ {power.toLocaleString()}
  </span>

{:else if size === 'md'}
  <!-- Compact card -->
  <div
    class="space-y-2"
    style="
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-lg);
      padding: 1rem;
    "
  >
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold" style="color: var(--color-text-secondary);">כוח ההצבעה שלך</span>
      <span class="text-lg font-bold" style="color: var(--color-accent-primary); font-family: var(--font-mono);">{power.toLocaleString()}</span>
    </div>
    {#if user}
      <div class="flex items-center justify-between text-[11px]" style="color: var(--color-text-tertiary);">
        <span>{formatTmim(user.tokenBalance)} שכר</span>
        <span>× {weight} (ניקוד {score.toLocaleString()})</span>
      </div>
    {/if}
  </div>

{:else}
  <!-- Full breakdown card (lg) -->
  <div
    class="space-y-3"
    style="
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border-primary);
      border-radius: var(--radius-xl);
      padding: 1.25rem;
    "
  >
    <h3 class="text-sm font-semibold" style="color: var(--color-text-secondary);">כוח ההצבעה שלך</h3>

    <div class="text-3xl font-bold" style="color: var(--color-accent-primary); font-family: var(--font-mono);">
      {power.toLocaleString()}
    </div>

    {#if user}
      <div
        class="space-y-2 pt-2"
        style="border-top: 1px solid var(--color-border-secondary);"
      >
        <div class="flex justify-between text-xs">
          <span style="color: var(--color-text-tertiary);">יתרת שכר</span>
          <span style="color: var(--color-text-primary); font-family: var(--font-mono);">{formatTmim(user.tokenBalance)}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span style="color: var(--color-text-tertiary);">ניקוד תרומה</span>
          <span style="color: var(--color-text-primary); font-family: var(--font-mono);">{score.toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span style="color: var(--color-text-tertiary);">משקל לוגריתמי</span>
          <span style="color: var(--color-text-primary); font-family: var(--font-mono);">× {weight}</span>
        </div>
        <div class="flex justify-between text-xs font-semibold">
          <span style="color: var(--color-text-secondary);">סה"כ</span>
          <span style="color: var(--color-accent-primary); font-family: var(--font-mono);">{power.toLocaleString()}</span>
        </div>
      </div>

      <p class="text-[11px]" style="color: var(--color-text-tertiary);">
        כוח ההצבעה נגזר מתרומה מאומתת.
      </p>
    {:else}
      <p class="text-sm" style="color: var(--color-text-tertiary);">יש להתחבר כדי לראות את כוח ההצבעה שלך</p>
    {/if}
  </div>
{/if}
