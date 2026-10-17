<script lang="ts">
  interface Props {
    value: number;
    max?: number;
    showLabel?: boolean;
    color?: 'primary' | 'success' | 'warning' | 'error' | 'token';
    size?: 'sm' | 'md';
  }

  let { value, max = 100, showLabel = false, color = 'primary', size = 'sm' }: Props = $props();
  let pct = $derived(Math.min(Math.round((value / max) * 100), 100));

  const fillColor: Record<string, string> = {
    primary: 'var(--color-accent-primary)',
    success: 'var(--color-status-success)',
    warning: 'var(--color-status-warning)',
    error:   'var(--color-status-error)',
    token:   'var(--color-accent-secondary)',
  };

  const heightClass = { sm: 'h-2', md: 'h-2.5' };
</script>

<div class="flex items-center gap-2 w-full">
  <div
    class="flex-1 rounded-full overflow-hidden {heightClass[size]}"
    style="background-color: var(--color-bg-tertiary);"
  >
    <div
      class="h-full rounded-full"
      style="width: {pct}%; background-color: {fillColor[color]}; transition: width var(--transition-normal);"
    ></div>
  </div>
  {#if showLabel}
    <span class="text-[11px] flex-shrink-0" style="color: var(--color-text-secondary); font-family: var(--font-mono);">{pct}%</span>
  {/if}
</div>
