// ═══════════════════════════════════════════════════════════════
// Server-side contract helpers — Base Sepolia
// ═══════════════════════════════════════════════════════════════
import { ethers } from 'ethers';
import { env } from '$env/dynamic/private';

const {
  BASE_SEPOLIA_RPC_URL,
  DEPLOYER_PRIVATE_KEY,
  VITE_CHIBBUR_REWARDS_ADDRESS,
  VITE_SECHAR_TOKEN_ADDRESS,
} = env;

// ── ABIs (minimal — only what we call) ────────────────────────
const CHIBBUR_REWARDS_ABI = [
  'function approveMasima(bytes32 masimaIdHash, address assignee, uint256 reward) external',
  'function approveTafkid(bytes32 tafkidIdHash, address assignee, uint256 reward) external',
  'function isMasimaApproved(bytes32) external view returns (bool)',
  'function isTafkidApproved(bytes32) external view returns (bool)',
] as const;

const TREASURY_ABI = [
  'function receiveETH() external payable',
] as const;

const שכר_ABI = [
  'function burn(address from, uint256 amount) external',
] as const;

// ── provider / signer (lazy) ───────────────────────────────────
let _provider: ethers.JsonRpcProvider | null = null;
let _signer:   ethers.Wallet | null = null;

function getSigner(): ethers.Wallet {
  if (!_signer) {
    if (!DEPLOYER_PRIVATE_KEY) throw new Error('DEPLOYER_PRIVATE_KEY not set in .env');
    const rpc = BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    _provider = new ethers.JsonRpcProvider(rpc);
    _signer   = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, _provider);
  }
  return _signer;
}

export function getChibburRewardsContract() {
  if (!VITE_CHIBBUR_REWARDS_ADDRESS) throw new Error('VITE_CHIBBUR_REWARDS_ADDRESS not set in .env');
  return new ethers.Contract(VITE_CHIBBUR_REWARDS_ADDRESS, CHIBBUR_REWARDS_ABI, getSigner());
}

// ── helpers ───────────────────────────────────────────────────

/** Convert a Firestore doc ID string to bytes32 */
export function idToBytes32(id: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(id));
}

/** Convert שכר amount to contract units.
 *  שכרToken uses 0 decimals — 1 שכר = 1 token unit. */
export function tmimToWei(amount: number): bigint {
  return BigInt(amount);
}

export const BASESCAN_BASE_SEPOLIA = 'https://sepolia.basescan.org/tx';

/**
 * Mint שכר on-chain by calling ChibburRewards.approveMasima().
 * Returns the tx hash, or null if the assignee has no wallet or already approved.
 */
export async function mintMasimaReward(
  masimaId: string,
  assigneeWallet: string,
  tmimAmount: number,
): Promise<string | null> {
  if (!assigneeWallet || !assigneeWallet.startsWith('0x')) return null;
  if (tmimAmount <= 0) return null;

  const contract  = getChibburRewardsContract();
  const idHash    = idToBytes32(masimaId);

  // Skip if already minted on-chain
  const already = await contract.isMasimaApproved(idHash);
  if (already) return null;

  const tx = await contract.approveMasima(
    idHash,
    assigneeWallet,
    tmimToWei(tmimAmount),
  );
  await tx.wait(1); // wait 1 confirmation
  return tx.hash;
}

export async function mintTafkidReward(
  tafkidId: string,
  assigneeWallet: string,
  tmimAmount: number,
): Promise<string | null> {
  if (!assigneeWallet || !assigneeWallet.startsWith('0x')) return null;
  if (tmimAmount <= 0) return null;

  const contract = getChibburRewardsContract();
  const idHash   = idToBytes32(tafkidId);

  const already = await contract.isTafkidApproved(idHash);
  if (already) return null;

  const tx = await contract.approveTafkid(
    idHash,
    assigneeWallet,
    tmimToWei(tmimAmount),
  );
  await tx.wait(1);
  return tx.hash;
}

/**
 * Redeem שכר on-chain:
 *   1. Burn שכר from the user's wallet (deployer has BURNER_ROLE).
 *   2. Send ETH from deployer wallet to user (1 שכר = $0.10, at ~$3000/ETH).
 * Returns the ETH-send tx hash.
 */
export async function redeemTmimOnChain(
  userWallet: string,
  tmimAmount: number,
): Promise<string | null> {
  if (!userWallet || !userWallet.startsWith('0x')) return null;
  if (tmimAmount <= 0) return null;

  if (!VITE_SECHAR_TOKEN_ADDRESS) throw new Error('VITE_SECHAR_TOKEN_ADDRESS not set in .env');
  const signer  = getSigner();
  const tmim    = new ethers.Contract(VITE_SECHAR_TOKEN_ADDRESS, שכר_ABI, signer);

  // 1. Burn שכר from user wallet (deployer has BURNER_ROLE)
  const burnTx = await tmim.burn(userWallet, BigInt(tmimAmount));
  await burnTx.wait(1);

  // 2. Send ETH to user: 1 שכר = $0.10, assuming ~$3000/ETH → 1 שכר = 1/30000 ETH
  const weiPerTmim = ethers.parseEther('1') / BigInt(30000);
  const ethToSend  = weiPerTmim * BigInt(tmimAmount);
  const sendTx = await signer.sendTransaction({ to: userWallet, value: ethToSend });
  await sendTx.wait(1);

  return sendTx.hash;
}
