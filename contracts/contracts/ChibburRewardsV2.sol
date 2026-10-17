// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SecharToken.sol";

/**
 * @title ChibburRewardsV2
 * @notice Upgrade to ChibburRewards with additional features:
 *
 *  1. approveWithMemo() — store a memo hash alongside approval (e.g. IPFS CID
 *     of the published paper) so the approval is linked to the final artefact.
 *
 *  2. batchApprove() — approve multiple masimot in a single transaction to save
 *     gas on bulk end-of-month reward distributions.
 *
 *  3. Pausing — APPROVER_ROLE can pause/unpause approvals (emergency governance).
 *
 *  4. Revision requests — optional on-chain record that a masima was sent back
 *     for revision before final approval.
 *
 * Inherits the same ApprovalRecord structure as V1 for backward-compatible
 * indexing by the backend Cloud Functions.
 */
contract ChibburRewardsV2 is AccessControl, ReentrancyGuard {
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    SecharToken public immutable tmim;

    struct ApprovalRecord {
        address assignee;
        uint256 reward;
        uint256 approvedAt;
        bool    onChain;
        bytes32 memoHash;   // IPFS CID or keccak256 of revision notes (V2 addition)
    }

    mapping(bytes32 => ApprovalRecord) public masimaApprovals;
    mapping(bytes32 => ApprovalRecord) public tafkidApprovals;

    /// @notice Masimot that have been sent back for revision
    mapping(bytes32 => uint256) public revisionCount;
    mapping(bytes32 => bytes32) public latestRevisionMemo;

    uint256 public totalRewardsDistributed;
    bool    public paused;

    // ─── Events ───────────────────────────────────────────────────────────
    event MasimaApproved(bytes32 indexed masimaId, address indexed assignee, uint256 reward, bytes32 memoHash);
    event TafkidApproved(bytes32 indexed tafkidId, address indexed assignee, uint256 reward);
    event MasimaRevisionRequested(bytes32 indexed masimaId, bytes32 memoHash);
    event MasimaPublished(bytes32 indexed masimaId, address indexed assignee, bytes32 ipfsCid);
    event BatchApproved(uint256 count, uint256 totalRewarded);
    event Paused();
    event Unpaused();

    modifier whenNotPaused() {
        require(!paused, "Approvals paused");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address admin, address tmimToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
        tmim = SecharToken(tmimToken);
    }

    // ─── Single approval ──────────────────────────────────────────────────

    /**
     * @notice Approve a masima and mint TMIM.
     * @param masimaIdHash  keccak256 of the Firestore masima ID
     * @param assignee      Researcher's wallet address
     * @param reward        TMIM to mint (rank multiplier already applied off-chain)
     */
    function approveMasima(
        bytes32 masimaIdHash,
        address assignee,
        uint256 reward
    ) external onlyRole(APPROVER_ROLE) nonReentrant whenNotPaused {
        require(!masimaApprovals[masimaIdHash].onChain, "Already approved");
        require(assignee != address(0), "Invalid assignee");
        require(reward > 0, "Zero reward");

        masimaApprovals[masimaIdHash] = ApprovalRecord({
            assignee:   assignee,
            reward:     reward,
            approvedAt: block.timestamp,
            onChain:    true,
            memoHash:   bytes32(0)
        });

        tmim.mint(assignee, reward, "masima_approved");
        totalRewardsDistributed += reward;

        emit MasimaApproved(masimaIdHash, assignee, reward, bytes32(0));
    }

    /**
     * @notice Approve a masima with an associated IPFS memo hash (e.g. final paper CID).
     */
    function approveWithMemo(
        bytes32 masimaIdHash,
        address assignee,
        uint256 reward,
        bytes32 memoHash
    ) external onlyRole(APPROVER_ROLE) nonReentrant whenNotPaused {
        require(!masimaApprovals[masimaIdHash].onChain, "Already approved");
        require(assignee != address(0), "Invalid assignee");
        require(reward > 0, "Zero reward");

        masimaApprovals[masimaIdHash] = ApprovalRecord({
            assignee:   assignee,
            reward:     reward,
            approvedAt: block.timestamp,
            onChain:    true,
            memoHash:   memoHash
        });

        tmim.mint(assignee, reward, "masima_approved_with_memo");
        totalRewardsDistributed += reward;

        emit MasimaApproved(masimaIdHash, assignee, reward, memoHash);
    }

    /**
     * @notice Approve a tafkid (sub-task) and mint TMIM.
     */
    function approveTafkid(
        bytes32 tafkidIdHash,
        address assignee,
        uint256 reward
    ) external onlyRole(APPROVER_ROLE) nonReentrant whenNotPaused {
        require(!tafkidApprovals[tafkidIdHash].onChain, "Already approved");
        require(assignee != address(0), "Invalid assignee");
        require(reward > 0, "Zero reward");

        tafkidApprovals[tafkidIdHash] = ApprovalRecord({
            assignee:   assignee,
            reward:     reward,
            approvedAt: block.timestamp,
            onChain:    true,
            memoHash:   bytes32(0)
        });

        tmim.mint(assignee, reward, "tafkid_approved");
        totalRewardsDistributed += reward;

        emit TafkidApproved(tafkidIdHash, assignee, reward);
    }

    // ─── Batch approval ───────────────────────────────────────────────────

    struct BatchItem {
        bytes32 idHash;
        address assignee;
        uint256 reward;
        bytes32 memoHash;
        bool    isTafkid;   // false = masima, true = tafkid
    }

    /**
     * @notice Approve multiple masimot/tafkidim in one transaction.
     *         Items already approved on-chain are silently skipped.
     * @param items  Array of BatchItem structs (max 50 to stay within gas limits)
     */
    function batchApprove(BatchItem[] calldata items)
        external
        onlyRole(APPROVER_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(items.length > 0 && items.length <= 50, "Invalid batch size");

        uint256 totalRewarded = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < items.length; i++) {
            BatchItem calldata it = items[i];
            if (it.assignee == address(0) || it.reward == 0) continue;

            if (it.isTafkid) {
                if (tafkidApprovals[it.idHash].onChain) continue;
                tafkidApprovals[it.idHash] = ApprovalRecord({
                    assignee:   it.assignee,
                    reward:     it.reward,
                    approvedAt: block.timestamp,
                    onChain:    true,
                    memoHash:   it.memoHash
                });
                emit TafkidApproved(it.idHash, it.assignee, it.reward);
            } else {
                if (masimaApprovals[it.idHash].onChain) continue;
                masimaApprovals[it.idHash] = ApprovalRecord({
                    assignee:   it.assignee,
                    reward:     it.reward,
                    approvedAt: block.timestamp,
                    onChain:    true,
                    memoHash:   it.memoHash
                });
                emit MasimaApproved(it.idHash, it.assignee, it.reward, it.memoHash);
            }

            tmim.mint(it.assignee, it.reward, it.isTafkid ? "tafkid_approved" : "masima_approved");
            totalRewarded += it.reward;
            count++;
        }

        totalRewardsDistributed += totalRewarded;
        emit BatchApproved(count, totalRewarded);
    }

    // ─── Revision workflow ────────────────────────────────────────────────

    /**
     * @notice Record that a masima has been sent back for revision.
     *         Does not prevent future approval.
     */
    function requestRevision(bytes32 masimaIdHash, bytes32 memoHash)
        external
        onlyRole(APPROVER_ROLE)
    {
        revisionCount[masimaIdHash]++;
        latestRevisionMemo[masimaIdHash] = memoHash;
        emit MasimaRevisionRequested(masimaIdHash, memoHash);
    }

    /**
     * @notice Mark a masima as published on-chain (post-approval IPFS record).
     */
    function markPublished(bytes32 masimaIdHash, bytes32 ipfsCid)
        external
        onlyRole(APPROVER_ROLE)
    {
        require(masimaApprovals[masimaIdHash].onChain, "Not yet approved");
        emit MasimaPublished(masimaIdHash, masimaApprovals[masimaIdHash].assignee, ipfsCid);
    }

    // ─── Emergency pause ──────────────────────────────────────────────────

    function pause()   external onlyRole(APPROVER_ROLE) { paused = true;  emit Paused(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { paused = false; emit Unpaused(); }

    // ─── Views ────────────────────────────────────────────────────────────

    function isMasimaApproved(bytes32 masimaIdHash) external view returns (bool) {
        return masimaApprovals[masimaIdHash].onChain;
    }

    function isTafkidApproved(bytes32 tafkidIdHash) external view returns (bool) {
        return tafkidApprovals[tafkidIdHash].onChain;
    }
}
