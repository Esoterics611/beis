// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SecharToken
 * @notice ERC-20 token for the Beis DAO.
 * @dev 0 decimals — 1 TMIM = 1 token unit = $0.10 USD (configurable).
 *      Only authorized minters (treasury, rewards contracts) can mint.
 *      Burning is done by treasury on redemption.
 */
contract SecharToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Redemption rate in basis points: 1000 bps = $0.10 per TMIM
    uint256 public redemptionRateBps = 1000;

    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount);
    event RedemptionRateUpdated(uint256 newRateBps);

    constructor(address admin) ERC20("TMIM Token", "TMIM") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
    }

    /**
     * @notice Mint TMIM to a recipient. Called by treasury or rewards contracts.
     * @param to      Recipient wallet
     * @param amount  Number of TMIM (no decimals)
     * @param reason  Human-readable reason (masima_approved, donation, etc.)
     */
    function mint(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    /**
     * @notice Burn TMIM from a holder's balance. Called by treasury on redemption.
     */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /// @notice TMIM uses 0 decimals — 1 token = 1 TMIM
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Update the redemption rate (admin only)
    function setRedemptionRate(uint256 rateBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(rateBps > 0, "Rate must be positive");
        redemptionRateBps = rateBps;
        emit RedemptionRateUpdated(rateBps);
    }

    /// @notice Calculate USD value of TMIM amount (returns cents * 10)
    function tmimToUsdBps(uint256 tmimAmount) external view returns (uint256) {
        return tmimAmount * redemptionRateBps;
    }
}
