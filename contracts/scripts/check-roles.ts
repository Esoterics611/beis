import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  const manifest   = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployments', 'baseSepolia.json'), 'utf8'));

  const abi = [
    'function redemptionRateBps() view returns (uint256)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function GOVERNANCE_ROLE() view returns (bytes32)',
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  ];
  const treasury = new ethers.Contract(manifest.contracts.GovernanceTreasury, abi, deployer);

  const govRole   = await treasury.GOVERNANCE_ROLE();
  const adminRole = await treasury.DEFAULT_ADMIN_ROLE();
  const govAddr   = manifest.contracts.BeisGovernance;

  console.log('Deployer:             ', deployer.address);
  console.log('GovernanceTreasury:   ', manifest.contracts.GovernanceTreasury);
  console.log('BeisGovernance:   ', govAddr);
  console.log('');
  console.log('redemptionRateBps:    ', (await treasury.redemptionRateBps()).toString());
  console.log('');
  console.log('Deployer has GOVERNANCE_ROLE: ', await treasury.hasRole(govRole, deployer.address));
  console.log('Deployer has DEFAULT_ADMIN:   ', await treasury.hasRole(adminRole, deployer.address));
  console.log('Governance has GOVERNANCE_ROLE:', await treasury.hasRole(govRole, govAddr));
}

main().catch(e => { console.error(e); process.exit(1); });
