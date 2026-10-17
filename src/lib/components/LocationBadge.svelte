<script lang="ts">
  interface Props {
    shem: string;
    status?: 'active' | 'forming' | 'inactive';
  }

  let { shem, status = 'active' }: Props = $props();

  const dotColor: Record<string, string> = {
    active:   'var(--color-status-success)',
    forming:  'var(--color-status-warning)',
    inactive: 'var(--color-text-tertiary)',
  };
</script>

<span
  class="inline-flex items-center gap-1 text-[11px] font-medium"
  style="
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-secondary);
  "
>
  <!-- Map pin icon -->
  <svg viewBox="0 0 14 14" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="color: var(--color-text-tertiary); flex-shrink: 0;">
    <path d="M7 1C4.8 1 3 2.8 3 5C3 8 7 13 7 13C7 13 11 8 11 5C11 2.8 9.2 1 7 1Z" stroke="currentColor" stroke-width="1.2" fill="none"/>
    <circle cx="7" cy="5" r="1.5" stroke="currentColor" stroke-width="1" fill="none"/>
  </svg>
  {shem}
</span>
