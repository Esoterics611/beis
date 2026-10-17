// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SecharToken.sol";

/**
 * @title GovernanceTreasury
 * @notice Extended DAO treasury with governance-controlled parameters,
 *         linear payment streams, and monthly TMIM minting caps.
 *
 * Extends the core BeisTreasury concepts with:
 *  - Monthly minting cap (governs how many TMIM can be minted per 30-day window)
 *  - Reserve ratio enforcement (USDC reserve ÷ TMIM market cap must stay ≥ 20%)
 *  - Payment streams (linear USDC vesting over time, cancellable by governance)
 *  - Governance-controlled redemption rate via BeisGovernance proposals
 */
contract GovernanceTreasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────
    bytes32 public constant TREASURER_ROLE   = keccak256("TREASURER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE  = keccak256("GOVERNANCE_ROLE");

    // ─── Token references ─────────────────────────────────────────────────
    SecharToken public immutable tmim;
    IERC20    public immutable usdc;

    // ─── Treasury parameters (adjustable via governance) ──────────────────
    /// @notice Basis points: 1000 bps = $0.10 per TMIM at redemption
    uint256 public redemptionRateBps  = 1_000;

    /// @notice Maximum new TMIM that can be minted per 30-day window
    uint256 public maxMonthlyMint     = 100_000;

    /// @notice Minimum reserve ratio (scaled ×1000, so 200 = 20%)
    uint256 public minReserveRatioPpm = 200;  // 20%

    // ─── Minting window tracking ──────────────────────────────────────────
    uint256 public currentWindowStart;
    uint256 public mintedThisWindow;

    // ─── Totals ───────────────────────────────────────────────────────────
    uint256 public totalDonatedUSDC;
    uint256 public totalTmimMinted;
    uint256 public totalTmimRedeemed;

    // ─── Payment streams ──────────────────────────────────────────────────
    struct Stream {
        address recipient;
        uint256 totalAmount;   // total USDC (6 decimals)
        uint256 claimedAmount;
        uint256 startTime;
        uint256 endTime;
        bool    cancelled;
    }

    uint256 public streamCount;
    mapping(uint256 => Stream) public streams;

    // ─── Events ───────────────────────────────────────────────────────────
    event Donated(address indexed donor, uint256 usdcAmount, uint256 tmimMinted, string memo);
    event Redeemed(address indexed holder, uint256 tmimAmount, uint256 usdcPaid);
    event StreamCreated(uint256 indexed id, address indexed recipient, uint256 total, uint256 end);
    event StreamClaimed(uint256 indexed id, address indexed recipient, uint256 amount);
    event StreamCancelled(uint256 indexed id);
    event RedemptionRateUpdated(uint256 newRateBps);
    event MaxMonthlyMintUpdated(uint256 newCap);

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(
        address admin,
        address tmimToken,
        address usdcToken
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE,    admin);
        _grantRole(GOVERNANCE_ROLE,   admin);
        tmim = SecharToken(tmimToken);
        usdc = IERC20(usdcToken);
        currentWindowStart = block.timestamp;
    }

    // ─── Donation ─────────────────────────────────────────────────────────

    /**
     * @notice Donate USDC to the treasury and receive TMIM.
     * @param usdcAmount  Amount of USDC to donate (6 decimals)
     * @param memo        Optional donor message stored off-chain (emitted here)
     */
    function donate(uint256 usdcAmount, string calldata memo)
        external
        nonReentrant
        whenNotPaused
    {
        require(usdcAmount > 0, "Zero donation");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // $1 USDC = 10 TMIM (adjustable by governance via parameter_update proposal)
        uint256 tmimToMint = (usdcAmount * 10) / 1e6; // convert 6-decimal cents to TMIM
        require(tmimToMint > 0, "Donation too small");

        _refreshWindow();
        require(mintedThisWindow + tmimToMint <= maxMonthlyMint, "Monthly mint cap exceeded");

        mintedThisWindow  += tmimToMint;
        totalTmimMinted   += tmimToMint;
        totalDonatedUSDC  += usdcAmount;

        tmim.mint(msg.sender, tmimToMint, "donation");

        emit Donated(msg.sender, usdcAmount, tmimToMint, memo);
    }

    // ─── Redemption ───────────────────────────────────────────────────────

    /**
     * @notice Redeem TMIM for USDC at the current redemption rate.
     *         Caller must have approved this contract to burn their TMIM.
     * @param tmimAmount  Amount of TMIM to redeem (0 decimals)
     */
    function redeem(uint256 tmimAmount) external nonReentrant whenNotPaused {
        require(tmimAmount > 0, "Zero amount");
        require(tmim.balanceOf(msg.sender) >= tmimAmount, "Insufficient TMIM");

        uint256 usdcOut = (tmimAmount * redemptionRateBps * 1e6) / (10_000);
        require(usdc.balanceOf(address(this)) >= usdcOut, "Insufficient USDC reserve");

        _enforceReserveRatio(usdcOut);

        tmim.burn(msg.sender, tmimAmount);
        totalTmimRedeemed += tmimAmount;

        usdc.safeTransfer(msg.sender, usdcOut);

        emit Redeemed(msg.sender, tmimAmount, usdcOut);
    }

    // ─── Payment Streams ──────────────────────────────────────────────────

    /**
     * @notice Create a linear USDC payment stream.
     *         Called by governance execution (GOVERNANCE_ROLE).
     */
    function createStream(
        address recipient,
        uint256 totalAmount,
        uint256 durationSeconds
    )
        external
        onlyRole(GOVERNANCE_ROLE)
        returns (uint256 streamId)
    {
        require(recipient != address(0), "Zero recipient");
        require(totalAmount > 0, "Zero amount");
        require(durationSeconds > 0, "Zero duration");
        require(usdc.balanceOf(address(this)) >= totalAmount, "Insufficient reserve for stream");

        streamId = ++streamCount;
        streams[streamId] = Stream({
            recipient:     recipient,
            totalAmount:   totalAmount,
            claimedAmount: 0,
            startTime:     block.timestamp,
            endTime:       block.timestamp + durationSeconds,
            cancelled:     false
        });

        emit StreamCreated(streamId, recipient, totalAmount, block.timestamp + durationSeconds);
    }

    /**
     * @notice Claim accrued USDC from a stream.
     */
    function claimStream(uint256 streamId) external nonReentrant whenNotPaused {
        Stream storage s = streams[streamId];
        require(s.recipient == msg.sender, "Not recipient");
        require(!s.cancelled, "Stream cancelled");

        uint256 claimable = _claimableAmount(s);
        require(claimable > 0, "Nothing to claim");

        s.claimedAmount += claimable;
        usdc.safeTransfer(msg.sender, claimable);

        emit StreamClaimed(streamId, msg.sender, claimable);
    }

    /**
     * @notice Cancel a stream (governance only). Unearned USDC stays in treasury.
     */
    function cancelStream(uint256 streamId)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        Stream storage s = streams[streamId];
        require(!s.cancelled, "Already cancelled");
        s.cancelled = true;
        emit StreamCancelled(streamId);
    }

    // ─── Governance-controlled parameters ────────────────────────────────

    function setRedemptionRate(uint256 newRateBps)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        require(newRateBps >= 100 && newRateBps <= 5_000, "Rate out of range");
        redemptionRateBps = newRateBps;
        emit RedemptionRateUpdated(newRateBps);
    }

    function setMaxMonthlyMint(uint256 newCap)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        require(newCap >= 1_000, "Cap too low");
        maxMonthlyMint = newCap;
        emit MaxMonthlyMintUpdated(newCap);
    }

    // ─── Emergency pause (governance) ────────────────────────────────────

    bool public paused;

    modifier whenNotPaused() {
        require(!paused, "Treasury paused");
        _;
    }

    function pause()   external onlyRole(GOVERNANCE_ROLE) { paused = true; }
    function unpause() external onlyRole(GOVERNANCE_ROLE) { paused = false; }

    // ─── View helpers ─────────────────────────────────────────────────────

    function claimableForStream(uint256 streamId)
        external
        view
        returns (uint256)
    {
        return _claimableAmount(streams[streamId]);
    }

    function reserveRatioPpm() public view returns (uint256) {
        uint256 supply = tmim.totalSupply();
        if (supply == 0) return type(uint256).max;
        uint256 usdcBal = usdc.balanceOf(address(this));
        // ratio = usdcBal / (supply × redemptionRateBps / 10000), scaled ×1000
        uint256 usdcNeeded = (supply * redemptionRateBps * 1e6) / 10_000;
        if (usdcNeeded == 0) return type(uint256).max;
        return (usdcBal * 1_000) / usdcNeeded;
    }

    function mintedThisMonth() external view returns (uint256) {
        return _isNewWindow() ? 0 : mintedThisWindow;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────

    function _claimableAmount(Stream storage s) internal view returns (uint256) {
        if (s.cancelled) return 0;
        uint256 elapsed = block.timestamp >= s.endTime
            ? s.endTime - s.startTime
            : block.timestamp - s.startTime;
        uint256 duration = s.endTime - s.startTime;
        uint256 vested = (s.totalAmount * elapsed) / duration;
        return vested > s.claimedAmount ? vested - s.claimedAmount : 0;
    }

    function _isNewWindow() internal view returns (bool) {
        return block.timestamp >= currentWindowStart + 30 days;
    }

    function _refreshWindow() internal {
        if (_isNewWindow()) {
            currentWindowStart += 30 days;  // advance by exactly 30 days to prevent drift
            mintedThisWindow   = 0;
        }
    }

    function _enforceReserveRatio(uint256 usdcOut) internal view {
        uint256 supply = tmim.totalSupply();
        if (supply == 0) return;
        uint256 usdcAfter = usdc.balanceOf(address(this)) - usdcOut;
        uint256 usdcNeeded = (supply * redemptionRateBps * 1e6) / 10_000;
        if (usdcNeeded == 0) return;
        uint256 ratioPpm = (usdcAfter * 1_000) / usdcNeeded;
        require(ratioPpm >= minReserveRatioPpm, "Reserve ratio too low");
    }
}
