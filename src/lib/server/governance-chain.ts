// On-chain proposal submission via BeisGovernance.propose(), and
// reading votes back out of confirmed transactions.
//
// The backend deployer wallet holds PROPOSER_ROLE and submits proposals on-chain
// after Firestore validation. The returned uint256 proposalId is stored in
// Firestore so the C2 reconciliation listener can cross-reference.
//
import { ethers } from 'ethers';
import type { VoteCastEvent } from '$lib/server/governance-votes';
import { env } from '$env/dynamic/private';

const {
  BASE_SEPOLIA_RPC_URL,
  DEPLOYER_PRIVATE_KEY,
  VITE_GOVERNANCE_ADDRESS,
} = env;

const GOVERNANCE_ABI = [
  'function propose(uint8 proposalType, string calldata title, string calldata description, address target, bytes calldata callData, uint256 quorumOverride) external returns (uint256)',
  'event ProposalCreated(uint256 indexed id, address indexed proposer, uint8 indexed proposalType, string title, uint256 votingStart, uint256 votingEnd)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint8 rankIndex, uint256 weight, uint256 nonce)',
];

let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(
      BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    );
  }
  return _provider;
}

let _wallet: ethers.Wallet | null = null;
function getDeployerWallet(): ethers.Wallet {
  if (!env.DEPLOYER_PRIVATE_KEY) throw new Error('DEPLOYER_PRIVATE_KEY not set');
  if (!_wallet) _wallet = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, getProvider());
  return _wallet;
}

function requireGovernanceAddress(): string {
  if (!env.VITE_GOVERNANCE_ADDRESS?.startsWith('0x')) {
    throw new Error('VITE_GOVERNANCE_ADDRESS not set or invalid');
  }
  return env.VITE_GOVERNANCE_ADDRESS;
}

export interface OnChainProposalParams {
  proposalType: number;   // ProposalType enum index (0–9)
  title: string;
  description: string;
  target: string;         // address (ZeroAddress for SIGNAL)
  callData: string;       // hex bytes ('0x' for SIGNAL)
  quorumOverride: number; // 0 → use contract default
}

export interface OnChainProposal {
  id: bigint;
  votingStart: Date;      // the contract sets the voting window, not the caller
  votingEnd: Date;
}

/**
 * Submit a proposal to ChayoleiGovernance.propose() on-chain.
 * Returns the on-chain proposalId and voting window from the ProposalCreated event.
 * Throws on RPC error or if the tx reverts.
 */
export async function submitProposalOnChain(
  params: OnChainProposalParams,
): Promise<OnChainProposal> {
  const wallet = getDeployerWallet();
  const governance = new ethers.Contract(requireGovernanceAddress(), GOVERNANCE_ABI, wallet);

  const tx = await (governance.propose as (
    a: number, b: string, c: string, d: string, e: string, f: number,
  ) => Promise<ethers.ContractTransactionResponse>)(
    params.proposalType,
    params.title,
    params.description,
    params.target,
    params.callData,
    params.quorumOverride,
  );

  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction receipt missing');

  const iface = new ethers.Interface(GOVERNANCE_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'ProposalCreated') {
        return {
          id:          parsed.args[0] as bigint,
          votingStart: new Date(Number(parsed.args[4]) * 1000),
          votingEnd:   new Date(Number(parsed.args[5]) * 1000),
        };
      }
    } catch {
      // not this event
    }
  }
  throw new Error('ProposalCreated event not found in receipt');
}

/**
 * Wait for a vote transaction to confirm and return the VoteCast event it
 * emitted, or null if it reverted or cast no vote on this governance contract.
 * Throws if the transaction is not confirmed within `timeoutMs`.
 */
export async function findVoteCastInTx(
  txHash: string,
  timeoutMs = 30_000,
): Promise<VoteCastEvent | null> {
  const receipt = await getProvider().waitForTransaction(txHash, 1, timeoutMs);
  if (!receipt || receipt.status !== 1) return null;

  const governance = requireGovernanceAddress().toLowerCase();
  const iface = new ethers.Interface(GOVERNANCE_ABI);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== governance) continue;
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'VoteCast') {
        return {
          proposalId: parsed.args[0] as bigint,
          voter:      parsed.args[1] as string,
          support:    Number(parsed.args[2]),
          rankIndex:  Number(parsed.args[3]),
          weight:     parsed.args[4] as bigint,
          nonce:      parsed.args[5] as bigint,
          txHash,
        };
      }
    } catch {
      // not this event
    }
  }
  return null;
}
