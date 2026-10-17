// SvelteKit layout load — boots auth state on client.
// SSR is disabled because Firebase SDK is client-only.
export const ssr = false;

export const load = async () => {
  if (typeof window === 'undefined') return {};

  // Check if Firebase is configured
  const hasFirebase = !!import.meta.env.VITE_FIREBASE_API_KEY;

  if (hasFirebase) {
    // Dynamic imports so Firebase is only loaded client-side
    const { auth } = await import('$lib/firebase');
    const { onAuthStateChanged } = await import('firebase/auth');
    const { app } = await import('$stores/app.svelte');

    return new Promise<Record<string, never>>((resolve) => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        unsub(); // one-shot listener — subsequent auth changes handled by app store

        if (user) {
          app.isAuthenticated = true;
          app.currentUserId = user.uid;
          // Pull role from JWT claims so isMashpia is correct before Firestore syncs
          const idTokenResult = await user.getIdTokenResult();
          app.currentRole = (idTokenResult.claims.role as 'chaver' | 'mashpia' | 'admin') ?? 'chaver';
          await app.startListeners();
        } else {
          app.isAuthenticated = false;
          app.currentUserId = null;
          app.stopListeners();
        }
        resolve({});
      });
    });
  } else {
    // Dev mode — no Firebase config, use mock data
    const { app } = await import('$stores/app.svelte');
    // Start listeners will load mock data since USE_FIREBASE is false
    app.isAuthenticated = true;
    await app.startListeners();
    return {};
  }
};
