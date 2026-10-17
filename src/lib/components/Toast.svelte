<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';

  const borderColor: Record<string, string> = {
    success: 'var(--color-status-success)',
    error:   'var(--color-status-error)',
    warning: 'var(--color-status-warning)',
    info:    'var(--color-status-info)',
  };
</script>

{#if toast.toasts.length > 0}
  <div class="fixed top-4 left-4 z-[100] flex flex-col gap-2 max-w-sm" dir="rtl">
    {#each toast.toasts as t (t.id)}
      <div
        class="flex items-start gap-3 shadow-md animate-slide-in"
        style="
          background-color: var(--color-bg-topbar);
          border-radius: var(--radius-lg);
          padding: 0.75rem 1rem;
          box-shadow: var(--shadow-md);
          border-right: 4px solid {borderColor[t.type] ?? borderColor.info};
        "
      >
        <span class="flex-1 text-sm font-medium" style="color: var(--color-text-primary);">
          {t.message}
          {#if t.link}
            <a
              href={t.link.href}
              target="_blank"
              rel="noopener noreferrer"
              class="block mt-1 text-xs underline"
              style="color: var(--color-text-link);"
            >{t.link.label}</a>
          {/if}
        </span>
        <button
          onclick={() => toast.dismiss(t.id)}
          class="flex-shrink-0 text-xs transition-colors duration-150"
          style="color: var(--color-text-tertiary);"
          onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'}
          onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'}
          aria-label="סגור"
        >✕</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes slide-in {
    from { transform: translateX(-100%); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  }
  .animate-slide-in {
    animation: slide-in 0.25s ease-out;
  }
</style>
