// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SecharToken.sol";

/**
 * @title ChibburRewards
 * @notice Handles on-chain approval and token reward distribution for
 *         Masimot (research assignments) and Tafkidim (sub-tasks).
 *
 *         The backend Cloud Function calls approveMasima() / approveTafkid()
 *         after validating the off-chain state machine, ensuring the on-chain
 *         record is authoritative for token issuance.
 */
contract ChibburRewards is AccessControl, ReentrancyGuard {
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    SecharToken public immutable tmim;

    struct ApprovalRecord {
        address assignee;
        uint256 reward;
        uint256 approvedAt;
        bool    onChain;
    }

    /// @notice masimaId (off-chain Firestore ID hash) → approval record
    mapping(bytes32 => ApprovalRecord) public masimaApprovals;
    mapping(bytes32 => ApprovalRecord) public tafkidApprovals;

    uint256 public totalRewardsDistributed;

    event MasimaApproved(bytes32 indexed masimaId, address indexed assignee, uint256 reward);
    event TafkidApproved(bytes32 indexed tafkidId, address indexed assignee, uint256 reward);
    event MasimaPublished(bytes32 indexed masimaId, address indexed assignee);

    constructor(address admin, address tmimToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
        tmim = SecharToken(tmimToken);
    }

    /**
     * @notice Approve a masima and mint TMIM to the assignee.
     * @param masimaIdHash  keccak256 of the Firestore masima document ID
     * @param assignee      Wallet address of the researcher
     * @param reward        Number of TMIM to mint (already multiplied by rank multiplier off-chain)
     */
    function approveMasima(
        bytes32 masimaIdHash,
        address assignee,
        uint256 reward
    ) external onlyRole(APPROVER_ROLE) nonReentrant {
        require(!masimaApprovals[masimaIdHash].onChain, "Already approved on-chain");
        require(assignee != address(0), "Invalid assignee");
        require(reward > 0, "Reward must be positive");

        masimaApprovals[masimaIdHash] = ApprovalRecord({
            assignee:   assignee,
            reward:     reward,
            approvedAt: block.timestamp,
            onChain:    true
        });

        tmim.mint(assignee, reward, "masima_approved");
        totalRewardsDistributed += reward;

        emit MasimaApproved(masimaIdHash, assignee, reward);
    }

    /**
     * @notice Approve a tafkid and mint TMIM to the assignee.
     */
    function approveTafkid(
        bytes32 tafkidIdHash,
        address assignee,
        uint256 reward
    ) external onlyRole(APPROVER_ROLE) nonReentrant {
        require(!tafkidApprovals[tafkidIdHash].onChain, "Already approved on-chain");
        require(assignee != address(0), "Invalid assignee");
        require(reward > 0, "Reward must be positive");

        tafkidApprovals[tafkidIdHash] = ApprovalRecord({
            assignee:   assignee,
            reward:     reward,
            approvedAt: block.timestamp,
            onChain:    true
        });

        tmim.mint(assignee, reward, "tafkid_approved");
        totalRewardsDistributed += reward;

        emit TafkidApproved(tafkidIdHash, assignee, reward);
    }

    /// @notice Check if a masima has been approved on-chain
    function isMasimaApproved(bytes32 masimaIdHash) external view returns (bool) {
        return masimaApprovals[masimaIdHash].onChain;
    }

    /// @notice Check if a tafkid has been approved on-chain
    function isTafkidApproved(bytes32 tafkidIdHash) external view returns (bool) {
        return tafkidApprovals[tafkidIdHash].onChain;
    }
}
