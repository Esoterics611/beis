<script lang="ts">
  import { app } from '$stores/app.svelte';
  import { formatTmim } from '$lib/utils/format';

  let stats = $derived(app.treasuryStats);

  function usd(n: number): string {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }

  function pct(n: number): string {
    return `${(n * 100).toFixed(1)}%`;
  }
</script>

{#if stats}
  <div class="grid grid-cols-2 gap-3" style="direction: rtl;">
    <!-- USDC Balance -->
    <div
      class="space-y-1"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-lg);
        padding: 1rem;
      "
    >
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">יתרת USDC</span>
      <div class="text-xl font-bold" style="color: var(--color-accent-primary); font-family: var(--font-mono);">
        {usd(stats.usdcBalance)}
      </div>
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">+ {stats.ethBalance.toFixed(3)} ETH</span>
    </div>

    <!-- Circulating שכר -->
    <div
      class="space-y-1"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-lg);
        padding: 1rem;
      "
    >
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">שכר במחזור</span>
      <div class="text-xl font-bold" style="color: var(--color-accent-secondary); font-family: var(--font-mono);">
        {formatTmim(stats.tmimCirculating)}
      </div>
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">מתוך {formatTmim(stats.tmimTotalMinted)} שהונפקו</span>
    </div>

    <!-- Reserve Ratio -->
    <div
      class="space-y-1"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-lg);
        padding: 1rem;
      "
    >
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">יחס עתודה</span>
      <div
        class="text-xl font-bold"
        style="color: {stats.reserveRatio >= 0.2 ? 'var(--color-status-success)' : 'var(--color-status-warning)'}; font-family: var(--font-mono);"
      >
        {pct(stats.reserveRatio)}
      </div>
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">מינימום 20%</span>
    </div>

    <!-- Monthly Minting -->
    <div
      class="space-y-2"
      style="
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        border-radius: var(--radius-lg);
        padding: 1rem;
      "
    >
      <span class="text-[11px]" style="color: var(--color-text-tertiary);">הנפקה חודשית</span>
      <div class="text-xl font-bold" style="color: var(--color-text-primary); font-family: var(--font-mono);">
        {formatTmim(stats.currentMonthMinted)}
      </div>
      <!-- Progress bar -->
      <div class="space-y-0.5">
        <div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-bg-tertiary);">
          <div
            class="h-full rounded-full transition-all duration-300"
            style="
              width: {Math.min(100, Math.round((stats.currentMonthMinted / stats.maxMonthlyMint) * 100))}%;
              background-color: {
                stats.currentMonthMinted / stats.maxMonthlyMint > 0.8
                  ? 'var(--color-status-warning)'
                  : 'var(--color-accent-primary)'
              };
            "
          ></div>
        </div>
        <span class="text-[11px]" style="color: var(--color-text-tertiary);">מתוך {formatTmim(stats.maxMonthlyMint)} מקסימום</span>
      </div>
    </div>
  </div>
{:else}
  <div class="text-sm text-center py-8" style="color: var(--color-text-tertiary);">טוען נתוני אוצר...</div>
{/if}
