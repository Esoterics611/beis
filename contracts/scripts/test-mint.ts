/**
 * Test mint: send 10,000 TMIM directly to the deployer wallet.
 * Run: npx hardhat run scripts/test-mint.ts --network baseSepolia
 */
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TMIM_TOKEN = process.env.VITE_SECHAR_TOKEN_ADDRESS!;

const ABI = [
  'function mint(address to, uint256 amount, string calldata reason) external',
  'function balanceOf(address account) external view returns (uint256)',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const tmim = new ethers.Contract(TMIM_TOKEN, ABI, deployer);

  const before = await tmim.balanceOf(deployer.address);
  console.log('Balance before:', before.toString(), 'TMIM');

  console.log('Minting 10,000 TMIM to', deployer.address, '...');
  const tx = await tmim.mint(deployer.address, 10000n, 'test_mint');
  await tx.wait(1);
  console.log('tx:', tx.hash);
  console.log('BaseScan: https://sepolia.basescan.org/tx/' + tx.hash);

  const after = await tmim.balanceOf(deployer.address);
  console.log('Balance after:', after.toString(), 'TMIM');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
