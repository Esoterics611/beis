/**
 * One-time fix: grant MINTER_ROLE to ChibburRewards on SecharToken.
 *
 * Run with:
 *   npx hardhat run scripts/grant-roles.ts --network baseSepolia
 *
 * Safe to re-run — grantRole is idempotent.
 */
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TMIM_TOKEN     = process.env.VITE_SECHAR_TOKEN_ADDRESS!;
const MASIMA_REWARDS = process.env.VITE_CHIBBUR_REWARDS_ADDRESS!;
const TREASURY       = process.env.VITE_TREASURY_ADDRESS!;

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
const BURNER_ROLE  = ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE'));

const TMIM_ABI = [
  'function grantRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('SecharToken:', TMIM_TOKEN);
  console.log('ChibburRewards:', MASIMA_REWARDS);
  console.log('Treasury:', TREASURY);

  const tmim = new ethers.Contract(TMIM_TOKEN, TMIM_ABI, deployer);

  // Check and grant MINTER_ROLE to ChibburRewards
  const rewardsHasMinter = await tmim.hasRole(MINTER_ROLE, MASIMA_REWARDS);
  if (rewardsHasMinter) {
    console.log('✓ ChibburRewards already has MINTER_ROLE — no action needed');
  } else {
    console.log('→ Granting MINTER_ROLE to ChibburRewards...');
    const tx = await tmim.grantRole(MINTER_ROLE, MASIMA_REWARDS);
    await tx.wait(1);
    console.log('✓ MINTER_ROLE granted. tx:', tx.hash);
  }

  // Check and grant MINTER_ROLE to Treasury
  const treasuryHasMinter = await tmim.hasRole(MINTER_ROLE, TREASURY);
  if (treasuryHasMinter) {
    console.log('✓ Treasury already has MINTER_ROLE');
  } else {
    console.log('→ Granting MINTER_ROLE to Treasury...');
    const tx = await tmim.grantRole(MINTER_ROLE, TREASURY);
    await tx.wait(1);
    console.log('✓ MINTER_ROLE granted to Treasury. tx:', tx.hash);
  }

  // Check and grant BURNER_ROLE to Treasury
  const treasuryHasBurner = await tmim.hasRole(BURNER_ROLE, TREASURY);
  if (treasuryHasBurner) {
    console.log('✓ Treasury already has BURNER_ROLE');
  } else {
    console.log('→ Granting BURNER_ROLE to Treasury...');
    const tx = await tmim.grantRole(BURNER_ROLE, TREASURY);
    await tx.wait(1);
    console.log('✓ BURNER_ROLE granted to Treasury. tx:', tx.hash);
  }

  console.log('\nDone. Test again by approving a masima.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
