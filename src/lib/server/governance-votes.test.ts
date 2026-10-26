// Runs against the Firestore emulator: `npm test` starts it, runs vitest, stops it.
import { beforeEach, describe, expect, it } from 'vitest';
import { adminDb } from '$lib/server/firebase-admin';
import { findProposalRef, proposalDocId, recordVoteCast } from './governance-votes';
import type { VoteCastEvent } from './governance-votes';

const PROPOSAL_ID = 7n;
const VOTER = '0xAbC0000000000000000000000000000000000001';

const vote = (overrides: Partial<VoteCastEvent> = {}): VoteCastEvent => ({
  proposalId: PROPOSAL_ID,
  voter: VOTER,
  support: 0,
  rankIndex: 2,
  weight: 600n,
  nonce: 1n,
  txHash: '0x' + 'ab'.repeat(32),
  ...overrides,
});

const proposalRef = () => adminDb.collection('proposals').doc(proposalDocId(PROPOSAL_ID));

beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const project = process.env.GCLOUD_PROJECT;
  if (!host || !project) throw new Error('Run with the Firestore emulator: npm test');
  await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  await proposalRef().set({
    onChainProposalId: PROPOSAL_ID.toString(),
    votesFor: 0, votesAgainst: 0, votesAbstain: 0,
    quorumRequired: 1_000,
    quorumReached: false,
  });
});

describe('recordVoteCast', () => {
  it('counts a vote once when the endpoint and the listener both record it', async () => {
    const results = await Promise.all([
      recordVoteCast(vote(), 'wallet_talmid'),
      recordVoteCast(vote()),
    ]);
    expect(results.sort()).toEqual(['duplicate', 'recorded']);

    const p = (await proposalRef().get()).data()!;
    expect(p.votesFor).toBe(600);
    expect(p.votesAgainst).toBe(0);

    const v = (await proposalRef().collection('votes').doc(VOTER.toLowerCase()).get()).data()!;
    expect(v).toMatchObject({ vote: 'for', power: 600, walletAddress: VOTER.toLowerCase(), onChain: true });
    expect(v.talmidId).toBe('wallet_talmid');
  });

  it('does not count a replayed event again', async () => {
    expect(await recordVoteCast(vote())).toBe('recorded');
    expect(await recordVoteCast(vote())).toBe('duplicate');
    expect((await proposalRef().get()).get('votesFor')).toBe(600);
  });

  it('fills in the talmid when the listener recorded the vote first', async () => {
    await recordVoteCast(vote());
    await recordVoteCast(vote(), 'wallet_talmid');
    const v = await proposalRef().collection('votes').doc(VOTER.toLowerCase()).get();
    expect(v.get('talmidId')).toBe('wallet_talmid');
  });

  it('adds each voter to the tally for their choice and flags quorum', async () => {
    await recordVoteCast(vote({ support: 1, weight: 400n }));
    expect((await proposalRef().get()).get('quorumReached')).toBe(false);

    await recordVoteCast(vote({ voter: '0x00000000000000000000000000000000000000b2', support: 2, weight: 600n }));
    const p = (await proposalRef().get()).data()!;
    expect(p.votesAgainst).toBe(400);
    expect(p.votesAbstain).toBe(600);
    expect(p.quorumReached).toBe(true);
  });

  it('ignores votes for proposals Firestore does not know', async () => {
    expect(await recordVoteCast(vote({ proposalId: 99n }))).toBe('unknown_proposal');
  });

  it('finds older proposals stored under random doc ids', async () => {
    await proposalRef().delete();
    const legacy = adminDb.collection('proposals').doc('legacy-random-id');
    await legacy.set({ onChainProposalId: PROPOSAL_ID.toString(), votesFor: 0, votesAgainst: 0, votesAbstain: 0, quorumRequired: 0 });

    expect((await findProposalRef(PROPOSAL_ID))?.id).toBe('legacy-random-id');
    expect(await recordVoteCast(vote())).toBe('recorded');
    expect((await legacy.get()).get('votesFor')).toBe(600);
  });
});
