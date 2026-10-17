// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BeisRegistry
 * @notice On-chain identity and rank registry for Chayolei Beis Dovid.
 *         Ranks map 1:1 with the off-chain rank system:
 *           0 = turai, 1 = rav_turai, 2 = samal, 3 = samal_rishon, 4 = rav_samal
 *           5 = segen, 6 = seren, 7 = rav_seren, 8 = sgan_aluf, 9 = aluf
 *         Tier:  0-1 = enlisted, 2-4 = nco, 5-9 = officer
 */
contract BeisRegistry is AccessControl {
    bytes32 public constant PROMOTER_ROLE = keccak256("PROMOTER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Chayal {
        bool     registered;
        uint8    rank;           // 0-9
        bytes32  makomId;        // keccak256 of makom name
        uint256  registeredAt;
        uint256  promotedAt;
        uint256  tokensRequired; // tokens needed for next promotion
    }

    mapping(address => Chayal) public chaverim;
    uint256 public totalRegistered;

    /// @notice Minimum tokens required per rank promotion (0-indexed: need these to advance from rank i)
    uint256[9] public rankTokenThresholds = [
        0,      // turai → rav_turai
        100,    // rav_turai → samal
        250,    // samal → samal_rishon
        500,    // samal_rishon → rav_samal
        1000,   // rav_samal → segen
        2000,   // segen → seren (officer threshold)
        5000,   // seren → rav_seren
        10000,  // rav_seren → sgan_aluf
        20000   // sgan_aluf → aluf
    ];

    event Registered(address indexed wallet, uint8 rank, bytes32 makomId);
    event Promoted(address indexed wallet, uint8 oldRank, uint8 newRank, address promotedBy);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROMOTER_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /**
     * @notice Register a new chayal. Called by the backend on first signup.
     * @param wallet   The chayal's wallet address
     * @param makomId  keccak256 of the makom name
     */
    function register(address wallet, bytes32 makomId) external onlyRole(REGISTRAR_ROLE) {
        require(!chaverim[wallet].registered, "Already registered");
        chaverim[wallet] = Chayal({
            registered:     true,
            rank:           0,
            makomId:        makomId,
            registeredAt:   block.timestamp,
            promotedAt:     0,
            tokensRequired: rankTokenThresholds[0]
        });
        totalRegistered++;
        emit Registered(wallet, 0, makomId);
    }

    /**
     * @notice Promote a chayal to the next rank.
     * @param wallet  The chayal to promote
     */
    function promote(address wallet) external onlyRole(PROMOTER_ROLE) {
        Chayal storage c = chaverim[wallet];
        require(c.registered, "Not registered");
        require(c.rank < 9, "Already maximum rank");

        uint8 oldRank = c.rank;
        c.rank++;
        c.promotedAt = block.timestamp;
        c.tokensRequired = c.rank < 9 ? rankTokenThresholds[c.rank] : type(uint256).max;

        emit Promoted(wallet, oldRank, c.rank, msg.sender);
    }

    /// @notice Get a chayal's current rank (0-9)
    function getRank(address wallet) external view returns (uint8) {
        return chaverim[wallet].rank;
    }

    /// @notice Get tier as a string: "enlisted", "nco", or "officer"
    function getTier(address wallet) external view returns (string memory) {
        uint8 rank = chaverim[wallet].rank;
        if (rank <= 1) return "enlisted";
        if (rank <= 4) return "nco";
        return "officer";
    }

    /// @notice Check if address is an officer (rank >= 5)
    function isOfficer(address wallet) external view returns (bool) {
        return chaverim[wallet].rank >= 5;
    }

    /// @notice Check if address is registered
    function isRegistered(address wallet) external view returns (bool) {
        return chaverim[wallet].registered;
    }
}
