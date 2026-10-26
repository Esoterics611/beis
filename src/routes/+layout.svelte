<script lang="ts">
  import { go, routePath } from '$lib/utils/nav';
  import '../app.css';
  import Sidebar from '$components/Sidebar.svelte';
  import TopBar from '$components/TopBar.svelte';
  import Toast from '$components/Toast.svelte';
  import LoadingOverlay from '$components/LoadingOverlay.svelte';
  import { app } from '$stores/app.svelte';
  import { page } from '$app/stores';

  let { children } = $props();

  // Redirect unauthenticated users to /signup (except when already on /signup)
  $effect(() => {
    if (!app.isAuthenticated && !routePath($page.url).startsWith('/signup')) {
      go('/signup');
    }
  });
</script>

<LoadingOverlay />

{#if app.isAuthenticated}
  <div class="flex min-h-screen" dir="rtl">
    <!-- תוכן ראשי — מוזז שמאלה לפי רוחב הסרגל -->
    <div
      class="flex-1 flex flex-col transition-all duration-200"
      class:mr-64={!app.sidebarCollapsed}
      class:mr-16={app.sidebarCollapsed}
    >
      <TopBar />
      <main class="flex-1 p-6" id="main-content">
        {@render children()}
      </main>
    </div>

    <!-- סרגל צד — קבוע בצד ימין -->
    <Sidebar />
  </div>
{:else}
  {@render children()}
{/if}

<Toast />
