import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Call setRedemptionRate(100) on GovernanceTreasury.
 * 100 bps = $0.10 per TMIM (the intended rate).
 * Currently misconfigured at 1000 bps ($1.00).
 *
 * Usage:
 *   npx hardhat run scripts/set-redemption-rate.ts --network baseSepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log('='.repeat(60));
  console.log(`setRedemptionRate on chainId ${network.chainId}`);
  console.log(`Deployer: ${deployer.address}`);

  const manifestPath = path.join(__dirname, '..', 'deployments', 'baseSepolia.json');
  const manifest     = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const treasuryAddr = manifest.contracts.GovernanceTreasury;
  console.log(`GovernanceTreasury: ${treasuryAddr}`);

  const abi = [
    'function redemptionRateBps() view returns (uint256)',
    'function setRedemptionRate(uint256 newRateBps) external',
  ];
  const treasury = new ethers.Contract(treasuryAddr, abi, deployer);

  const before = await treasury.redemptionRateBps();
  console.log(`Current rate: ${before} bps ($${(Number(before) / 1000).toFixed(2)} per TMIM)`);

  if (Number(before) === 100) {
    console.log('Already set to 100 bps. Nothing to do.');
    return;
  }

  const tx = await treasury.setRedemptionRate(100);
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  const after = await treasury.redemptionRateBps();
  console.log(`New rate:  ${after} bps ($${(Number(after) / 1000).toFixed(2)} per TMIM)`);
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
