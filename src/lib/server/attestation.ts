// ═══════════════════════════════════════════════════════════════
// Rank attestation signer — EIP-712 over ChayoleiGovernance domain
// ═══════════════════════════════════════════════════════════════
//
// Closes the critical governance vulnerability where castVote() previously
// accepted a caller-supplied rankIndex with no verification. Now the backend
// (holder of ATTESTATION_SIGNER_PRIVATE_KEY) issues short-lived, single-use,
// proposal-bound attestations. The on-chain contract recovers the signer
// from the EIP-712 signature and requires it to equal `attestationSigner`.
//
// Security properties:
//   - voter must equal msg.sender (contract-enforced)
//   - expiry is unix seconds; attestations live ~5 minutes by default
//   - nonce is 32 random bytes; contract marks used on consumption
//   - rank is read from ChayoleiRegistry on-chain (NOT Firestore)
//   - signer private key should live in a KMS/HSM in production; env var
//     is acceptable for testnet only
//
import { ethers } from 'ethers';
import { env } from '$env/dynamic/private';

const {
  BASE_SEPOLIA_RPC_URL,
  ATTESTATION_SIGNER_PRIVATE_KEY,
  VITE_GOVERNANCE_ADDRESS,
  VITE_BEIS_REGISTRY_ADDRESS,
} = env;

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

const REGISTRY_ABI = [
  'function getRank(address) external view returns (uint8)',
  'function isRegistered(address) external view returns (bool)',
] as const;

const GOVERNANCE_DOMAIN_ABI = [
  'function attestationSigner() external view returns (address)',
] as const;

const RANK_ATTESTATION_TYPES = {
  RankAttestation: [
    { name: 'voter',      type: 'address' },
    { name: 'rankIndex',  type: 'uint8'   },
    { name: 'proposalId', type: 'uint256' },
    { name: 'nonce',      type: 'uint256' },
    { name: 'expiry',     type: 'uint256' },
  ],
} as const;

export interface SignedRankAttestation {
  voter: string;
  rankIndex: number;
  proposalId: string;   // decimal string of uint256
  nonce: string;        // decimal string of uint256
  expiry: number;       // unix seconds
  signature: string;    // 0x-prefixed hex
}

// ── Lazy singletons ────────────────────────────────────────────
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
function getWallet(): ethers.Wallet {
  if (!ATTESTATION_SIGNER_PRIVATE_KEY) {
    throw new Error(
      'ATTESTATION_SIGNER_PRIVATE_KEY not set. Generate a new key for the backend attestation signer (ethers.Wallet.createRandom().privateKey) and set it in .env.',
    );
  }
  if (!_wallet) {
    _wallet = new ethers.Wallet(ATTESTATION_SIGNER_PRIVATE_KEY, getProvider());
  }
  return _wallet;
}

let _chainId: number | null = null;
async function getChainId(): Promise<number> {
  if (_chainId !== null) return _chainId;
  const net = await getProvider().getNetwork();
  _chainId = Number(net.chainId);
  return _chainId;
}

function requireGovernanceAddress(): string {
  if (!VITE_GOVERNANCE_ADDRESS || !VITE_GOVERNANCE_ADDRESS.startsWith('0x')) {
    throw new Error('VITE_GOVERNANCE_ADDRESS not set in .env');
  }
  return VITE_GOVERNANCE_ADDRESS;
}

function requireRegistryAddress(): string {
  if (!VITE_BEIS_REGISTRY_ADDRESS || !VITE_BEIS_REGISTRY_ADDRESS.startsWith('0x')) {
    throw new Error('VITE_BEIS_REGISTRY_ADDRESS not set in .env');
  }
  return VITE_BEIS_REGISTRY_ADDRESS;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Look up a voter's rank directly from ChayoleiRegistry on-chain.
 * Returns null if the wallet is not registered.
 */
export async function getOnChainRank(wallet: string): Promise<number | null> {
  if (!wallet?.startsWith('0x') || wallet.length !== 42) return null;
  const registry = new ethers.Contract(
    requireRegistryAddress(),
    REGISTRY_ABI,
    getProvider(),
  );
  const registered: boolean = await registry.isRegistered(wallet);
  if (!registered) return null;
  const rank: bigint = await registry.getRank(wallet);
  return Number(rank);
}

/**
 * Produce a random 256-bit nonce as a decimal string (uint256).
 */
function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return BigInt(hex).toString();
}

/**
 * Sign a RankAttestation over the ChayoleiGovernance EIP-712 domain.
 *
 * @param voter       the voter's wallet address (the EOA that will call castVote)
 * @param rankIndex   on-chain rank (0..9) — caller is responsible for fetching this
 * @param proposalId  on-chain proposal id; use 0 until governance moves on-chain in C2
 * @param ttlSeconds  validity window; default 300s
 */
export async function signRankAttestation(
  voter: string,
  rankIndex: number,
  proposalId: bigint | number | string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<SignedRankAttestation> {
  if (!voter?.startsWith('0x') || voter.length !== 42) {
    throw new Error('voter must be a 0x-prefixed 20-byte address');
  }
  if (rankIndex < 0 || rankIndex > 9 || !Number.isInteger(rankIndex)) {
    throw new Error('rankIndex must be an integer in [0,9]');
  }
  if (ttlSeconds <= 0 || ttlSeconds > 3600) {
    throw new Error('ttlSeconds must be in (0, 3600]');
  }

  const chainId = await getChainId();
  const verifyingContract = requireGovernanceAddress();
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomNonce();
  const proposalIdStr = BigInt(proposalId).toString();

  const domain = {
    name: 'ChayoleiGovernance',
    version: '1',
    chainId,
    verifyingContract,
  };
  const message = {
    voter,
    rankIndex,
    proposalId: proposalIdStr,
    nonce,
    expiry,
  };

  const signature = await getWallet().signTypedData(
    domain,
    RANK_ATTESTATION_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    message,
  );

  return {
    voter,
    rankIndex,
    proposalId: proposalIdStr,
    nonce,
    expiry,
    signature,
  };
}

/**
 * Return the signer's address (for sanity-checking against the contract's
 * attestationSigner storage slot).
 */
export function getAttestationSignerAddress(): string {
  return getWallet().address;
}

/**
 * Read the contract's currently-configured attestationSigner address.
 * Use this to verify the backend's signer key matches the on-chain setting
 * before serving attestations (e.g. at boot time or in a health check).
 */
export async function getOnChainAttestationSigner(): Promise<string> {
  const gov = new ethers.Contract(
    requireGovernanceAddress(),
    GOVERNANCE_DOMAIN_ABI,
    getProvider(),
  );
  return (await gov.attestationSigner()) as string;
}
