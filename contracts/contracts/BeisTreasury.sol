// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SecharToken.sol";

/**
 * @title BeisTreasury
 * @notice DAO treasury — accepts ETH donations, mints TMIM,
 *         and handles TMIM redemption back to stablecoin.
 *
 *         Redemption rate: 1 TMIM = 0.10 USD (1000 bps).
 *         USDC/USDT address is set at deploy time for Base Sepolia.
 */
contract BeisTreasury is AccessControl, ReentrancyGuard {
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    SecharToken public immutable tmim;
    IERC20    public stablecoin; // USDC on Base Sepolia

    /// @notice ETH/USD price in cents (e.g. 300000 = $3000.00)
    uint256 public ethUsdCents = 300_000;

    /// @notice Basis points: 1000 bps = $0.10 per TMIM
    uint256 public redemptionRateBps = 1000;

    uint256 public totalEthDonated;
    uint256 public totalUsdcDonated;
    uint256 public totalTmimMinted;
    uint256 public totalTmimRedeemed;

    event DonationReceived(address indexed donor, uint256 ethAmount, uint256 tmimMinted);
    event StablecoinDonationReceived(address indexed donor, uint256 usdcAmount, uint256 tmimMinted);
    event TmimRedeemed(address indexed holder, uint256 tmimAmount, uint256 usdcPaid);
    event EthUsdRateUpdated(uint256 newRateCents);
    event RedemptionRateUpdated(uint256 newRateBps);

    constructor(address admin, address tmimToken, address stablecoinAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
        tmim       = SecharToken(tmimToken);
        stablecoin = IERC20(stablecoinAddress);
    }

    // ── ETH Donations ──────────────────────────────────────────

    /**
     * @notice Donate ETH to the treasury. Mints TMIM at the current ETH/USD rate.
     *         Formula: tmim = (ethAmount * ethUsdCents) / (redemptionRateBps * 1e16)
     */
    receive() external payable nonReentrant {
        uint256 tmimAmount = _ethToTmim(msg.value);
        require(tmimAmount > 0, "Donation too small");
        tmim.mint(msg.sender, tmimAmount, "eth_donation");
        totalEthDonated  += msg.value;
        totalTmimMinted  += tmimAmount;
        emit DonationReceived(msg.sender, msg.value, tmimAmount);
    }

    // ── USDC Donations ─────────────────────────────────────────

    /**
     * @notice Donate USDC (6 decimals) to the treasury. Mints TMIM at 1 TMIM / $0.10.
     */
    function donateUsdc(uint256 usdcAmount) external nonReentrant {
        require(usdcAmount > 0, "Amount must be positive");
        stablecoin.transferFrom(msg.sender, address(this), usdcAmount);
        // USDC has 6 decimals: 1 USDC = 1e6. 1 TMIM = $0.10 = 100000 USDC units.
        uint256 tmimAmount = usdcAmount / 100_000;
        require(tmimAmount > 0, "Donation below minimum ($0.10)");
        tmim.mint(msg.sender, tmimAmount, "usdc_donation");
        totalUsdcDonated += usdcAmount;
        totalTmimMinted  += tmimAmount;
        emit StablecoinDonationReceived(msg.sender, usdcAmount, tmimAmount);
    }

    // ── Redemption ─────────────────────────────────────────────

    /**
     * @notice Burn TMIM and receive USDC back.
     *         User must call tmim.approve(treasury, amount) first.
     */
    function redeemTmim(uint256 tmimAmount) external nonReentrant {
        require(tmimAmount > 0, "Amount must be positive");
        // USDC to pay: tmimAmount * $0.10 = tmimAmount * 100000 USDC units
        uint256 usdcPayout = tmimAmount * 100_000;
        require(stablecoin.balanceOf(address(this)) >= usdcPayout, "Insufficient treasury balance");

        // Burn TMIM from sender (requires approval)
        tmim.burn(msg.sender, tmimAmount);
        stablecoin.transfer(msg.sender, usdcPayout);

        totalTmimRedeemed += tmimAmount;
        emit TmimRedeemed(msg.sender, tmimAmount, usdcPayout);
    }

    // ── Treasury Management ────────────────────────────────────

    function withdrawEth(address payable to, uint256 amount) external onlyRole(TREASURER_ROLE) {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        to.transfer(amount);
    }

    function withdrawUsdc(address to, uint256 amount) external onlyRole(TREASURER_ROLE) {
        stablecoin.transfer(to, amount);
    }

    function setEthUsdRate(uint256 rateCents) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ethUsdCents = rateCents;
        emit EthUsdRateUpdated(rateCents);
    }

    function setRedemptionRate(uint256 rateBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        redemptionRateBps = rateBps;
        emit RedemptionRateUpdated(rateBps);
    }

    // ── Internal helpers ───────────────────────────────────────

    function _ethToTmim(uint256 weiAmount) internal view returns (uint256) {
        // wei → USD cents: weiAmount * ethUsdCents / 1e18
        // USD cents → TMIM: divide by (redemptionRateBps / 100)  →  * 100 / redemptionRateBps
        // Combined: weiAmount * ethUsdCents * 100 / (1e18 * redemptionRateBps)
        return (weiAmount * ethUsdCents * 100) / (1e18 * redemptionRateBps);
    }

    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getUsdcBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
