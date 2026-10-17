<script lang="ts">
  interface Props {
    amount: number;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
  }

  let { amount, size = 'md', label = 'שכר' }: Props = $props();

  function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('he-IL');
  }

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-xl gap-2',
  };
  const iconSize = {
    sm: 12,
    md: 14,
    lg: 18,
  };
</script>

<span
  class="inline-flex items-center font-semibold {sizeClasses[size]}"
  style="color: var(--color-text-primary); font-family: var(--font-mono);"
>
  <!-- Coin / menorah icon -->
  <svg
    viewBox="0 0 16 16"
    width={iconSize[size]}
    height={iconSize[size]}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style="color: var(--color-accent-secondary);"
  >
    <!-- 7-branch menorah simplified -->
    <line x1="8" y1="3" x2="8" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="6" y1="5" x2="6" y2="12" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    <line x1="10" y1="5" x2="10" y2="12" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    <line x1="4" y1="7" x2="4" y2="12" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/>
    <line x1="12" y1="7" x2="12" y2="12" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/>
    <line x1="3" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="6.5" y1="12" x2="9.5" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="8" cy="2.5" r="0.8" fill="currentColor"/>
    <circle cx="6" cy="4.5" r="0.7" fill="currentColor"/>
    <circle cx="10" cy="4.5" r="0.7" fill="currentColor"/>
    <circle cx="4" cy="6.5" r="0.6" fill="currentColor"/>
    <circle cx="12" cy="6.5" r="0.6" fill="currentColor"/>
  </svg>
  <span style="color: var(--color-text-primary);">{fmt(amount)}</span>
  <span class="font-normal opacity-60 text-[0.75em]" style="color: var(--color-text-secondary);">{label}</span>
</span>
