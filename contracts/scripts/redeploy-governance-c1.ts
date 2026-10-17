import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Re-deploy BeisGovernance with the C1 rank-attestation fix.
 *
 * The old deployed BeisGovernance (pre-C1) has a governance-takeover
 * vulnerability: castVote() trusts caller-supplied rankIndex. This script
 * deploys the patched contract, grants it GOVERNANCE_ROLE on the existing
 * GovernanceTreasury, revokes the role from the old contract, and updates
 * the deployment manifest.
 *
 * Environment:
 *   DEPLOYER_PRIVATE_KEY            — required; funds the deploy
 *   ATTESTATION_SIGNER_PRIVATE_KEY  — optional; if unset, a new key is
 *                                     generated and printed (save it to .env)
 *
 * Usage:
 *   npx hardhat run scripts/redeploy-governance-c1.ts --network baseSepolia
 *   npx hardhat run scripts/redeploy-governance-c1.ts --network localhost
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();
  const chainId    = Number(network.chainId);
  const isBaseSepolia = chainId === 84532;

  console.log('='.repeat(60));
  console.log(`Re-deploying BeisGovernance (C1) to chainId ${chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log('='.repeat(60));

  // ── Load existing deployment ─────────────────────────────────
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const candidates = isBaseSepolia
    ? ['baseSepolia.json', 'base-sepolia.json']
    : [`${network.name}.json`];
  const deploymentFile = candidates
    .map((n) => path.join(deploymentsDir, n))
    .find((p) => fs.existsSync(p));
  if (!deploymentFile) {
    throw new Error(
      `No deployment file found in ${deploymentsDir} for network ${network.name}. ` +
        `Run scripts/deploy.ts first.`,
    );
  }
  const existing = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));

  const tmimAddress       = existing.contracts.SecharToken as string;
  const oldGovernance     = existing.contracts.BeisGovernance as string | undefined;
  const govTreasuryAddr   = existing.contracts.GovernanceTreasury as string | undefined;
  if (!tmimAddress) throw new Error('SecharToken address missing from deployment file');

  // ── Resolve attestation signer ───────────────────────────────
  const envKey = process.env.ATTESTATION_SIGNER_PRIVATE_KEY;
  let attestationSignerAddress: string;
  let generatedKey: string | null = null;

  if (envKey && envKey.startsWith('0x') && envKey.length === 66) {
    attestationSignerAddress = new ethers.Wallet(envKey).address;
    console.log(`\nAttestation signer (from env): ${attestationSignerAddress}`);
  } else {
    const fresh = ethers.Wallet.createRandom();
    attestationSignerAddress = fresh.address;
    generatedKey = fresh.privateKey;
    console.log('\n⚠️  ATTESTATION_SIGNER_PRIVATE_KEY not set — generated fresh key.');
    console.log(`    Address:     ${attestationSignerAddress}`);
    console.log(`    Private key: ${generatedKey}`);
    console.log('    SAVE this to .env as ATTESTATION_SIGNER_PRIVATE_KEY immediately.');
  }

  // ── Deploy ───────────────────────────────────────────────────
  console.log('\n1. Deploying BeisGovernance (C1-patched)...');
  const GovF = await ethers.getContractFactory('BeisGovernance');
  const gov = await GovF.deploy(deployer.address, tmimAddress, attestationSignerAddress);
  await gov.waitForDeployment();
  const newGovernanceAddress = await gov.getAddress();
  console.log(`   ✓ New BeisGovernance: ${newGovernanceAddress}`);

  // ── Rewire GovernanceTreasury roles ──────────────────────────
  if (govTreasuryAddr) {
    console.log('\n2. Re-wiring GovernanceTreasury roles...');
    const treasury = await ethers.getContractAt('GovernanceTreasury', govTreasuryAddr);
    const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('GOVERNANCE_ROLE'));

    const tx1 = await treasury.grantRole(GOVERNANCE_ROLE, newGovernanceAddress);
    await tx1.wait();
    console.log(`   ✓ Granted GOVERNANCE_ROLE to ${newGovernanceAddress}`);

    if (oldGovernance && oldGovernance !== ethers.ZeroAddress && oldGovernance !== newGovernanceAddress) {
      try {
        const stillHas = await treasury.hasRole(GOVERNANCE_ROLE, oldGovernance);
        if (stillHas) {
          const tx2 = await treasury.revokeRole(GOVERNANCE_ROLE, oldGovernance);
          await tx2.wait();
          console.log(`   ✓ Revoked GOVERNANCE_ROLE from old governance (${oldGovernance})`);
        } else {
          console.log(`   ℹ Old governance did not hold GOVERNANCE_ROLE; nothing to revoke.`);
        }
      } catch (e) {
        console.warn(`   ⚠ Could not revoke old role: ${(e as Error).message}`);
      }
    }
  } else {
    console.log('\n2. No GovernanceTreasury recorded — skipping role rewire.');
  }

  // ── Save deployment ──────────────────────────────────────────
  existing.previousContracts = existing.previousContracts ?? {};
  if (oldGovernance && oldGovernance !== newGovernanceAddress) {
    existing.previousContracts.BeisGovernance_preC1 = oldGovernance;
  }
  existing.contracts.BeisGovernance = newGovernanceAddress;
  existing.attestationSigner            = attestationSignerAddress;
  existing.c1DeployedAt                 = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(existing, null, 2));
  console.log(`\n3. Deployment manifest updated: ${deploymentFile}`);

  // ── Print next steps ─────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('✅ BeisGovernance re-deployed.\n');
  console.log('Required .env updates:');
  console.log(`  VITE_GOVERNANCE_ADDRESS=${newGovernanceAddress}`);
  if (generatedKey) {
    console.log(`  ATTESTATION_SIGNER_PRIVATE_KEY=${generatedKey}`);
  }
  console.log('\nAfter updating .env:');
  console.log('  1. Restart the SvelteKit dev/prod server so it picks up new env');
  console.log('  2. Verify:  attestationSigner() on the new contract == your signer address');
  console.log('  3. Announce the contract address change to any voter with pending proposals');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
