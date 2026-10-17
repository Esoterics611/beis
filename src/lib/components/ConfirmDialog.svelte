<script lang="ts">
  let {
    open = false,
    title = 'אישור',
    message = 'האם אתה בטוח?',
    confirmLabel = 'אישור',
    cancelLabel = 'ביטול',
    destructive = false,
    onconfirm = () => {},
    oncancel = () => {},
  }: {
    open: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onconfirm?: () => void;
    oncancel?: () => void;
  } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[90] flex items-center justify-center p-4" dir="rtl">
    <!-- backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="absolute inset-0" style="background-color: rgba(0,0,0,0.3);" onclick={oncancel}></div>

    <!-- dialog -->
    <div
      class="relative z-10 w-full"
      style="
        max-width: 440px;
        background-color: var(--color-bg-topbar);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        padding: 1.5rem;
      "
    >
      <h3 class="mb-2" style="font-size: 1.25rem; font-weight: 600; color: var(--color-text-primary);">{title}</h3>
      <p class="mb-5" style="font-size: 1rem; color: var(--color-text-secondary); line-height: 1.6;">{message}</p>

      <div style="border-top: 1px solid var(--color-border-secondary); padding-top: 1rem;" class="flex gap-3 justify-end">
        <button
          onclick={oncancel}
          style="
            padding: 0.5rem 1.25rem;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
            font-weight: 500;
            background-color: var(--color-bg-secondary);
            color: var(--color-text-secondary);
            border: 1px solid var(--color-border-primary);
            cursor: pointer;
            transition: background-color var(--transition-fast);
          "
          onmouseenter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)'}
          onmouseleave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-secondary)'}
        >{cancelLabel}</button>

        <button
          onclick={onconfirm}
          style="
            padding: 0.5rem 1.25rem;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color var(--transition-fast);
            background-color: {destructive ? 'var(--color-status-error)' : 'var(--color-accent-primary)'};
            color: var(--color-text-inverse);
            border: none;
          "
          onmouseenter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = destructive ? '#7B241C' : 'var(--color-accent-primary-hover)'}
          onmouseleave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = destructive ? 'var(--color-status-error)' : 'var(--color-accent-primary)'}
        >{confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}
