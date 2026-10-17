<script lang="ts">
  interface Props {
    shem: string;
    score?: number;
    isOnline?: boolean;
    size?: 'sm' | 'md' | 'lg';
    locationCode?: string;
  }

  let { shem, isOnline = false, size = 'md', locationCode }: Props = $props();
  let initial = $derived(shem.charAt(0));

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  };
  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };
</script>

<div class="relative flex-shrink-0 flex flex-col items-center gap-0.5">
  <div
    class="rounded-full flex items-center justify-center font-bold {sizeClasses[size]}"
    style="
      background-color: var(--color-bg-tertiary);
      color: var(--color-text-primary);
      border: 2px solid var(--color-border-primary);
      font-family: var(--font-hebrew);
    "
  >
    {initial}
  </div>

  <!-- Online status dot -->
  <div
    class="absolute -bottom-0.5 -right-0.5 rounded-full {dotSize[size]}"
    style="
      background-color: {isOnline ? 'var(--color-status-success)' : 'var(--color-bg-tertiary)'};
      border: 2px solid var(--color-bg-topbar);
    "
    aria-hidden="true"
  ></div>

  {#if locationCode}
    <span class="text-[8px] leading-none" style="color: var(--color-text-tertiary); font-family: var(--font-mono);">{locationCode}</span>
  {/if}
</div>
