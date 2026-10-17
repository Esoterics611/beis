import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SecharToken, BeisRegistry, ChibburRewards, BeisTreasury, MockERC20 } from '../typechain-types';

describe('Chayolei Contracts', () => {
  let admin: ReturnType<typeof ethers.getSigners> extends Promise<infer T> ? T[0] : never;
  let officer: any;
  let chayal: any;
  let tmim: SecharToken;
  let registry: BeisRegistry;
  let rewards: ChibburRewards;
  let treasury: BeisTreasury;
  let usdc: MockERC20;

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE'));
  const PROMOTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PROMOTER_ROLE'));
  const APPROVER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('APPROVER_ROLE'));
  const REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('REGISTRAR_ROLE'));

  beforeEach(async () => {
    [admin, officer, chayal] = await ethers.getSigners();

    // Deploy MockERC20 (USDC)
    const MockERC20F = await ethers.getContractFactory('MockERC20');
    usdc = await MockERC20F.deploy('USD Coin', 'USDC', 6) as MockERC20;

    // Deploy SecharToken
    const SecharTokenF = await ethers.getContractFactory('SecharToken');
    tmim = await SecharTokenF.deploy(admin.address) as SecharToken;

    // Deploy Registry
    const RegistryF = await ethers.getContractFactory('BeisRegistry');
    registry = await RegistryF.deploy(admin.address) as BeisRegistry;

    // Deploy ChibburRewards
    const RewardsF = await ethers.getContractFactory('ChibburRewards');
    rewards = await RewardsF.deploy(admin.address, await tmim.getAddress()) as ChibburRewards;

    // Grant MINTER to rewards
    await tmim.grantRole(MINTER_ROLE, await rewards.getAddress());

    // Deploy Treasury
    const TreasuryF = await ethers.getContractFactory('BeisTreasury');
    treasury = await TreasuryF.deploy(admin.address, await tmim.getAddress(), await usdc.getAddress()) as BeisTreasury;
    await tmim.grantRole(MINTER_ROLE, await treasury.getAddress());
    await tmim.grantRole(BURNER_ROLE, await treasury.getAddress());
  });

  describe('SecharToken', () => {
    it('has correct name, symbol, 0 decimals', async () => {
      expect(await tmim.name()).to.equal('TMIM Token');
      expect(await tmim.symbol()).to.equal('TMIM');
      expect(await tmim.decimals()).to.equal(0);
    });

    it('admin can mint', async () => {
      await tmim.mint(chayal.address, 100, 'test');
      expect(await tmim.balanceOf(chayal.address)).to.equal(100n);
    });

    it('non-minter cannot mint', async () => {
      await expect(
        tmim.connect(chayal).mint(chayal.address, 100, 'test')
      ).to.be.revertedWithCustomError(tmim, 'AccessControlUnauthorizedAccount');
    });

    it('admin can burn', async () => {
      await tmim.mint(chayal.address, 100, 'test');
      await tmim.burn(chayal.address, 50);
      expect(await tmim.balanceOf(chayal.address)).to.equal(50n);
    });
  });

  describe('BeisRegistry', () => {
    const makomId = ethers.keccak256(ethers.toUtf8Bytes('kur-haneshama'));

    it('admin can register a chayal', async () => {
      await registry.register(chayal.address, makomId);
      expect(await registry.isRegistered(chayal.address)).to.be.true;
      expect(await registry.getRank(chayal.address)).to.equal(0);
      expect(await registry.getTier(chayal.address)).to.equal('enlisted');
    });

    it('cannot register twice', async () => {
      await registry.register(chayal.address, makomId);
      await expect(registry.register(chayal.address, makomId)).to.be.revertedWith('Already registered');
    });

    it('admin can promote a chayal', async () => {
      await registry.register(chayal.address, makomId);
      await registry.promote(chayal.address);
      expect(await registry.getRank(chayal.address)).to.equal(1);
    });

    it('becomes officer at rank 5', async () => {
      await registry.register(chayal.address, makomId);
      for (let i = 0; i < 5; i++) await registry.promote(chayal.address);
      expect(await registry.isOfficer(chayal.address)).to.be.true;
      expect(await registry.getTier(chayal.address)).to.equal('officer');
    });
  });

  describe('ChibburRewards', () => {
    it('approver can approve masima and mint tokens', async () => {
      const masimaId = ethers.keccak256(ethers.toUtf8Bytes('masima-001'));
      await rewards.approveMasima(masimaId, chayal.address, 50);
      expect(await tmim.balanceOf(chayal.address)).to.equal(50n);
      expect(await rewards.isMasimaApproved(masimaId)).to.be.true;
    });

    it('cannot approve same masima twice', async () => {
      const masimaId = ethers.keccak256(ethers.toUtf8Bytes('masima-002'));
      await rewards.approveMasima(masimaId, chayal.address, 50);
      await expect(
        rewards.approveMasima(masimaId, chayal.address, 50)
      ).to.be.revertedWith('Already approved on-chain');
    });

    it('approver can approve tafkid', async () => {
      const tafkidId = ethers.keccak256(ethers.toUtf8Bytes('tafkid-001'));
      await rewards.approveTafkid(tafkidId, chayal.address, 25);
      expect(await tmim.balanceOf(chayal.address)).to.equal(25n);
    });
  });

  describe('BeisTreasury', () => {
    it('ETH donation mints TMIM', async () => {
      const donationEth = ethers.parseEther('0.01');
      await chayal.sendTransaction({ to: await treasury.getAddress(), value: donationEth });
      // At $3000/ETH rate: 0.01 ETH = $30 = 300 TMIM
      const tmimBalance = await tmim.balanceOf(chayal.address);
      expect(tmimBalance).to.be.gt(0n);
    });

    it('USDC donation mints TMIM', async () => {
      const usdcAmount = 1_000_000n; // 1 USDC = 10 TMIM
      await usdc.transfer(chayal.address, usdcAmount);
      await usdc.connect(chayal).approve(await treasury.getAddress(), usdcAmount);
      await treasury.connect(chayal).donateUsdc(usdcAmount);
      expect(await tmim.balanceOf(chayal.address)).to.equal(10n);
    });
  });
});
