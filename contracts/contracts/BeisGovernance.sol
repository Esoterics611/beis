// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./SecharToken.sol";

/**
 * @title BeisGovernance
 * @notice On-chain governance for Beis DAO.
 *
 * Flow: propose → vote → finalize → execute
 *
 * Voting power = tmimBalance(voter) × rankVotingMultiplier(voter)
 *
 * Hardening (C1 + C3):
 *  - C1: castVote requires an EIP-712 RankAttestation signed by the backend
 *        attestation signer, bound to (voter, rankIndex, proposalId, nonce, expiry).
 *        Closes the governance-takeover hole where caller could supply any rank.
 *  - C3: propose() classifies proposals by ProposalType and enforces a
 *        trusted-target / allowed-selector whitelist, blocking attacker-crafted
 *        call payloads (e.g. proposing target=victim with malicious calldata).
 *  - C3: executeProposal() reserves a gas floor so an out-of-gas griefing
 *        callee cannot strand a proposal in an inconsistent state, and emits
 *        ExecutionAttempted so off-chain consumers can audit failed executions.
 */
contract BeisGovernance is AccessControl, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // ─── Roles ───────────────────────────────────────────────────────────
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    // ─── EIP-712 typehash ────────────────────────────────────────────────
    bytes32 private constant RANK_ATTESTATION_TYPEHASH = keccak256(
        "RankAttestation(address voter,uint8 rankIndex,uint256 proposalId,uint256 nonce,uint256 expiry)"
    );

    // ─── TMIM token ──────────────────────────────────────────────────────
    SecharToken public immutable tmim;

    // ─── Attestation state ───────────────────────────────────────────────
    address public attestationSigner;
    mapping(uint256 => bool) public usedNonces;

    // ─── Governance parameters ───────────────────────────────────────────
    uint256 public votingPeriod   = 7 days;
    uint256 public timelockDelay  = 2 days;
    uint256 public defaultQuorum  = 10_000;

    /// @notice Gas reserved on the executor frame after the external call so
    ///         we can finish state writes / events even if the callee burned
    ///         all forwarded gas. 63/64 rule keeps callee from starving us
    ///         entirely, but an explicit reserve is defense-in-depth.
    uint256 public executionGasReserve = 50_000;

    // Rank voting power multipliers (indices match RANKS array in TypeScript)
    // 0=turai(1), 1=rav_turai(2), 2=samal(5), 3=samal_rishon(8),
    // 4=rav_samal(12), 5=segen(18), 6=seren(25), 7=rav_seren(35),
    // 8=sgan_aluf(45), 9=aluf(60)
    uint256[10] public rankVotingPower = [1, 2, 5, 8, 12, 18, 25, 35, 45, 60];

    // ─── Proposal classification (C3) ────────────────────────────────────
    enum ProposalState { Active, Passed, Failed, Queued, Executed, Cancelled }

    /// @notice ProposalType matches SPEC_2_DAO_REQUIREMENTS §Section 2B.
    /// Order is load-bearing — never reorder; only append.
    /// SIGNAL is a no-op type for purely advisory proposals (target == 0, no calldata).
    enum ProposalType {
        SIGNAL,                 // 0 — advisory only; no on-chain effect
        MIVTZA_FUNDING,         // 1 — Treasury allocation to a mivtza
        REDEMPTION_RATE,        // 2 — Change TMIM redemption rate
        EMERGENCY_PAUSE,        // 3 — Pause Treasury/Token
        EMERGENCY_UNPAUSE,      // 4 — Unpause
        TREASURY_TRANSFER,      // 5 — Withdraw funds to external address
        GRANT_ROLE,             // 6 — grantRole on a managed contract
        PARAMETER_UPDATE,       // 7 — Update governance parameters
        MINT_TOKENS,            // 8 — Mint TMIM via governance
        MONTHLY_CAP_UPDATE      // 9 — Change maxMonthlyMint
    }

    struct Proposal {
        address  proposer;
        ProposalType proposalType;
        string   title;
        string   description;
        address  target;
        bytes    callData;
        uint256  votesFor;
        uint256  votesAgainst;
        uint256  votesAbstain;
        uint256  snapshotBlock;
        uint256  votingStart;
        uint256  votingEnd;
        uint256  executionTime;
        ProposalState state;
        bool     executed;
        uint256  quorumRequired;
        uint256  totalVotingTokens;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint8)) public voteChoice;

    // ─── Target / selector whitelists (C3) ───────────────────────────────
    /// @notice Address must be allowlisted before any non-SIGNAL proposal can
    ///         target it. Limits damage if an attacker gains PROPOSER_ROLE.
    mapping(address => bool) public trustedTargets;

    /// @notice (proposalType => selector => allowed). A given proposal type
    ///         may only call a pre-approved set of function selectors. Set
    ///         selectors out-of-band by the admin; updates are auditable.
    mapping(uint8 => mapping(bytes4 => bool)) public allowedSelectors;

    // ─── RankAttestation struct (calldata type) ──────────────────────────
    struct RankAttestation {
        address voter;
        uint8   rankIndex;
        uint256 proposalId;
        uint256 nonce;
        uint256 expiry;
        bytes   signature;
    }

    // ─── Events ──────────────────────────────────────────────────────────
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        ProposalType indexed proposalType,
        string  title,
        uint256 votingStart,
        uint256 votingEnd
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8   support,
        uint8   rankIndex,
        uint256 weight,
        uint256 nonce
    );
    event ProposalQueued(uint256 indexed id, uint256 executionTime);
    event ProposalExecuted(uint256 indexed id);
    event ExecutionAttempted(uint256 indexed id, bool success, bytes returnData);
    event ProposalCancelled(uint256 indexed id);
    event GovernanceParameterUpdated(string param, uint256 value);
    event AttestationSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event TrustedTargetUpdated(address indexed target, bool allowed);
    event AllowedSelectorUpdated(ProposalType indexed proposalType, bytes4 indexed selector, bool allowed);

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(
        address admin,
        address tmimToken,
        address _attestationSigner
    ) EIP712("BeisGovernance", "1") {
        require(admin != address(0), "admin zero");
        require(tmimToken != address(0), "tmim zero");
        require(_attestationSigner != address(0), "signer zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);

        tmim = SecharToken(tmimToken);
        attestationSigner = _attestationSigner;
        emit AttestationSignerUpdated(address(0), _attestationSigner);
    }

    // ─── Propose ─────────────────────────────────────────────────────────
    /**
     * @notice Create a new proposal of a specific type.
     *
     * Validation:
     *  - SIGNAL proposals must have target==0 and empty callData. They produce
     *    no on-chain effect on execute.
     *  - All other types: target must be in `trustedTargets`, callData must
     *    start with a 4-byte selector that is allow-listed for the type.
     */
    function propose(
        ProposalType proposalType,
        string  calldata title,
        string  calldata description,
        address target,
        bytes   calldata callData,
        uint256 quorumOverride
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 proposalId) {
        if (proposalType == ProposalType.SIGNAL) {
            require(target == address(0) && callData.length == 0, "SIGNAL must be no-op");
        } else {
            require(target != address(0), "Target zero");
            require(trustedTargets[target], "Target not trusted");
            require(callData.length >= 4, "Calldata too short");
            bytes4 selector = bytes4(callData[:4]);
            require(allowedSelectors[uint8(proposalType)][selector], "Selector not allowed");
        }

        // L-2: a quorum above the most voting weight that could exist can never
        // be met. Overrides may lower the quorum but not exceed that ceiling.
        require(quorumOverride <= _maxPossibleVoteWeight(), "Quorum unreachable");

        proposalId = ++proposalCount;
        uint256 vStart = block.timestamp;
        uint256 vEnd   = vStart + votingPeriod;

        proposals[proposalId] = Proposal({
            proposer:          msg.sender,
            proposalType:      proposalType,
            title:             title,
            description:       description,
            target:            target,
            callData:          callData,
            votesFor:          0,
            votesAgainst:      0,
            votesAbstain:      0,
            snapshotBlock:     block.number,
            votingStart:       vStart,
            votingEnd:         vEnd,
            executionTime:     0,
            state:             ProposalState.Active,
            executed:          false,
            quorumRequired:    quorumOverride > 0 ? quorumOverride : defaultQuorum,
            totalVotingTokens: tmim.totalSupply()
        });

        emit ProposalCreated(proposalId, msg.sender, proposalType, title, vStart, vEnd);
    }

    // ─── Vote (EIP-712 rank-attested) ────────────────────────────────────

    /**
     * @notice Cast a vote on an active proposal, authenticating the voter's
     *         rank via an EIP-712 attestation signed by the backend.
     * @param proposalId  ID of the proposal
     * @param support     0 = For, 1 = Against, 2 = Abstain
     * @param att         RankAttestation signed by `attestationSigner`
     */
    function castVote(
        uint256 proposalId,
        uint8   support,
        RankAttestation calldata att
    ) external nonReentrant {
        require(support <= 2, "Invalid support value");
        require(att.rankIndex < 10, "Invalid rank index");
        require(att.voter == msg.sender, "Attestation not for caller");
        require(att.proposalId == proposalId, "Attestation proposal mismatch");
        require(block.timestamp < att.expiry, "Attestation expired");
        require(!usedNonces[att.nonce], "Nonce already used");

        // Reconstruct EIP-712 digest and recover signer.
        bytes32 structHash = keccak256(abi.encode(
            RANK_ATTESTATION_TYPEHASH,
            att.voter,
            att.rankIndex,
            att.proposalId,
            att.nonce,
            att.expiry
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, att.signature);
        require(recovered != address(0) && recovered == attestationSigner, "Invalid attestation");

        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp >= p.votingStart, "Voting not started");
        require(block.timestamp < p.votingEnd, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 balance = tmim.balanceOf(msg.sender);
        require(balance > 0, "No TMIM balance");

        uint256 weight = balance * rankVotingPower[att.rankIndex];

        usedNonces[att.nonce]            = true;
        hasVoted[proposalId][msg.sender] = true;
        voteChoice[proposalId][msg.sender] = support;

        if (support == 0) {
            p.votesFor += weight;
        } else if (support == 1) {
            p.votesAgainst += weight;
        } else {
            p.votesAbstain += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, att.rankIndex, weight, att.nonce);
    }

    // ─── Supermajority threshold (SPEC_2 §2B line 621) ──────────────────
    /// @notice 6600 bps = 66%. Sensitive proposal types require this fraction
    ///         of participating votes to be FOR, not just a simple majority.
    uint256 public supermajorityBps = 6600;

    /// @notice Returns true if this proposal type requires a 66% supermajority.
    /// Covers: GRANT_ROLE (6), PARAMETER_UPDATE (7), MONTHLY_CAP_UPDATE (9).
    function _requiresSupermajority(ProposalType pt) private pure returns (bool) {
        return pt == ProposalType.GRANT_ROLE
            || pt == ProposalType.PARAMETER_UPDATE
            || pt == ProposalType.MONTHLY_CAP_UPDATE;
    }

    // ─── Finalize ────────────────────────────────────────────────────────
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.Active, "Not active");
        require(block.timestamp >= p.votingEnd, "Voting still open");

        uint256 totalVotes = p.votesFor + p.votesAgainst + p.votesAbstain;
        bool    quorumMet  = totalVotes >= p.quorumRequired;

        bool passed;
        if (_requiresSupermajority(p.proposalType)) {
            // 66% supermajority: votesFor / (votesFor + votesAgainst) >= 66%
            // Avoids division-by-zero; if nobody voted, quorumMet is false anyway.
            uint256 contested = p.votesFor + p.votesAgainst;
            passed = quorumMet
                && contested > 0
                && p.votesFor * 10_000 >= contested * supermajorityBps;
        } else {
            passed = quorumMet && p.votesFor > p.votesAgainst;
        }

        if (passed) {
            p.state         = ProposalState.Queued;
            p.executionTime = block.timestamp + timelockDelay;
            emit ProposalQueued(proposalId, p.executionTime);
        } else {
            p.state = ProposalState.Failed;
        }
    }

    function setSupermajorityBps(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps >= 5001 && _bps <= 9999, "Bps out of range [5001,9999]");
        supermajorityBps = _bps;
        emit GovernanceParameterUpdated("supermajorityBps", _bps);
    }

    // ─── Execute ─────────────────────────────────────────────────────────
    /**
     * @notice Execute a queued proposal whose timelock has expired.
     *         Forwards `gasleft() - executionGasReserve` gas to the target so
     *         the executor frame retains enough gas to finish bookkeeping
     *         even if the callee burns its share. SIGNAL proposals execute
     *         as a no-op (state transition only).
     */
    function executeProposal(uint256 proposalId)
        external
        onlyRole(EXECUTOR_ROLE)
        nonReentrant
    {
        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.Queued, "Not queued");
        require(block.timestamp >= p.executionTime, "Timelock not expired");
        require(!p.executed, "Already executed");

        p.state    = ProposalState.Executed;
        p.executed = true;

        if (p.target != address(0) && p.callData.length > 0) {
            uint256 gasNow = gasleft();
            require(gasNow > executionGasReserve, "Insufficient gas for execution");
            uint256 gasToForward = gasNow - executionGasReserve;

            (bool success, bytes memory ret) = p.target.call{gas: gasToForward}(p.callData);
            emit ExecutionAttempted(proposalId, success, ret);
            require(success, _extractRevertReason(ret));
        }

        emit ProposalExecuted(proposalId);
    }

    /// @dev Return the message of a standard Error(string) revert in `ret`, or
    ///      "Execution failed" for anything else. L-1: the payload is validated
    ///      instead of abi-decoded, so custom errors or malformed data from the
    ///      callee can't panic and block the proposal from executing.
    ///      Error(string) layout: selector (4) | offset = 0x20 (32) | length (32) | bytes.
    function _extractRevertReason(bytes memory ret) private pure returns (string memory) {
        if (ret.length < 68 || bytes4(ret) != bytes4(0x08c379a0)) return "Execution failed";
        uint256 offset;
        uint256 len;
        assembly ("memory-safe") {
            offset := mload(add(ret, 36))   // skip length word (32) + selector (4)
            len    := mload(add(ret, 68))
        }
        if (offset != 32 || len > ret.length - 68) return "Execution failed";
        bytes memory reason = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            reason[i] = ret[68 + i];
        }
        return string(reason);
    }

    // ─── Cancel ──────────────────────────────────────────────────────────
    /// @notice Admin may cancel an Active or Queued proposal. M-2: the proposer
    ///         may withdraw only an Active proposal no one has voted on yet, so
    ///         a proposer can't watch the vote and cancel a result they dislike.
    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        require(p.proposer == msg.sender || isAdmin, "Not authorized");
        require(
            p.state == ProposalState.Active || p.state == ProposalState.Queued,
            "Cannot cancel"
        );
        if (!isAdmin) {
            require(p.state == ProposalState.Active, "Proposer can cancel only Active proposals");
            require(p.votesFor + p.votesAgainst + p.votesAbstain == 0, "Votes already cast");
        }
        p.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // ─── Whitelist administration (C3) ───────────────────────────────────
    function setTrustedTarget(address target, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(target != address(0), "Target zero");
        trustedTargets[target] = allowed;
        emit TrustedTargetUpdated(target, allowed);
    }

    function setAllowedSelector(ProposalType proposalType, bytes4 selector, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        allowedSelectors[uint8(proposalType)][selector] = allowed;
        emit AllowedSelectorUpdated(proposalType, selector, allowed);
    }

    /// @notice Batch helper — initialize the standard SPEC_2 selector matrix
    ///         in a single tx. Deployer should call this once per network.
    /// @dev Targets must be the actual contract addresses for that network.
    function bootstrapSelectorWhitelist(
        address governanceTreasury,
        address tmimToken,
        address chayoleiRegistry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (governanceTreasury != address(0)) {
            trustedTargets[governanceTreasury] = true;
            emit TrustedTargetUpdated(governanceTreasury, true);
        }
        if (tmimToken != address(0)) {
            trustedTargets[tmimToken] = true;
            emit TrustedTargetUpdated(tmimToken, true);
        }
        if (chayoleiRegistry != address(0)) {
            trustedTargets[chayoleiRegistry] = true;
            emit TrustedTargetUpdated(chayoleiRegistry, true);
        }
        // Self-target for PARAMETER_UPDATE
        trustedTargets[address(this)] = true;
        emit TrustedTargetUpdated(address(this), true);

        // GovernanceTreasury selectors
        _allow(ProposalType.REDEMPTION_RATE,    bytes4(keccak256("setRedemptionRate(uint256)")));
        _allow(ProposalType.MONTHLY_CAP_UPDATE, bytes4(keccak256("setMaxMonthlyMint(uint256)")));
        _allow(ProposalType.EMERGENCY_PAUSE,    bytes4(keccak256("pause()")));
        _allow(ProposalType.EMERGENCY_UNPAUSE,  bytes4(keccak256("unpause()")));
        _allow(ProposalType.MIVTZA_FUNDING,     bytes4(keccak256("createStream(address,uint256,uint256)")));
        _allow(ProposalType.TREASURY_TRANSFER,  bytes4(keccak256("cancelStream(uint256)")));

        // SecharToken selectors
        _allow(ProposalType.MINT_TOKENS, bytes4(keccak256("mint(address,uint256,string)")));

        // Generic role grant — applies to any trusted target
        _allow(ProposalType.GRANT_ROLE, bytes4(keccak256("grantRole(bytes32,address)")));
    }

    function _allow(ProposalType proposalType, bytes4 selector) private {
        allowedSelectors[uint8(proposalType)][selector] = true;
        emit AllowedSelectorUpdated(proposalType, selector, true);
    }

    // ─── Parameter updates ───────────────────────────────────────────────
    function setVotingPeriod(uint256 _period) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_period >= 1 days && _period <= 30 days, "Out of range");
        votingPeriod = _period;
        emit GovernanceParameterUpdated("votingPeriod", _period);
    }

    function setTimelockDelay(uint256 _delay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_delay <= 7 days, "Delay too long");
        timelockDelay = _delay;
        emit GovernanceParameterUpdated("timelockDelay", _delay);
    }

    function setDefaultQuorum(uint256 _quorum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_quorum > 0, "Quorum must be positive");
        defaultQuorum = _quorum;
        emit GovernanceParameterUpdated("defaultQuorum", _quorum);
    }

    function setExecutionGasReserve(uint256 _reserve) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_reserve >= 10_000 && _reserve <= 500_000, "Reserve out of range");
        executionGasReserve = _reserve;
        emit GovernanceParameterUpdated("executionGasReserve", _reserve);
    }

    /**
     * @notice Rotate the attestation signer. Use to revoke a compromised
     *         backend key. Gated by APPROVER_ROLE so the DAO / multisig can
     *         act without full admin privileges.
     */
    function setAttestationSigner(address newSigner) external onlyRole(APPROVER_ROLE) {
        require(newSigner != address(0), "signer zero");
        address old = attestationSigner;
        attestationSigner = newSigner;
        emit AttestationSignerUpdated(old, newSigner);
    }

    // ─── View helpers ────────────────────────────────────────────────────
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    /// @dev The most voting weight that could be cast right now: the whole
    ///      TMIM supply voting at the highest rank multiplier.
    function _maxPossibleVoteWeight() private view returns (uint256) {
        uint256 maxPower;
        for (uint256 i = 0; i < rankVotingPower.length; i++) {
            if (rankVotingPower[i] > maxPower) maxPower = rankVotingPower[i];
        }
        return tmim.totalSupply() * maxPower;
    }

    function getVoteWeight(address voter, uint8 rankIndex) external view returns (uint256) {
        require(rankIndex < 10, "Invalid rank index");
        return tmim.balanceOf(voter) * rankVotingPower[rankIndex];
    }

    /// @notice Expose the EIP-712 domain separator (useful for off-chain signers).
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Expose the struct typehash (useful for off-chain signers).
    function rankAttestationTypehash() external pure returns (bytes32) {
        return RANK_ATTESTATION_TYPEHASH;
    }
}
