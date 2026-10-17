import { ethers } from 'hardhat';
const TMIM = '0x1A66CeE19C53956022f01842043d79d594BFb8E5';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying Treasury...');
  const T = await ethers.getContractFactory('BeisTreasury');
  const t = await T.deploy(deployer.address, TMIM, USDC);
  await t.waitForDeployment();
  const addr = await t.getAddress();
  console.log(`✓ Treasury: ${addr}`);
}
main().catch(e => { console.error(e); process.exit(1); });
