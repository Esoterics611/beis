<script lang="ts">
  interface Props {
    score: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }

  let { score, showLabel = false, size = 'sm' }: Props = $props();

  type Tier = 'enlisted' | 'nco' | 'officer';

  interface TierInfo { shem: string; tier: Tier }

  const tierInfo: TierInfo = $derived(
    score >= 10000
      ? { shem: 'מורה',   tier: 'officer'  }
      : score >= 1000
      ? { shem: 'בקי',    tier: 'nco'      }
      : { shem: 'מתחיל', tier: 'enlisted' }
  );

  const tierBg: Record<Tier, string> = {
    enlisted: 'var(--color-tier-enlisted-light)',
    nco:      'var(--color-tier-nco-light)',
    officer:  'var(--color-tier-officer-light)',
  };
  const tierColor: Record<Tier, string> = {
    enlisted: 'var(--color-tier-enlisted)',
    nco:      'var(--color-tier-nco)',
    officer:  'var(--color-tier-officer)',
  };
  const tierBorder: Record<Tier, string> = {
    enlisted: 'rgba(93, 109, 63, 0.2)',
    nco:      'rgba(27, 79, 114, 0.2)',
    officer:  'rgba(125, 108, 63, 0.2)',
  };

  const sizeClasses = {
    sm: 'text-[11px] gap-1',
    md: 'text-xs gap-1.5',
    lg: 'text-sm gap-2',
  };
  const paddingClasses = {
    sm: 'px-2 py-0.5',
    md: 'px-2.5 py-1',
    lg: 'px-3 py-1.5',
  };
</script>

<div class="flex items-center gap-1.5">
  <span
    class="inline-flex items-center font-semibold {sizeClasses[size]} {paddingClasses[size]}"
    style="
      border-radius: var(--radius-sm);
      background-color: {tierBg[tierInfo.tier]};
      color: {tierColor[tierInfo.tier]};
      border: 1px solid {tierBorder[tierInfo.tier]};
    "
  >
    {tierInfo.shem}
  </span>
  {#if showLabel}
    <span class="text-xs" style="color: var(--color-text-tertiary);">{score.toLocaleString()}</span>
  {/if}
</div>
