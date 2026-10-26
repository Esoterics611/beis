<script lang="ts">
  import { href, routePath } from '$lib/utils/nav';
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';

  const routeTitles: Record<string, string> = {
    '/':            'בית המדרש',
    '/chaburot':    'חבורות',
    '/chibburim':     'חיבורים',
    '/seifim':    'שלבים',
    '/anash':       'חברים',
    '/review':      'בדיקה',
    '/farbrengen':  'התוועדות',
    '/governance':  'הכרעות',
    '/treasury':    'אוצר',
    '/support':     'תמיכה',
    '/settings':    'הגדרות',
  };

  let currentPath = $derived(routePath($page.url));
  let title = $derived(routeTitles[currentPath] ?? 'Beis');

  let breadcrumbs = $derived(() => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) return [];
    return parts.slice(0, -1).map((part, i) => ({
      label: routeTitles['/' + part] ?? part,
      href: '/' + parts.slice(0, i + 1).join('/')
    }));
  });
</script>

<header
  class="h-16 flex items-center justify-between px-6 sticky top-0 z-30"
  style="background-color: var(--color-bg-topbar); border-bottom: 1px solid var(--color-border-primary);"
>
  <!-- Right side (RTL start): breadcrumbs + title -->
  <div class="flex items-center gap-3">
    {#if breadcrumbs().length > 0}
      <nav aria-label="פירורי לחם" class="flex items-center gap-1">
        {#each breadcrumbs() as crumb}
          <a
            href={href(crumb.href)}
            class="text-xs transition-colors duration-150"
            style="color: var(--color-text-secondary); text-decoration: none;"
            onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'}
            onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'}
          >{crumb.label}</a>
          <span class="text-xs" style="color: var(--color-border-primary);" aria-hidden="true">›</span>
        {/each}
      </nav>
    {/if}
    <h1
      class="text-base font-semibold"
      style="color: var(--color-text-primary); font-family: var(--font-hebrew); margin: 0;"
    >{title}</h1>
  </div>

  <!-- Left side (RTL end): search + notifications -->
  <div class="flex items-center gap-3">
    <!-- Search -->
    <button
      class="flex items-center gap-2 px-3 py-1.5 text-xs transition-all duration-150"
      style="
        border-radius: var(--radius-md);
        background-color: var(--color-bg-secondary);
        border: 1px solid var(--color-border-primary);
        color: var(--color-text-tertiary);
      "
      onmouseenter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-strong)';
        (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
      }}
      onmouseleave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)';
        (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
      }}
      aria-label="פתח חיפוש"
    >
      <span>חיפוש...</span>
      <kbd
        class="text-[10px] px-1.5 py-0.5 rounded"
        style="background-color: var(--color-bg-tertiary); border: 1px solid var(--color-border-primary); font-family: var(--font-mono);"
        aria-label="קיצור דרך: Command K"
      >⌘K</kbd>
    </button>

    <!-- Notifications bell -->
    <button
      class="relative p-2 transition-colors duration-150"
      style="border-radius: var(--radius-md); color: var(--color-text-tertiary);"
      onmouseenter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-secondary)';
        (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
      }}
      onmouseleave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
      }}
      aria-label={app.stats.pendingReviews > 0 ? `${app.stats.pendingReviews} התראות ממתינות` : 'אין התראות חדשות'}
    >
      <span class="text-sm" aria-hidden="true">◉</span>
      {#if app.stats.pendingReviews > 0}
        <span
          class="absolute top-1 right-1 w-2 h-2 rounded-full"
          style="background-color: var(--color-accent-secondary);"
          aria-hidden="true"
        ></span>
      {/if}
    </button>
  </div>
</header>
