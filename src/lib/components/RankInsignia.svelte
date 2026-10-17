<script lang="ts">
  interface Props {
    score: number;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showLabel?: boolean;
    glow?: boolean; // kept for API compatibility, ignored
  }

  let { score, size = 'md', showLabel = false }: Props = $props();

  type Tier = 'tier-enlisted' | 'tier-nco' | 'tier-officer';

  interface TierMeta { shem: string; tier: Tier; svg: string }

  /**
   * Score thresholds:
   *   < 1,000  → מתחיל  (enlisted) — open sefer
   *   < 10,000 → בקי    (NCO)      — Torah scroll
   *   ≥ 10,000 → מורה   (officer)  — crown + scroll
   */
  const tiers: TierMeta[] = [
    {
      shem: 'מתחיל',
      tier: 'tier-enlisted',
      svg: `
        <path d="M5 9 L14 7 L14 25 L5 23 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        <path d="M18 7 L27 9 L27 23 L18 25 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        <line x1="16" y1="7" x2="16" y2="25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="7" y1="13" x2="12" y2="12.5" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="7" y1="16" x2="12" y2="15.5" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="7" y1="19" x2="12" y2="18.5" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="20" y1="12.5" x2="25" y2="13" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="20" y1="15.5" x2="25" y2="16" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="20" y1="18.5" x2="25" y2="19" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
      `,
    },
    {
      shem: 'בקי',
      tier: 'tier-nco',
      svg: `
        <circle cx="5" cy="16" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <line x1="5" y1="5" x2="5" y2="27" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="27" cy="16" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <line x1="27" y1="5" x2="27" y2="27" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <rect x="8" y="10" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <path d="M8 10 Q16 7.5 24 10" stroke="currentColor" stroke-width="0.8" fill="none"/>
        <path d="M8 22 Q16 24.5 24 22" stroke="currentColor" stroke-width="0.8" fill="none"/>
        <line x1="12" y1="13" x2="20" y2="13" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="12" y1="16" x2="20" y2="16" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
        <line x1="12" y1="19" x2="18" y2="19" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
      `,
    },
    {
      shem: 'מורה',
      tier: 'tier-officer',
      svg: `
        <circle cx="5" cy="24" r="1.8" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <line x1="5" y1="18" x2="5" y2="30" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="27" cy="24" r="1.8" stroke="currentColor" stroke-width="1.2" fill="none"/>
        <line x1="27" y1="18" x2="27" y2="30" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <rect x="7" y="20" width="18" height="8" rx="0.8" stroke="currentColor" stroke-width="1" fill="none"/>
        <line x1="9.5" y1="23" x2="22.5" y2="23" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
        <line x1="9.5" y1="26" x2="20.5" y2="26" stroke="currentColor" stroke-width="0.7" opacity="0.6"/>
        <path d="M7 18 L7 13 L9.5 15.5 L12.5 12 L16 8.5 L19.5 12 L22.5 15.5 L25 13 L25 18 Z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2" stroke-linejoin="round"/>
        <circle cx="7" cy="13" r="1.2" fill="currentColor"/>
        <circle cx="25" cy="13" r="1.2" fill="currentColor"/>
        <circle cx="16" cy="9" r="1.2" fill="currentColor"/>
        <line x1="16" y1="5" x2="16" y2="8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="13" y1="6" x2="13" y2="8.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="19" y1="6" x2="19" y2="8.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="11" y1="7" x2="11" y2="8.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="21" y1="7" x2="21" y2="8.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
        <line x1="10" y1="8.5" x2="22" y2="8.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
        <circle cx="13" cy="5.5" r="0.8" fill="currentColor"/>
        <circle cx="19" cy="5.5" r="0.8" fill="currentColor"/>
        <circle cx="11" cy="6.5" r="0.7" fill="currentColor"/>
        <circle cx="21" cy="6.5" r="0.7" fill="currentColor"/>
        <circle cx="16" cy="4.5" r="0.9" fill="currentColor"/>
      `,
    },
  ];

  let meta = $derived(
    score >= 10000 ? tiers[2] : score >= 1000 ? tiers[1] : tiers[0]
  );

  const sizeMap = {
    sm: { box: 'w-6 h-6', svg: 16 },
    md: { box: 'w-8 h-8', svg: 22 },
    lg: { box: 'w-11 h-11', svg: 32 },
    xl: { box: 'w-16 h-16', svg: 48 },
  };
  let s = $derived(sizeMap[size]);
</script>

<div class="flex items-center gap-1.5" title={meta.shem}>
  <div
    class="relative flex items-center justify-center {s.box} {meta.tier}"
    style="border-radius: var(--radius-sm);"
  >
    <svg viewBox="0 0 32 32" width={s.svg} height={s.svg} xmlns="http://www.w3.org/2000/svg">
      {@html meta.svg}
    </svg>
  </div>
  {#if showLabel}
    <div class="flex flex-col">
      <span class="text-[10px] font-bold {meta.tier}">{meta.shem}</span>
    </div>
  {/if}
</div>
