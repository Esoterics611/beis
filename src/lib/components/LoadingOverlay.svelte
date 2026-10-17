<script lang="ts">
  import { app } from '$stores/app.svelte';
</script>

{#if app.loading}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    style="background-color: rgba(250, 247, 242, 0.85);"
  >
    <div class="flex flex-col items-center gap-4">
      <div class="spinner"></div>
      <p class="text-sm" style="color: var(--color-text-secondary);">טוען...</p>
    </div>
  </div>
{/if}

{#if app.error}
  <div class="fixed bottom-6 left-6 z-50 max-w-sm">
    <div
      class="flex items-start gap-3 p-4"
      style="
        border-radius: var(--radius-lg);
        background-color: var(--color-bg-topbar);
        border: 1px solid var(--color-border-primary);
        border-right: 4px solid var(--color-status-error);
        box-shadow: var(--shadow-md);
      "
    >
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium" style="color: var(--color-text-primary);">שגיאת חיבור</p>
        <p class="text-xs mt-1 break-words" style="color: var(--color-text-secondary);">{app.error}</p>
      </div>
      <button
        onclick={() => app.error = null}
        class="text-sm flex-shrink-0 transition-colors duration-150"
        style="color: var(--color-text-tertiary);"
        onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'}
        onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'}
      >✕</button>
    </div>
  </div>
{/if}
