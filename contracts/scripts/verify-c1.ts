import { ethers } from 'hardhat';

async function main() {
  const addr = '0xa7E7098012C6DE7395128f8d3afE606C3C9Fc084';
  const gov = await ethers.getContractAt('BeisGovernance', addr);

  const signer   = await gov.attestationSigner();
  const period   = await gov.votingPeriod();
  const delay    = await gov.timelockDelay();
  const quorum   = await gov.defaultQuorum();
  const typehash = await gov.rankAttestationTypehash();

  console.log('Contract:               ', addr);
  console.log('attestationSigner:      ', signer);
  console.log('rankAttestationTypehash:', typehash);
  console.log('votingPeriod:           ', Number(period) / 86400, 'days');
  console.log('timelockDelay:          ', Number(delay) / 86400, 'days');
  console.log('defaultQuorum:          ', quorum.toString());

  const expected = '0xf90c4d97F5bD42ad30E5ed60539D2d340F502796';
  if (signer.toLowerCase() === expected.toLowerCase()) {
    console.log('\n✅ C1 verified: attestationSigner matches deployed key.');
  } else {
    console.error('\n❌ MISMATCH — expected', expected, 'got', signer);
    process.exitCode = 1;
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
