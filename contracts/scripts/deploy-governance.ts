import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deploy DAO Governance contracts:
 *   BeisGovernance, GovernanceTreasury, ChibburRewardsV2
 *
 * Prerequisites: run scripts/deploy.ts first to get SecharToken address.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-governance.ts --network baseSepolia
 *   npx hardhat run scripts/deploy-governance.ts --network localhost
 *
 * Reads existing deployment from deployments/{network}.json and appends
 * new contract addresses.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log('='.repeat(60));
  console.log(`Deploying Governance to: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log('='.repeat(60));

  // ── Load existing deployment ───────────────────────────────────────
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const existingFile   = path.join(deploymentsDir, `${network.name}.json`);

  if (!fs.existsSync(existingFile)) {
    throw new Error(
      `No existing deployment found at ${existingFile}. ` +
      `Run scripts/deploy.ts first to deploy SecharToken.`
    );
  }

  const existing   = JSON.parse(fs.readFileSync(existingFile, 'utf-8'));
  const tmimAddress = existing.contracts.SecharToken;
  const usdcAddress = existing.contracts.USDC ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

  console.log(`\nUsing SecharToken: ${tmimAddress}`);
  console.log(`Using USDC:      ${usdcAddress}`);

  const MINTER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const BURNER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE'));
  const tmim             = await ethers.getContractAt('SecharToken', tmimAddress);

  // ── 1. BeisGovernance ──────────────────────────────────────────
  console.log('\n1. Deploying BeisGovernance...');
  const Governance = await ethers.getContractFactory('BeisGovernance');
  const governance = await Governance.deploy(deployer.address, tmimAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log(`   ✓ BeisGovernance deployed: ${governanceAddress}`);

  // ── 2. GovernanceTreasury ──────────────────────────────────────────
  console.log('\n2. Deploying GovernanceTreasury...');
  const GovTreasury = await ethers.getContractFactory('GovernanceTreasury');
  const govTreasury = await GovTreasury.deploy(deployer.address, tmimAddress, usdcAddress);
  await govTreasury.waitForDeployment();
  const govTreasuryAddress = await govTreasury.getAddress();
  console.log(`   ✓ GovernanceTreasury deployed: ${govTreasuryAddress}`);

  // Grant GovernanceTreasury MINTER + BURNER roles on SecharToken
  await tmim.grantRole(MINTER_ROLE, govTreasuryAddress);
  await tmim.grantRole(BURNER_ROLE, govTreasuryAddress);
  console.log('   ✓ MINTER_ROLE + BURNER_ROLE granted to GovernanceTreasury');

  // Grant BeisGovernance the GOVERNANCE_ROLE on GovernanceTreasury
  const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('GOVERNANCE_ROLE'));
  await govTreasury.grantRole(GOVERNANCE_ROLE, governanceAddress);
  console.log('   ✓ GOVERNANCE_ROLE granted to BeisGovernance on GovernanceTreasury');

  // ── 3. ChibburRewardsV2 ─────────────────────────────────────────────
  console.log('\n3. Deploying ChibburRewardsV2...');
  const RewardsV2 = await ethers.getContractFactory('ChibburRewardsV2');
  const rewardsV2 = await RewardsV2.deploy(deployer.address, tmimAddress);
  await rewardsV2.waitForDeployment();
  const rewardsV2Address = await rewardsV2.getAddress();
  console.log(`   ✓ ChibburRewardsV2 deployed: ${rewardsV2Address}`);

  // Grant ChibburRewardsV2 the MINTER_ROLE on SecharToken
  await tmim.grantRole(MINTER_ROLE, rewardsV2Address);
  console.log('   ✓ MINTER_ROLE granted to ChibburRewardsV2');

  // ── Save updated deployment ────────────────────────────────────────
  existing.contracts.BeisGovernance  = governanceAddress;
  existing.contracts.GovernanceTreasury  = govTreasuryAddress;
  existing.contracts.ChibburRewardsV2     = rewardsV2Address;
  existing.governanceDeployedAt          = new Date().toISOString();

  fs.writeFileSync(existingFile, JSON.stringify(existing, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ Governance contracts deployed!\n');
  console.log('Add these to your .env:\n');
  console.log(`VITE_GOVERNANCE_ADDRESS=${governanceAddress}`);
  console.log(`VITE_GOVERNANCE_TREASURY_ADDRESS=${govTreasuryAddress}`);
  console.log(`VITE_CHIBBUR_REWARDS_V2_ADDRESS=${rewardsV2Address}`);
  console.log('\nDeployment updated in:', existingFile);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
