// Links for the app. It uses normal paths; the static demo (scripts/build-demo.sh)
// builds with SvelteKit's hash router and VITE_HASH_ROUTER=1, so every link,
// navigation and read of the URL goes through these helpers.

import { goto } from '$app/navigation';

const HASH = import.meta.env.VITE_HASH_ROUTER === '1';

/** A link to an app path, e.g. "/chaburot/mv-001" or "/support?intent=x". */
export const href = (path: string): string => (HASH ? `#${path}` : path);

/** Navigate to an app path. */
export const go = (path: string): Promise<void> => goto(href(path));

/** The app path of a URL, in either routing mode. */
export function routePath(url: URL): string {
  return HASH ? (url.hash.slice(1) || '/').split('?')[0] : url.pathname;
}

/** A query parameter of the app path, in either routing mode. */
export function routeQuery(url: URL, name: string): string | null {
  if (!HASH) return url.searchParams.get(name);
  const query = url.hash.split('?')[1];
  return query ? new URLSearchParams(query).get(name) : null;
}
