<script lang="ts">
  import { href, routePath } from '$lib/utils/nav';
  import { page } from '$app/stores';
  import { app } from '$stores/app.svelte';
  import { formatTmim } from '$lib/utils/format';
  import RankInsignia from '$components/RankInsignia.svelte';
  import InstitutionalCrest from '$components/InstitutionalCrest.svelte';

  interface NavItem {
    label: string;
    href: string;
    icon: string;
    badge?: () => number | undefined;
  }

  const mainNav: NavItem[] = [
    { label: 'בית המדרש',   href: '/',           icon: '⬡' },
    { label: 'חבורות',      href: '/chaburot',   icon: '◈' },
    { label: 'חיבורים',     href: '/chibburim',    icon: '⎇' },
    { label: 'שלבים',       href: '/seifim',   icon: '▸', badge: () => { const n = app.myTafkidim.filter(t => t.status === 'todo' || t.status === 'in_progress').length; return n > 0 ? n : undefined; } },
    { label: 'חברים',        href: '/anash',      icon: '⬡' },
    { label: 'בדיקה',        href: '/review',     icon: '✓', badge: () => { const n = app.stats.pendingReviews; return n > 0 ? n : undefined; } },
    { label: 'התוועדות',    href: '/farbrengen', icon: '◆' },
    { label: 'הכרעות',       href: '/governance', icon: '⚖', badge: () => { const n = app.myUnvotedProposals.length; return n > 0 ? n : undefined; } },
    { label: 'אוצר',        href: '/treasury',   icon: '₪' },
  ];

  const bottomNav: NavItem[] = [
    { label: 'תמיכה',  href: '/support',  icon: '♡' },
    { label: 'הגדרות', href: '/settings', icon: '⚙' },
  ];

  function isActive(href: string, currentPath: string): boolean {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  }

  let currentPath = $derived(routePath($page.url));
  let user = $derived(app.currentUser);
  let makom = $derived(app.currentMakom);
</script>

<!-- RTL sidebar: fixed to the RIGHT side -->
<aside
  class="fixed right-0 top-0 bottom-0 z-40 flex flex-col transition-all duration-200"
  class:w-64={!app.sidebarCollapsed}
  class:w-16={app.sidebarCollapsed}
  style="background-color: var(--color-bg-sidebar); border-left: 1px solid var(--color-border-sidebar);"
>
  <!-- Logo / Institutional Crest -->
  <div
    class="flex items-center gap-3 px-4 h-16 flex-shrink-0"
    style="border-bottom: 1px solid var(--color-border-sidebar);"
  >
    <a
      href={href(`/`)}
      class="flex items-center justify-center flex-shrink-0"
      aria-label="Beis — דף הבית"
    >
      <InstitutionalCrest size={32} />
    </a>
    {#if !app.sidebarCollapsed}
      <div class="flex flex-col min-w-0">
        <span class="text-sm font-semibold tracking-wide" style="color: var(--color-text-inverse);">Beis</span>
        <span class="text-[10px]" style="color: var(--color-text-inverse-secondary);">רשת לימוד תורני</span>
      </div>
    {/if}
  </div>

  <!-- Main Navigation -->
  <nav class="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto" aria-label="ניווט ראשי">
    {#each mainNav as item}
      {@const active = isActive(item.href, currentPath)}
      {@const badge = item.badge?.()}
      <a
        href={href(item.href)}
        class="flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 group relative"
        style="
          border-radius: var(--radius-sm);
          color: {active ? 'var(--color-text-inverse)' : 'var(--color-text-inverse-secondary)'};
          background-color: {active ? 'rgba(255,255,255,0.08)' : 'transparent'};
          font-weight: {active ? '600' : '400'};
          border-left: {active ? '3px solid var(--color-accent-secondary)' : '3px solid transparent'};
        "
        aria-current={active ? 'page' : undefined}
        onmouseenter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
        onmouseleave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <span class="text-base flex-shrink-0 w-5 text-center" aria-hidden="true">{item.icon}</span>
        {#if !app.sidebarCollapsed}
          <span class="flex-1 truncate">{item.label}</span>
          {#if badge}
            <span
              class="badge"
              style="
                background-color: {item.href === '/governance' ? 'rgba(180,83,9,0.15)' : 'var(--color-accent-secondary-light)'};
                color: {item.href === '/governance' ? '#b45309' : 'var(--color-accent-secondary)'};
              "
              aria-label="{badge} פריטים"
            >{badge}</span>
          {/if}
        {/if}
      </a>
    {/each}
  </nav>

  <!-- Divider -->
  <div style="height: 1px; background-color: var(--color-border-sidebar); margin: 0 0.5rem;"></div>

  <!-- Bottom Navigation -->
  <div class="px-2 py-1">
    {#each bottomNav as item}
      {@const active = isActive(item.href, currentPath)}
      <a
        href={href(item.href)}
        class="flex items-center gap-3 px-3 py-2 text-sm transition-all duration-150"
        style="
          border-radius: var(--radius-sm);
          color: {active ? 'var(--color-text-inverse)' : 'var(--color-text-inverse-secondary)'};
          background-color: {active ? 'rgba(255,255,255,0.08)' : 'transparent'};
          font-weight: {active ? '600' : '400'};
          border-left: {active ? '3px solid var(--color-accent-secondary)' : '3px solid transparent'};
        "
        aria-current={active ? 'page' : undefined}
        onmouseenter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
        onmouseleave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <span class="text-base flex-shrink-0 w-5 text-center" aria-hidden="true">{item.icon}</span>
        {#if !app.sidebarCollapsed}<span class="flex-1 truncate">{item.label}</span>{/if}
      </a>
    {/each}
  </div>

  <!-- User identity section -->
  {#if user}
    <div style="border-top: 1px solid var(--color-border-sidebar);" class="p-3">
      <a href={href(`/settings`)} class="block" aria-label="הגדרות פרופיל — {user.shem}">
        {#if !app.sidebarCollapsed}
          <div class="flex items-center gap-3">
            <div class="relative flex-shrink-0">
              <RankInsignia score={user.contribution_score} size="sm" />
              <div
                class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                style="background-color: {user.isOnline ? 'var(--color-status-success)' : 'var(--color-text-tertiary)'}; border: 2px solid var(--color-bg-sidebar);"
                aria-hidden="true"
              ></div>
            </div>
            <div class="flex flex-col min-w-0 gap-0.5">
              <span class="text-sm font-medium truncate" style="color: var(--color-text-inverse);">{user.shem}</span>
              <span class="text-[10px]" style="color: var(--color-text-inverse-secondary);">{makom ? makom.shem : ''}</span>
              <span class="text-[10px] font-mono" style="color: var(--color-accent-secondary);">{formatTmim(user.tokenBalance)}</span>
            </div>
          </div>
        {:else}
          <div class="flex justify-center">
            <RankInsignia score={user.contribution_score} size="sm" />
          </div>
        {/if}
      </a>
    </div>
  {/if}

  <!-- Sign out -->
  <button
    onclick={() => app.signOut()}
    class="px-3 py-2 text-xs w-full flex items-center gap-3 transition-colors duration-150"
    style="border-top: 1px solid var(--color-border-sidebar); color: var(--color-text-inverse-secondary);"
    onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-status-error)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
    onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-inverse-secondary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
  >
    <span class="text-base flex-shrink-0 w-5 text-center">⏻</span>
    {#if !app.sidebarCollapsed}<span>יציאה</span>{/if}
  </button>

  <!-- Collapse toggle -->
  <button
    onclick={() => app.toggleSidebar()}
    class="p-2 text-xs text-center w-full transition-colors duration-150"
    style="border-top: 1px solid var(--color-border-sidebar); color: var(--color-text-inverse-secondary);"
    onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-inverse)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
    onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-inverse-secondary)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    aria-label={app.sidebarCollapsed ? 'פתח סרגל צד' : 'כווץ סרגל צד'}
  >
    {app.sidebarCollapsed ? '←' : 'כווץ →'}
  </button>
</aside>
