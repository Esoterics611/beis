import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deploy all Chayolei Beis Dovid contracts to the selected network.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network baseSepolia
 *   npx hardhat run scripts/deploy.ts --network localhost
 *
 * After deployment, the contract addresses are written to:
 *   deployments/{network}.json
 * and printed to stdout so you can copy them to .env
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('='.repeat(60));
  console.log(`Deploying to: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
  console.log('='.repeat(60));

  // ── 1. SecharToken ────────────────────────────────────────────
  console.log('\n1. Deploying SecharToken...');
  const SecharToken = await ethers.getContractFactory('SecharToken');
  const tmim = await SecharToken.deploy(deployer.address);
  await tmim.waitForDeployment();
  const tmimAddress = await tmim.getAddress();
  console.log(`   ✓ SecharToken deployed: ${tmimAddress}`);

  // ── 2. BeisRegistry ────────────────────────────────────
  console.log('\n2. Deploying BeisRegistry...');
  const Registry = await ethers.getContractFactory('BeisRegistry');
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`   ✓ BeisRegistry deployed: ${registryAddress}`);

  // ── 3. ChibburRewards ───────────────────────────────────────
  console.log('\n3. Deploying ChibburRewards...');
  const ChibburRewards = await ethers.getContractFactory('ChibburRewards');
  const rewards = await ChibburRewards.deploy(deployer.address, tmimAddress);
  await rewards.waitForDeployment();
  const rewardsAddress = await rewards.getAddress();
  console.log(`   ✓ ChibburRewards deployed: ${rewardsAddress}`);

  // Grant ChibburRewards the MINTER_ROLE on SecharToken
  console.log('   → Granting MINTER_ROLE to ChibburRewards...');
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  await tmim.grantRole(MINTER_ROLE, rewardsAddress);
  console.log('   ✓ MINTER_ROLE granted');

  // ── 4. BeisTreasury ────────────────────────────────────
  // Base Sepolia USDC address (mock for local, real for testnet)
  const isLocalNetwork = network.chainId === 31337n;
  let usdcAddress: string;

  if (isLocalNetwork) {
    // Deploy a minimal mock ERC-20 for local testing
    console.log('\n4. Deploying Mock USDC (local only)...');
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const mockUsdc = await MockERC20.deploy('USD Coin', 'USDC', 6);
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log(`   ✓ Mock USDC deployed: ${usdcAddress}`);
  } else {
    // Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    usdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    console.log(`\n4. Using Base Sepolia USDC: ${usdcAddress}`);
  }

  console.log('\n5. Deploying BeisTreasury...');
  const Treasury = await ethers.getContractFactory('BeisTreasury');
  const treasury = await Treasury.deploy(deployer.address, tmimAddress, usdcAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`   ✓ BeisTreasury deployed: ${treasuryAddress}`);

  // Grant Treasury MINTER + BURNER roles on SecharToken
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE'));
  await tmim.grantRole(MINTER_ROLE, treasuryAddress);
  await tmim.grantRole(BURNER_ROLE, treasuryAddress);
  console.log('   ✓ MINTER_ROLE + BURNER_ROLE granted to Treasury');

  // ── Save deployment artifacts ──────────────────────────────
  const deployments = {
    network:    network.name,
    chainId:    network.chainId.toString(),
    deployer:   deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      SecharToken:          tmimAddress,
      BeisRegistry:   registryAddress,
      ChibburRewards:      rewardsAddress,
      BeisTreasury:   treasuryAddress,
      USDC:               usdcAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const outFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployments, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ All contracts deployed successfully!\n');
  console.log('Add these to your .env:\n');
  console.log(`VITE_SECHAR_TOKEN_ADDRESS=${tmimAddress}`);
  console.log(`VITE_BEIS_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`VITE_CHIBBUR_REWARDS_ADDRESS=${rewardsAddress}`);
  console.log(`VITE_TREASURY_ADDRESS=${treasuryAddress}`);
  console.log('\nDeployment saved to:', outFile);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
