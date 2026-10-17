import { startGovernanceListener } from '$lib/server/governance-listener';
import type { Handle } from '@sveltejs/kit';

// Start the governance chain → Firestore reconciliation listener once,
// when the SvelteKit server process initialises.
startGovernanceListener();

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
