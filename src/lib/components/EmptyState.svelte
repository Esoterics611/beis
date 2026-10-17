<script lang="ts">
  interface Props {
    icon?: string;
    title: string;
    description?: string;
    actionLabel?: string;
    onaction?: () => void;
  }
  let { icon = '◇', title, description, actionLabel, onaction }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center" style="max-width: 400px; margin: 0 auto; padding: 3rem 1.5rem;">
  <span class="text-4xl mb-4" style="color: var(--color-text-tertiary);" aria-hidden="true">{icon}</span>
  <h3
    class="mb-2"
    style="font-size: 1.25rem; font-weight: 600; color: var(--color-text-secondary); font-family: var(--font-hebrew);"
  >{title}</h3>
  {#if description}
    <p
      class="mb-6"
      style="font-size: 0.875rem; color: var(--color-text-tertiary); line-height: 1.6; max-width: 320px;"
    >{description}</p>
  {/if}
  {#if actionLabel && onaction}
    <button
      onclick={onaction}
      style="
        padding: 0.5rem 1.25rem;
        border-radius: var(--radius-md);
        background-color: var(--color-accent-primary);
        color: var(--color-text-inverse);
        font-size: 0.875rem;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: background-color var(--transition-fast);
      "
      onmouseenter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-accent-primary-hover)'}
      onmouseleave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-accent-primary)'}
    >{actionLabel}</button>
  {/if}
</div>
