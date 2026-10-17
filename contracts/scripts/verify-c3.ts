import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Verify that the C3 BeisGovernance is correctly deployed:
 *   - bootstrapSelectorWhitelist landed correctly
 *   - trustedTargets contains expected addresses
 *   - allowedSelectors map matches the SPEC_2 §2B matrix
 *   - attestationSigner matches .env
 *
 * Usage:
 *   npx hardhat run scripts/verify-c3.ts --network baseSepolia
 */

function sel4(sig: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(sig)).slice(0, 10);
}

async function main() {
  const network   = await ethers.provider.getNetwork();
  const chainId   = Number(network.chainId);
  const isBaseSepolia = chainId === 84532;

  console.log('='.repeat(60));
  console.log(`Verifying BeisGovernance (C3) on chainId ${chainId}`);
  console.log('='.repeat(60));

  // ── Load deployment ─────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const candidates = isBaseSepolia
    ? ['baseSepolia.json', 'base-sepolia.json']
    : [`${network.name}.json`];
  const deploymentFile = candidates
    .map((n) => path.join(deploymentsDir, n))
    .find((p) => fs.existsSync(p));
  if (!deploymentFile) throw new Error('Deployment file not found.');

  const d = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));
  const govAddr      = d.contracts.BeisGovernance as string;
  const tmimAddr     = d.contracts.SecharToken          as string;
  const treasuryAddr = d.contracts.GovernanceTreasury as string;
  const registryAddr = d.contracts.BeisRegistry   as string;
  const attSigner    = d.attestationSigner             as string;

  console.log(`\nGovernance: ${govAddr}`);
  const gov = await ethers.getContractAt('BeisGovernance', govAddr);

  let pass = 0;
  let fail = 0;

  async function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected;
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) console.log(`      expected: ${expected}\n      got:      ${actual}`);
    ok ? pass++ : fail++;
  }

  // ── Attestation signer ──────────────────────────────────────
  console.log('\n[attestation signer]');
  await check('attestationSigner', await gov.attestationSigner(), attSigner);

  // ── Trusted targets ─────────────────────────────────────────
  console.log('\n[trusted targets]');
  if (treasuryAddr) await check(`trustedTargets[${treasuryAddr}]`, await gov.trustedTargets(treasuryAddr), true);
  if (tmimAddr)     await check(`trustedTargets[${tmimAddr}]`,     await gov.trustedTargets(tmimAddr),     true);
  if (registryAddr) await check(`trustedTargets[${registryAddr}]`, await gov.trustedTargets(registryAddr), true);
  await check(`trustedTargets[self]`, await gov.trustedTargets(govAddr), true);

  // ProposalType enum indices
  const PT = { SIGNAL:0, MIVTZA_FUNDING:1, REDEMPTION_RATE:2, EMERGENCY_PAUSE:3, EMERGENCY_UNPAUSE:4,
               TREASURY_TRANSFER:5, GRANT_ROLE:6, PARAMETER_UPDATE:7, MINT_TOKENS:8, MONTHLY_CAP_UPDATE:9 };

  // ── Allowed selectors (SPEC_2 §2B matrix) ──────────────────
  console.log('\n[allowed selectors]');
  const matrix: Array<[number, string]> = [
    [PT.REDEMPTION_RATE,    'setRedemptionRate(uint256)'],
    [PT.MONTHLY_CAP_UPDATE, 'setMaxMonthlyMint(uint256)'],
    [PT.EMERGENCY_PAUSE,    'pause()'],
    [PT.EMERGENCY_UNPAUSE,  'unpause()'],
    [PT.MIVTZA_FUNDING,     'createStream(address,uint256,uint256)'],
    [PT.TREASURY_TRANSFER,  'cancelStream(uint256)'],
    [PT.MINT_TOKENS,        'mint(address,uint256,string)'],
    [PT.GRANT_ROLE,         'grantRole(bytes32,address)'],
  ];
  for (const [pt, sig] of matrix) {
    const s = sel4(sig);
    await check(`allowedSelectors[${pt}][${s}] (${sig})`, await gov.allowedSelectors(pt, s), true);
  }

  // ── Parameter defaults ──────────────────────────────────────
  console.log('\n[parameter defaults]');
  await check('votingPeriod == 7 days', (await gov.votingPeriod()).toString(), (7n * 24n * 3600n).toString());
  await check('executionGasReserve == 50_000', (await gov.executionGasReserve()).toString(), '50000');

  // ── Summary ─────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Result: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error('❌ Verification FAILED — check output above');
    process.exitCode = 1;
  } else {
    console.log('✅ All checks passed — C3 contract is correctly deployed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
