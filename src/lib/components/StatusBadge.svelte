<script lang="ts">
  import { statusLabel } from '$lib/utils/format';

  interface Props {
    status: string;
    size?: 'sm' | 'md';
  }

  let { status, size = 'sm' }: Props = $props();

  function badgeStyle(s: string): string {
    const map: Record<string, string> = {
      open:               'background-color:var(--color-status-info-light);color:var(--color-status-info);border-color:rgba(27,79,114,0.3)',
      in_progress:        'background-color:var(--color-status-warning-light);color:var(--color-status-warning);border-color:rgba(166,123,44,0.3)',
      submitted:          'background-color:var(--color-status-info-light);color:var(--color-status-info);border-color:rgba(27,79,114,0.3)',
      in_review:          'background-color:var(--color-status-warning-light);color:var(--color-status-warning);border-color:rgba(166,123,44,0.3)',
      revision_requested: 'background-color:var(--color-status-error-light);color:var(--color-status-error);border-color:rgba(146,43,33,0.3)',
      approved:           'background-color:var(--color-status-success-light);color:var(--color-status-success);border-color:rgba(30,111,80,0.3)',
      completed:          'background-color:var(--color-status-success-light);color:var(--color-status-success);border-color:rgba(30,111,80,0.3)',
      published:          'background-color:var(--color-status-success-light);color:var(--color-status-success);border-color:rgba(30,111,80,0.3)',
      rejected:           'background-color:var(--color-status-error-light);color:var(--color-status-error);border-color:rgba(146,43,33,0.3)',
      failed:             'background-color:var(--color-status-error-light);color:var(--color-status-error);border-color:rgba(146,43,33,0.3)',
      draft:              'background-color:var(--color-status-draft-light);color:var(--color-status-draft);border-color:rgba(138,127,114,0.3)',
      archived:           'background-color:var(--color-status-draft-light);color:var(--color-status-draft);border-color:rgba(138,127,114,0.3)',
      active:             'background-color:var(--color-accent-primary-light);color:var(--color-accent-primary);border-color:rgba(27,79,114,0.3)',
      pending:            'background-color:var(--color-status-warning-light);color:var(--color-status-warning);border-color:rgba(166,123,44,0.3)',
      todo:               'background-color:var(--color-status-info-light);color:var(--color-status-info);border-color:rgba(27,79,114,0.3)',
    };
    return map[s] ?? 'background-color:var(--color-status-draft-light);color:var(--color-status-draft);border-color:rgba(138,127,114,0.3)';
  }
</script>

<span
  class="badge"
  class:text-xs={size === 'sm'}
  class:text-sm={size === 'md'}
  style="border: 1px solid; {badgeStyle(status)}"
>
  {statusLabel(status)}
</span>
