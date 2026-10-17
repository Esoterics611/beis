> **Phase 3 complete.** Vocabulary updated to Beis terminology. Contribution score (< 1000 = מתחיל, 1000–9999 = בקי, ≥ 10000 = מורה) replaces named rank tiers. Token is now Sechar (שכר). User-facing concepts: *chaburot*, *chibburim*, *sechar*, *community decisions*, *public ledger*.

---

# Spec 2: DAO Requirements — Beis

## Economic Model, Smart Contracts, and Governance UI

**Purpose:** Define the complete DAO governance system for Beis — tokenomics, new smart contracts, contract extensions, and the governance UI. This spec is divided into three integrated sections:

- **2A:** Economic Model & Tokenomics
- **2B:** Smart Contract Specification
- **2C:** DAO UI Specification

**Prerequisite:** Spec 1 (Academic UI Redesign) defines the visual theme. All UI described in Section 2C uses the academic theme from Spec 1.

---

## Table of Contents

- [Section 2A: Economic Model & Tokenomics](#section-2a-economic-model--tokenomics)
- [Section 2B: Smart Contract Specification](#section-2b-smart-contract-specification)
- [Section 2C: DAO UI Specification](#section-2c-dao-ui-specification)

---

## Domain Glossary

For the implementer — every Hebrew term used in this spec:

| Hebrew | Transliteration | English | Context |
|---|---|---|---|
| תמים (TMIM) | tamim | "Complete/Pure" | The ERC-20 token. Title for Tomchei Temimim students |
| תלמיד (pl. תלמידים) | chaver / chaverim | Student(s) | Platform users |
| מבצע (pl. מבצעים) | chaburah / chaburot | Campaign(s) | Academic campaign / research program |
| משימה (pl. משימות) | chibbur / chibburim | Assignment(s) | Research assignments within a chaburah |
| תפקיד (pl. תפקידים) | seif / seifim | Task(s) | Sub-tasks within a chibbur |
| מדרגה (pl. מדרגות) | madrega / madregot | Rank(s) / Level(s) | User rank in the system |
| מקום (pl. מקומות) | makom / mekomot | Place(s) / Location(s) | Campus / yeshiva location |
| חברותא | chavrusa | Study partner | Paired learning partner |
| שיעור | shiur | Class / Lecture | Learning group |
| פארבריינגען | farbrengen | Chassidic gathering | Community gathering event |
| מאמר (pl. מאמרים) | maamar / maamarim | Discourse(s) | Chassidic discourse |
| אוצר | otzar | Treasury | Financial reserves |
| הצבעה | hatzbaa | Vote / Voting | Governance voting |
| הצעה (pl. הצעות) | hatzaa / hatzaot | Proposal(s) | Governance proposal |
| נגלה | nigleh | Revealed Torah | Talmud/Halacha study track |
| חסידות | chassidus | Chassidic philosophy | Chassidus study track |
| חיל (pl. חיילים) | chaver / chaverim | Soldier(s) | Alternative term for participant |

---

# Section 2A: Economic Model & Tokenomics

## 1. Sechar Token (שכר) Fundamentals

| Property | Value |
|---|---|
| **Name** | Sechar |
| **Symbol** | Sechar |
| **Standard** | ERC-20 |
| **Decimals** | 0 (1 Sechar = 1 whole, indivisible token) |
| **Network** | Base Sepolia (Chain ID 84532) |
| **Contract** | `0x1A66CeE19C53956022f01842043d79d594BFb8E5` |
| **Target redemption rate** | $0.10 USD per Sechar |
| **Current supply** | 10,000 (test mint, held by deployer) |
| **Current redemption rate** | 1000 bps ($1.00) — **must be corrected to 100 bps ($0.10)** |

**Correction needed:** Call `SecharToken.setRedemptionRate(100)` from deployer wallet before any user-facing activity. This sets the rate to 100 basis points = $0.10/TMIM.

## 2. Issuance Model — How Sechar Are Created

TMIM tokens are minted (created) in five ways. All minting goes through the `SecharToken.mint()` function which requires `MINTER_ROLE`.

### 2.1 Task Completion Rewards (Primary Issuance)

**Trigger:** A chibbur or seif is approved by a reviewer.

**Flow:**
1. Reviewer approves chibbur/seif via UI → calls `ChibburRewards.approveChibbur()` or `approveSeif()`
2. ChibburRewards contract (which has `MINTER_ROLE`) calls `SecharToken.mint(assignee, reward, reason)`
3. Sechar minted to assignee's wallet

**Reward calculation:**
```
actualReward = baseReward × rankMultiplier
```

Where `baseReward` is the token allocation set when the chibbur/seif was created, and `rankMultiplier` comes from the assignee's current rank (see rank table below).

### 2.2 Peer Review Rewards

**Trigger:** A peer review is submitted and acknowledged by the chibbur author.

**Flow:**
1. Reviewer submits peer review (rating + comments)
2. Author acknowledges the review
3. Backend calls `ChibburRewards.approveSeif()` with a special "peer_review" seif ID
4. Sechar minted to reviewer

**Base reward:** Fixed per review (see reward table), modified by reviewer's rank multiplier.

### 2.3 Donation Conversion

**Trigger:** Donor sends ETH or USDC to the treasury.

**Flow:**
1. Donor calls `GovernanceTreasury.donateETH()` or `donateUSDC()`
2. Treasury calculates Sechar amount: `usdValue / redemptionRate`
3. Treasury (which has `MINTER_ROLE`) calls `SecharToken.mint(donor, amount, "donation")`
4. Donor receives **receipt tokens** — these Sechar give the donor governance voting power but are flagged as "donated" origin (see Section 2.4 Redemption for restrictions)

**Example:** Donor sends $1,000 USDC → Treasury mints 10,000 Sechar to donor at $0.10/TMIM rate.

### 2.4 Promotion Bonuses

**Trigger:** Chaver reaches the Sechar threshold for a new rank and is promoted.

**Flow:**
1. Backend detects chaver has accumulated enough `totalTokensEarned` for next rank
2. Officer (or governance) calls `ChayoleiRegistry.promote(wallet)`
3. Backend calls `SecharToken.mint(wallet, promotionBonus, "promotion_to_[rank]")`

**Promotion bonuses by rank:**

| Rank | Sechar Threshold | Promotion Bonus |
|---|---|---|
| טוראי (Turai) | 0 | 0 (starting rank) |
| רב טוראי (Rav Turai) | 200 | 50 |
| סמל (Samal) | 800 | 150 |
| סמ"ר (Samal Rishon) | 2,000 | 400 |
| רס"מ (Rav Samal) | 5,000 | 800 |
| סגן (Segen) | 10,000 | 1,500 |
| סרן (Seren) | 20,000 | 3,000 |
| רב סרן (Rav Seren) | 40,000 | 6,000 |
| סגן אלוף (Sgan Aluf) | 75,000 | 12,000 |
| אלוף (Aluf) | 150,000 | 25,000 |

### 2.5 Governance Minting

**Trigger:** A governance proposal of type "mint" is executed.

**Flow:**
1. Officer/high-rank chaver creates a proposal: "Mint X Sechar to address Y for reason Z"
2. Voting period → quorum met → proposal passes
3. Timelock elapses
4. Anyone calls `execute()` on the governance contract
5. Governance contract (which has `MINTER_ROLE`) calls `SecharToken.mint()`

**Use cases:** Retroactive rewards, special grants, competition prizes, external contributor compensation.

## 3. Reward Amounts — Baseline Sechar Per Action

### 3.1 Chibbur (Assignment) Base Rewards

These are **base rewards** before rank multiplier. The actual tokens allocated to a chibbur are set by the chaburah creator, but these are the **recommended defaults**.

| Chibbur Type | Hebrew | Base Sechar | Rationale |
|---|---|---|---|
| `lecture_notes` | רשימות שיעור | 20 | Light effort, structured notes |
| `source_analysis` | ניתוח מקורות | 40 | Moderate — requires careful source work |
| `chapter_draft` | טיוטת פרק | 60 | Substantial writing effort |
| `research_paper` | מאמר מחקרי | 100 | Heavy effort, original scholarship |
| `peer_review` | ביקורת עמיתים | 15 | Review another's work (distinct from PeerReview entity below) |
| `presentation` | הרצאה | 30 | Preparation + delivery |

### 3.2 Seif (Sub-task) Base Rewards

| Seif Type | Hebrew | Base Sechar | Rationale |
|---|---|---|---|
| `write` | כתיבה | 15 | Writing sub-task |
| `review` | סקירה | 10 | Review sub-task |
| `research` | מחקר | 20 | Research sub-task |
| `present` | הצגה | 12 | Presentation sub-task |
| `edit` | עריכה | 8 | Editing/proofreading |
| `source_collection` | איסוף מקורות | 10 | Gathering source material |

### 3.3 Peer Review Reward

| Action | Base Sechar |
|---|---|
| Peer review submitted + acknowledged | 10 |

### 3.4 Rank Multiplier Application

The rank multiplier is applied to all task rewards. It reflects that higher-ranked scholars produce higher-quality work and have earned the right to greater compensation.

| Rank | Key | Multiplier |
|---|---|---|
| טוראי | `turai` | 1.0× |
| רב טוראי | `rav_turai` | 1.2× |
| סמל | `samal` | 1.5× |
| סמ"ר | `samal_rishon` | 2.0× |
| רס"מ | `rav_samal` | 2.5× |
| סגן | `segen` | 3.0× |
| סרן | `seren` | 4.0× |
| רב סרן | `rav_seren` | 5.0× |
| סגן אלוף | `sgan_aluf` | 7.0× |
| אלוף | `aluf` | 10.0× |

**Example:** A סמל (Samal, 1.5×) completing a research_paper (100 base) receives `100 × 1.5 = 150 Sechar`.

**Implementation note:** The rank multiplier is applied off-chain when calling `approveChibbur()`. The `reward` parameter passed to the contract is already the final multiplied amount. The contract does not know about rank multipliers — it trusts the caller (who has `APPROVER_ROLE`).

## 4. Supply Controls — Preventing Inflation

### 4.1 Campaign Budget Hard Cap

Every chaburah has a `tokenAllocation` field — the maximum Sechar that can be minted for all chibburim/seifim in that campaign. The `ChibburRewards` contract tracks `tokensUsed` per chaburah. Once `tokensUsed >= tokenAllocation`, further approvals for that chaburah revert.

**Implementation:** Already partially exists via `tokenAllocation`/`tokensUsed` on the `Chaburah` type. Needs enforcement in the approval flow — the backend must check remaining budget before calling `approveChibbur()`.

### 4.2 Monthly Issuance Cap

**Parameter:** `maxMonthlyMint` — stored on-chain in the `GovernanceTreasury` contract.

**Default:** 50,000 Sechar/month.

**Mechanism:** `GovernanceTreasury` tracks cumulative minting per 30-day rolling window. If `mintedThisMonth + newMint > maxMonthlyMint`, the mint call reverts. This cap covers ALL minting (task rewards, donations, governance mints).

**Governance-adjustable:** Proposals can change `maxMonthlyMint`. Requires 66% supermajority.

### 4.3 Treasury Reserve Ratio

**Parameter:** `minReserveRatio` — the minimum percentage of circulating Sechar that must be backed by USD-equivalent reserves in the treasury.

**Default:** 30% (i.e., if 100,000 Sechar are circulating, treasury must hold at least $3,000 equivalent).

**Enforcement:** Redemptions check: `if (treasuryBalance - redemptionAmount < circulatingSupply × redemptionRate × minReserveRatio) → revert`. This prevents a bank run.

**Governance-adjustable:** Proposals can change `minReserveRatio` between 10% and 80%.

### 4.4 Emergency Pause

**Mechanism:** `SecharToken` inherits OpenZeppelin `AccessControl`. The deployer (and governance contract, once deployed) has `DEFAULT_ADMIN_ROLE` which can call `pause()` to freeze all transfers, mints, and burns.

**Who can pause:**
- Deployer wallet (immediate, for emergencies)
- Governance contract (via proposal, for planned actions)

**Who can unpause:**
- Only governance contract (requires proposal + vote). This prevents a single person from unilaterally controlling the token after governance is established.

## 5. Redemption & Circulation

### 5.1 Redemption Path

TMIM → USDC at the current redemption rate ($0.10/TMIM).

**Flow:**
1. Chaver calls `GovernanceTreasury.redeem(amount)` via the Treasury UI
2. Treasury checks:
   - Chaver's Sechar balance ≥ amount
   - Reserve ratio won't drop below minimum
   - Chaver meets eligibility requirements
3. Treasury calls `SecharToken.burn(chaver, amount)` (Treasury has `BURNER_ROLE`)
4. Treasury sends `amount × redemptionRate` USDC to chaver's wallet
5. Events emitted for audit trail

### 5.2 Redemption Eligibility

| Requirement | Value | Rationale |
|---|---|---|
| Minimum rank | רב טוראי (Rav Turai, rank 2+) | New enrollees must demonstrate commitment before cashing out |
| Minimum hold time | 30 days since Sechar was earned | Prevents immediate earn-and-dump. Tracked per mint event, not per token |
| Minimum redemption | 50 Sechar ($5) | Avoid dust transactions / gas waste |
| Maximum per month | 5,000 Sechar ($500) per wallet | Prevents single large withdrawals draining treasury |

**Implementation note:** The "30-day hold time" is the trickiest. Since ERC-20 tokens are fungible, we can't track individual token age. Instead, use a simpler proxy: the chaver's wallet must have held ≥ `amount` Sechar continuously for 30 days. Track `lastMintTimestamp` per wallet on-chain. If `block.timestamp - lastMintTimestamp < 30 days`, limit redeemable amount to `balance - recentlyMinted`.

### 5.3 Non-Redemption Utility (Why Hold Sechar)

TMIM is not just a cash-out token. Holding provides:

1. **Governance voting power:** `votingPower = tmimBalance × rankVotingPower`. More Sechar = more say.
2. **Rank progression:** `totalTokensEarned` (lifetime, including redeemed) determines rank eligibility. Redeeming doesn't reduce your rank or rank progress.
3. **Reputation signal:** Sechar balance displayed on profile signals scholarly productivity.
4. **Campaign access:** Some chaburot may require minimum Sechar balance to enroll (premium research programs).
5. **Peer review priority:** Higher Sechar holders get priority in review assignment queues.

### 5.4 Donor Token Distinction

Donors receive Sechar for their contributions, but "donated-origin" Sechar have different rules:

- **Can vote:** Yes — donors get governance input proportional to their support.
- **Can redeem:** No — donor Sechar cannot be redeemed for USDC. This prevents circular flows (donate $100 → get 1000 Sechar → redeem for $100).
- **Counts for rank:** No — donor Sechar don't count toward `totalTokensEarned` for rank progression.
- **Transferable:** No — Sechar is non-transferable (no `transfer` allowed except mint/burn). This is already enforced by the ERC-20 contract if `_beforeTokenTransfer` restricts transfers to mint/burn only.

**Implementation:** Add an `isDonorToken` mapping or use a separate `donorBalance` tracker in `GovernanceTreasury`. When checking voting power, include donor balance. When checking redemption eligibility, exclude it.

## 6. Donation Economics

### 6.1 Donation Flow

```
Donor → ETH/USDC → GovernanceTreasury
                         ↓
                    Calculate Sechar amount = USD value / $0.10
                         ↓
                    Mint Sechar to donor (donor-flagged)
                         ↓
                    Emit DonationReceived event
                         ↓
                    If earmarked → allocate to specific makom/chaburah
```

### 6.2 Fund Allocation

When a donation is received, the funds are split:

| Allocation | Percentage | Purpose |
|---|---|---|
| **Operational reserve** | 20% | Platform operations, gas costs, infrastructure |
| **Redemption reserve** | 30% | Backs circulating Sechar for future redemptions |
| **Direct rewards pool** | 50% | Available for chaburah token allocations |

**Earmarking:** If a donor specifies a makom or chaburah, the 50% direct rewards allocation is directed to that target. The 20% operational + 30% redemption still go to general reserves.

### 6.3 Conversion Rate

- Donations in ETH: Convert to USD using Chainlink price feed (or manual oracle for simplicity on testnet)
- Donations in USDC: 1:1 USD value
- Sechar minted: `usdValue / 0.10`
- **Example:** $5,000 donation → 50,000 Sechar minted to donor (donor-flagged, non-redeemable)

### 6.4 Donation Receipts

Each donation emits an on-chain event with:
- Donor address
- Amount (in native token)
- USD equivalent
- Sechar minted
- Earmark (makom ID or chaburah ID, bytes32 zero if unearmarked)
- Timestamp

The Firestore backend listens for these events and creates `Donation` records for the UI.

## 7. Long-Term Supply Trajectory — 3-Year Projection

### 7.1 Assumptions

| Parameter | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Active chaverim | 50 | 150 | 400 |
| Masimot completed / month | 80 | 300 | 800 |
| Average Sechar per chibbur (after multiplier) | 50 | 55 | 60 |
| Peer reviews / month | 40 | 200 | 600 |
| Promotions / month | 5 | 15 | 30 |
| Average promotion bonus | 200 | 400 | 600 |
| Donations / month (USD) | $2,000 | $10,000 | $50,000 |

### 7.2 Annual Issuance Projection

| Source | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Task rewards | 48,000 | 198,000 | 576,000 |
| Peer review rewards | 4,800 | 24,000 | 72,000 |
| Promotion bonuses | 12,000 | 72,000 | 216,000 |
| Donation minting | 240,000 | 1,200,000 | 6,000,000 |
| **Total minted** | **304,800** | **1,494,000** | **6,864,000** |

### 7.3 Circulation vs. Reserves

| Metric | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Total minted (cumulative) | 304,800 | 1,798,800 | 8,662,800 |
| Estimated redeemed (20% of earned) | 12,960 | 58,800 | 172,800 |
| Circulating (minted - burned) | 291,840 | 1,740,000 | 8,490,000 |
| Treasury USD reserves | $7,200 | $43,200 | $259,200 |
| Redemption liability (earned Sechar × $0.10) | $6,480 | $29,400 | $86,400 |
| Reserve coverage | 111% | 147% | 300% |

**Key insight:** Because donor Sechar is non-redeemable, the redemption liability only comes from *earned* Sechar (task rewards + reviews + promotions). The 30% redemption reserve from donations builds a large buffer. By Year 3, reserves exceed liability by 3×.

### 7.4 Monthly Issuance Cap Adjustment Schedule

| Period | Recommended `maxMonthlyMint` |
|---|---|
| Launch → 6 months | 50,000 |
| 6–12 months | 100,000 |
| Year 2 | 250,000 |
| Year 3 | 750,000 |

These should be adjusted via governance proposals as the community grows. The default of 50,000 is conservative and appropriate for the launch phase with ~50 chaverim.

---

# Section 2B: Smart Contract Specification

## Existing Contracts (Unchanged)

| Contract | Address | Notes |
|---|---|---|
| SecharToken | `0x1A66...8E5` | ERC-20, 0 decimals. No changes needed. |
| ChayoleiRegistry | `0xFA9D...2fa` | On-chain identity/ranks. No changes needed. |
| ChibburRewards | `0xe4db...20C` | Will receive extension functions (see 2B.3). |
| ChayoleiTreasury | `0x3DB8...420` | Superseded by GovernanceTreasury but not removed. |

## New Contract 1: ChayoleiGovernance.sol

### Overview

A custom governance contract (not using OpenZeppelin Governor — the Governor pattern assumes ERC-20Votes with delegation, which doesn't fit our `balance × rankPower` model). Implements a proposal → vote → timelock → execute pattern.

### Dependencies

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
```

Also interacts with:
- `SecharToken` — read `balanceOf(voter)` for voting weight
- `ChayoleiRegistry` — read `getRank(voter)` for voting power multiplier

### Structs

```solidity
enum ProposalState { Active, Passed, Failed, Queued, Executed, Cancelled }

enum ProposalType {
    MIVTZA_FUNDING,        // Allocate treasury funds to a chaburah
    REDEMPTION_RATE,       // Change the Sechar redemption rate
    EMERGENCY_PAUSE,       // Pause SecharToken
    EMERGENCY_UNPAUSE,     // Unpause SecharToken
    TREASURY_WITHDRAWAL,   // Withdraw funds to external address
    GRANT_ROLE,            // Grant a role on any managed contract
    PARAMETER_UPDATE,      // Update governance parameters (quorum, voting period, etc.)
    MINT_TOKENS,           // Mint Sechar via governance
    MONTHLY_CAP_UPDATE     // Change maxMonthlyMint
}

struct Proposal {
    uint256 id;
    address proposer;
    ProposalType proposalType;
    string title;              // Short title (max 256 chars)
    string description;        // Full description (IPFS hash or on-chain, max 2048 chars)
    bytes callData;            // Encoded function call to execute
    address target;            // Contract to call when executing
    uint256 votesFor;
    uint256 votesAgainst;
    uint256 votesAbstain;
    uint256 snapshotBlock;     // Block number at proposal creation (for balance snapshot)
    uint256 votingStartTime;
    uint256 votingEndTime;
    uint256 executionTime;     // When proposal can be executed (after timelock)
    ProposalState state;
    bool executed;
}

struct Vote {
    uint256 weight;            // Actual voting power used
    uint8 support;             // 0 = against, 1 = for, 2 = abstain
    bool hasVoted;
}
```

### State Variables

```solidity
// Immutable references
SecharToken public immutable tmimToken;
ChayoleiRegistry public immutable registry;

// Governance parameters (governance-adjustable)
uint256 public votingPeriod = 5 days;
uint256 public timelockDelay = 2 days;
uint256 public quorumBps = 1000;           // 10% of circulating supply
uint256 public proposalThresholdTmim = 100; // Min Sechar balance to propose
uint8 public proposalThresholdRank = 5;     // Min rank index to propose (rav_samal = index 4, 0-indexed)
                                             // Meaning: rank 5+ (segen/officer) OR 100+ Sechar. Either qualifies.
uint256 public superMajorityBps = 6600;     // 66% for parameter changes

// Proposal storage
uint256 public proposalCount;
mapping(uint256 => Proposal) public proposals;
mapping(uint256 => mapping(address => Vote)) public votes; // proposalId => voter => Vote

// Rank voting power lookup (mirrors the rank table)
uint256[10] public rankVotingPower = [1, 2, 5, 8, 12, 18, 25, 35, 45, 60];
```

### Events

```solidity
event ProposalCreated(
    uint256 indexed proposalId,
    address indexed proposer,
    ProposalType proposalType,
    string title,
    uint256 votingStartTime,
    uint256 votingEndTime
);

event VoteCast(
    uint256 indexed proposalId,
    address indexed voter,
    uint8 support,
    uint256 weight
);

event ProposalExecuted(uint256 indexed proposalId);
event ProposalCancelled(uint256 indexed proposalId);
event ParameterUpdated(string paramName, uint256 oldValue, uint256 newValue);
```

### Constructor

```solidity
constructor(
    address _tmimToken,          // SecharToken address
    address _registry,           // ChayoleiRegistry address
    address _initialAdmin        // Deployer — gets DEFAULT_ADMIN_ROLE, can be renounced later
)
```

Sets `tmimToken`, `registry`, grants `DEFAULT_ADMIN_ROLE` to `_initialAdmin`.

### Functions

#### `propose()`

```solidity
function propose(
    ProposalType _type,
    string calldata _title,
    string calldata _description,
    address _target,
    bytes calldata _callData
) external returns (uint256 proposalId)
```

**Requirements:**
- Caller must meet EITHER `tmimToken.balanceOf(msg.sender) >= proposalThresholdTmim` OR `registry.getRank(msg.sender) >= proposalThresholdRank`
- `_title.length <= 256`
- `_description.length <= 2048`
- `_target` must be a known contract (SecharToken, Registry, Treasury, or self)

**Behavior:**
1. Increments `proposalCount`
2. Creates `Proposal` struct with `snapshotBlock = block.number`
3. Sets `votingStartTime = block.timestamp` (voting starts immediately)
4. Sets `votingEndTime = block.timestamp + votingPeriod`
5. Sets `state = Active`
6. Emits `ProposalCreated`

**Proposal type → target + callData validation:**

| ProposalType | Expected target | Expected callData signature |
|---|---|---|
| `MIVTZA_FUNDING` | GovernanceTreasury | `allocateChaburahFunding(bytes32,uint256)` |
| `REDEMPTION_RATE` | GovernanceTreasury | `setRedemptionRate(uint256)` |
| `EMERGENCY_PAUSE` | SecharToken | `pause()` |
| `EMERGENCY_UNPAUSE` | SecharToken | `unpause()` |
| `TREASURY_WITHDRAWAL` | GovernanceTreasury | `withdraw(address,uint256)` |
| `GRANT_ROLE` | any managed contract | `grantRole(bytes32,address)` |
| `PARAMETER_UPDATE` | self (governance) | `updateParameter(string,uint256)` |
| `MINT_TOKENS` | SecharToken | `mint(address,uint256,string)` |
| `MONTHLY_CAP_UPDATE` | GovernanceTreasury | `setMaxMonthlyMint(uint256)` |

#### `castVote()`

```solidity
function castVote(uint256 _proposalId, uint8 _support) external
```

**Requirements:**
- `proposals[_proposalId].state == Active`
- `block.timestamp >= votingStartTime && block.timestamp <= votingEndTime`
- `!votes[_proposalId][msg.sender].hasVoted` (no double voting; to change vote, call `changeVote`)
- Voter must be registered in `ChayoleiRegistry`

**Voting power calculation:**
```solidity
uint256 tmimBalance = tmimToken.balanceOf(msg.sender);  // Balance at current block (simplification; for production, use snapshot)
uint8 rank = registry.getRank(msg.sender);
uint256 power = tmimBalance * rankVotingPower[rank];
```

**Behavior:**
1. Calculates voting power
2. Records `Vote{weight: power, support: _support, hasVoted: true}`
3. Adds power to `votesFor`, `votesAgainst`, or `votesAbstain`
4. Emits `VoteCast`

#### `changeVote()`

```solidity
function changeVote(uint256 _proposalId, uint8 _newSupport) external
```

**Requirements:**
- `votes[_proposalId][msg.sender].hasVoted == true`
- Voting period still active

**Behavior:**
1. Subtracts old vote weight from the old support bucket
2. Adds vote weight to new support bucket
3. Updates the Vote record

#### `finalizeProposal()`

```solidity
function finalizeProposal(uint256 _proposalId) external
```

**Requirements:**
- `block.timestamp > votingEndTime`
- `state == Active`

**Quorum check:**
```solidity
uint256 totalVotes = votesFor + votesAgainst + votesAbstain;
uint256 circulatingSupply = tmimToken.totalSupply();
// For quorum, we use raw token supply, not weighted votes
bool quorumMet = (totalVotingTokens >= circulatingSupply * quorumBps / 10000);
```

**Note on quorum:** Quorum is measured by unique Sechar tokens that voted (sum of voters' balances), not by weighted voting power. This prevents a single high-rank officer from meeting quorum alone.

**Pass condition:**
- Simple majority: `votesFor > votesAgainst` (for most proposal types)
- Supermajority (66%): `votesFor * 10000 / (votesFor + votesAgainst) >= superMajorityBps` — required for `PARAMETER_UPDATE`, `MONTHLY_CAP_UPDATE`, `GRANT_ROLE`

**Behavior:**
1. Check quorum
2. Check majority/supermajority based on proposal type
3. If passed: set `state = Queued`, `executionTime = block.timestamp + timelockDelay`
4. If failed: set `state = Failed`

#### `execute()`

```solidity
function execute(uint256 _proposalId) external nonReentrant
```

**Requirements:**
- `state == Queued`
- `block.timestamp >= executionTime`
- `!executed`

**Behavior:**
1. Sets `executed = true`, `state = Executed`
2. Low-level call: `target.call(callData)` — reverts if call fails
3. Emits `ProposalExecuted`

#### `cancelProposal()`

```solidity
function cancelProposal(uint256 _proposalId) external
```

**Requirements:**
- `msg.sender == proposals[_proposalId].proposer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender)`
- `state == Active` (can only cancel before voting ends)

**Behavior:** Sets `state = Cancelled`, emits `ProposalCancelled`.

#### `updateParameter()` (self-call only)

```solidity
function updateParameter(string calldata _paramName, uint256 _newValue) external
```

**Requirements:**
- `msg.sender == address(this)` (only callable via governance execution)

**Supported parameters:**
- `"votingPeriod"` — min 1 day, max 14 days
- `"timelockDelay"` — min 1 day, max 7 days
- `"quorumBps"` — min 500 (5%), max 3000 (30%)
- `"proposalThresholdTmim"` — min 10, max 10000
- `"superMajorityBps"` — min 5100 (51%), max 8000 (80%)

#### View Functions

```solidity
function getProposal(uint256 _proposalId) external view returns (Proposal memory)
function getVote(uint256 _proposalId, address _voter) external view returns (Vote memory)
function getVotingPower(address _voter) external view returns (uint256)
function getProposalState(uint256 _proposalId) external view returns (ProposalState)
function hasVoted(uint256 _proposalId, address _voter) external view returns (bool)
```

### Access Control Roles

| Role | Who Has It | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer (initially), governance contract (after setup) | Emergency admin, role management |
| No custom roles | — | Governance is permissionless (anyone meeting threshold can propose) |

---

## New Contract 2: GovernanceTreasury.sol

### Overview

Upgraded treasury with governance integration, payment streams, donation handling, and redemption logic. **Does not replace** the old `ChayoleiTreasury` — deployed as a new contract. Old treasury funds should be migrated via a one-time transfer.

### Dependencies

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
```

### Structs

```solidity
struct PaymentStream {
    uint256 id;
    address recipient;
    uint256 totalAmount;      // Total USDC to vest
    uint256 claimedAmount;    // USDC already claimed
    uint256 startTime;
    uint256 endTime;          // startTime + durationDays * 1 days
    bool cancelled;
}

struct DonationRecord {
    address donor;
    uint256 ethAmount;        // ETH donated (0 if USDC)
    uint256 usdcAmount;       // USDC donated (0 if ETH)
    uint256 usdValue;         // USD equivalent at time of donation
    uint256 tmimMinted;       // Sechar minted to donor
    bytes32 earmark;          // makomId or chaburahId hash (bytes32(0) if unearmarked)
    uint256 timestamp;
}
```

### State Variables

```solidity
// Immutable references
SecharToken public immutable tmimToken;
IERC20 public immutable usdc;             // USDC contract on Base Sepolia
ChayoleiGovernance public immutable governance;

// Treasury parameters (governance-adjustable)
uint256 public redemptionRateBps = 100;    // 100 bps = $0.01 per bp → $0.10 per Sechar (100 bps × $0.001 = $0.10)
uint256 public minReserveRatioBps = 3000;  // 30%
uint256 public maxMonthlyMint = 50000;     // 50,000 Sechar/month cap
uint256 public largeWithdrawalThreshold = 10000e6; // $10,000 USDC (6 decimals) — requires governance

// Monthly mint tracking
uint256 public currentMonthMinted;
uint256 public currentMonthStart;

// Payment streams
uint256 public streamCount;
mapping(uint256 => PaymentStream) public streams;

// Donation history (on-chain, minimal)
uint256 public totalDonatedUSD;
uint256 public totalTmimMintedForDonors;

// Redemption tracking
mapping(address => uint256) public lastRedemptionMonth;
mapping(address => uint256) public redeemedThisMonth;
mapping(address => uint256) public lastMintTimestamp;  // For hold-time check

// Earmarked funds
mapping(bytes32 => uint256) public earmarkedFunds;  // earmark hash → USDC amount
```

### Events

```solidity
event DonationReceived(
    address indexed donor,
    uint256 usdcAmount,
    uint256 tmimMinted,
    bytes32 earmark
);

event ETHDonationReceived(
    address indexed donor,
    uint256 ethAmount,
    uint256 usdEquivalent,
    uint256 tmimMinted,
    bytes32 earmark
);

event Redeemed(
    address indexed redeemer,
    uint256 tmimBurned,
    uint256 usdcPaid
);

event StreamCreated(
    uint256 indexed streamId,
    address indexed recipient,
    uint256 totalAmount,
    uint256 durationDays
);

event StreamClaimed(uint256 indexed streamId, uint256 amount);
event StreamCancelled(uint256 indexed streamId);
event RedemptionRateUpdated(uint256 oldRate, uint256 newRate);
event ChaburahFunded(bytes32 indexed chaburahId, uint256 amount);
event WithdrawalExecuted(address indexed to, uint256 amount);
```

### Constructor

```solidity
constructor(
    address _tmimToken,
    address _usdc,
    address _governance,
    address _initialAdmin
)
```

Grants `DEFAULT_ADMIN_ROLE` to `_initialAdmin` and `GOVERNANCE_ROLE` to `_governance`.

### Access Control Roles

```solidity
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");   // Day-to-day ops
```

| Role | Who Has It | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer (initially), governance | Role management |
| `GOVERNANCE_ROLE` | ChayoleiGovernance contract | Execute governance decisions |
| `OPERATOR_ROLE` | Deployer / designated operator wallet | Day-to-day operations (small withdrawals, stream management) |

### Donation Functions

#### `donateUSDC()`

```solidity
function donateUSDC(uint256 _amount, bytes32 _earmark) external nonReentrant
```

**Requirements:**
- `_amount > 0`
- Caller has approved this contract to spend `_amount` USDC

**Behavior:**
1. Transfer USDC from donor to this contract
2. Calculate Sechar: `tmimAmount = _amount / (redemptionRateBps * 100)` — with USDC having 6 decimals: `tmimAmount = _amount / (redemptionRateBps * 100)`. At 100 bps and USDC 6 decimals: `1000e6 / (100 * 100) = 1000e6 / 10000 = 100000` ... 

Actually, let's define this more carefully:
- `redemptionRateBps = 100` means 100 basis points
- 1 basis point = 0.01%, so 100 bps = 1%
- But we define the rate as: 1 Sechar = `redemptionRateBps` basis points of $1 = $0.01 × redemptionRateBps / 100 ... 

**Simpler definition:** `redemptionRateUSDC` is stored as the USDC amount (6 decimals) per Sechar.
- `redemptionRateUSDC = 100000` means 1 Sechar = 0.100000 USDC = $0.10
- Sechar minted for donation: `tmimAmount = usdcDonated / redemptionRateUSDC`
- USDC paid for redemption: `usdcPaid = tmimBurned × redemptionRateUSDC`

**Revised: use `redemptionRateUSDC` (uint256, USDC with 6 decimals) instead of BPS.**
- Default: `100000` (= $0.10)
- To change to $0.05: set to `50000`
- To change to $0.20: set to `200000`

3. Check monthly mint cap: `currentMonthMinted + tmimAmount <= maxMonthlyMint`
4. Mint Sechar to donor via `tmimToken.mint(donor, tmimAmount, "donation")`
5. Update `lastMintTimestamp[donor]` (donor tokens are non-redeemable, but track anyway)
6. If `_earmark != bytes32(0)`: add `_amount × 50 / 100` to `earmarkedFunds[_earmark]` (50% direct rewards allocation)
7. Update `totalDonatedUSD`, `totalTmimMintedForDonors`, `currentMonthMinted`
8. Emit `DonationReceived`

#### `donateETH()`

```solidity
function donateETH(bytes32 _earmark) external payable nonReentrant
```

**Behavior:** Same as `donateUSDC` but accepts `msg.value` ETH. For testnet simplicity, use a hardcoded ETH/USD rate or a simple oracle. In production, integrate Chainlink `AggregatorV3Interface`.

For testnet: `uint256 ethPriceUSD = 2000;` (hardcoded, governance-adjustable via `setEthPrice()`).

### Redemption Functions

#### `redeem()`

```solidity
function redeem(uint256 _tmimAmount) external nonReentrant
```

**Requirements:**
1. `_tmimAmount >= 50` (minimum redemption)
2. `tmimToken.balanceOf(msg.sender) >= _tmimAmount`
3. `registry.getRank(msg.sender) >= 1` (rav_turai or above; rank index 1+)
4. Monthly limit: `redeemedThisMonth[msg.sender] + _tmimAmount <= 5000`
5. Hold time: `block.timestamp - lastMintTimestamp[msg.sender] >= 30 days` (simplified check)
6. Reserve ratio check: `usdcBalance() - usdcToSend >= circulatingAfterBurn × redemptionRateUSDC × minReserveRatioBps / 10000`
7. Treasury has sufficient USDC: `usdc.balanceOf(address(this)) >= usdcToSend`

**Behavior:**
1. Calculate `usdcToSend = _tmimAmount × redemptionRateUSDC`
2. All checks pass
3. `tmimToken.burn(msg.sender, _tmimAmount)` (Treasury has `BURNER_ROLE`)
4. `usdc.transfer(msg.sender, usdcToSend)`
5. Update redemption tracking
6. Emit `Redeemed`

### Payment Stream Functions

#### `createStream()`

```solidity
function createStream(
    address _recipient,
    uint256 _totalAmount,     // USDC amount (6 decimals)
    uint256 _durationDays
) external onlyRole(GOVERNANCE_ROLE) returns (uint256 streamId)
```

**Behavior:**
1. Increment `streamCount`
2. Create `PaymentStream` with `startTime = block.timestamp`, `endTime = block.timestamp + _durationDays * 1 days`
3. Emit `StreamCreated`

#### `claimStream()`

```solidity
function claimStream(uint256 _streamId) external nonReentrant
```

**Requirements:**
- `msg.sender == streams[_streamId].recipient`
- `!streams[_streamId].cancelled`

**Behavior:**
1. Calculate vested amount: `vested = totalAmount × (block.timestamp - startTime) / (endTime - startTime)`. Cap at `totalAmount`.
2. Claimable: `vested - claimedAmount`
3. Transfer USDC to recipient
4. Update `claimedAmount`
5. Emit `StreamClaimed`

#### `cancelStream()`

```solidity
function cancelStream(uint256 _streamId) external onlyRole(GOVERNANCE_ROLE)
```

Cancels a stream. Unclaimed vested amount can still be claimed. Unvested amount stays in treasury.

### Governance-Callable Functions

These functions are restricted to `GOVERNANCE_ROLE` (called via proposal execution):

```solidity
function setRedemptionRate(uint256 _newRateUSDC) external onlyRole(GOVERNANCE_ROLE)
function setMinReserveRatio(uint256 _newRatioBps) external onlyRole(GOVERNANCE_ROLE) // 1000-8000
function setMaxMonthlyMint(uint256 _newCap) external onlyRole(GOVERNANCE_ROLE)
function withdraw(address _to, uint256 _amount) external onlyRole(GOVERNANCE_ROLE)  // Large withdrawals
function allocateChaburahFunding(bytes32 _chaburahId, uint256 _amount) external onlyRole(GOVERNANCE_ROLE)
```

#### `withdraw()`

For amounts above `largeWithdrawalThreshold`: only `GOVERNANCE_ROLE` (requires proposal + vote + timelock).

For amounts below threshold: `OPERATOR_ROLE` can call `withdrawSmall(address _to, uint256 _amount)`.

### View Functions

```solidity
function usdcBalance() public view returns (uint256)
function ethBalance() public view returns (uint256)
function reserveRatio() public view returns (uint256)  // Returns current ratio in BPS
function claimableAmount(uint256 _streamId) public view returns (uint256)
function getStream(uint256 _streamId) public view returns (PaymentStream memory)
function getRedemptionQuote(uint256 _tmimAmount) public view returns (uint256 usdcAmount, bool eligible, string memory reason)
```

---

## Extend ChibburRewards.sol (2B.3)

Add the following functions to the existing deployed contract. Since the contract is already deployed and likely not upgradeable, these should be added as a **new companion contract** `ChibburRewardsV2.sol` that wraps the existing one, OR deployed as a new contract if the existing one can be deprecated.

**Recommended approach:** Deploy `ChibburRewardsV2.sol` as a new contract with the same `MINTER_ROLE` + `APPROVER_ROLE` setup, and deprecate the original by revoking its roles after migration.

### New Functions

```solidity
/// @notice Approve a chibbur with a memo for richer event data
function approveWithMemo(
    bytes32 _chibburIdHash,
    address _assignee,
    uint256 _reward,
    string calldata _memo
) external onlyRole(APPROVER_ROLE) {
    require(!isChibburApproved(_chibburIdHash), "Already approved");
    chibburApproved[_chibburIdHash] = true;
    tmimToken.mint(_assignee, _reward, _memo);
    totalRewardsDistributed += _reward;
    emit RewardDistributed(_chibburIdHash, _assignee, _reward, _memo, block.timestamp);
}

/// @notice Batch approve multiple chibburim/seifim in a single transaction
function batchApprove(
    bytes32[] calldata _ids,
    address[] calldata _assignees,
    uint256[] calldata _rewards
) external onlyRole(APPROVER_ROLE) {
    require(_ids.length == _assignees.length && _ids.length == _rewards.length, "Length mismatch");
    require(_ids.length <= 50, "Batch too large");  // Gas limit safety

    for (uint256 i = 0; i < _ids.length; i++) {
        require(!isChibburApproved(_ids[i]), "Already approved");
        chibburApproved[_ids[i]] = true;
        tmimToken.mint(_assignees[i], _rewards[i], "batch_approval");
        totalRewardsDistributed += _rewards[i];
        emit RewardDistributed(_ids[i], _assignees[i], _rewards[i], "batch_approval", block.timestamp);
    }
}
```

### New Event

```solidity
event RewardDistributed(
    bytes32 indexed id,
    address indexed assignee,
    uint256 reward,
    string memo,
    uint256 blockTimestamp
);
```

---

## Deployment & Upgrade Path (2B.4)

### Prerequisites

1. Fix redemption rate: `SecharToken.setRedemptionRate(100)` from deployer wallet (if using the old BPS model) — OR if we've moved to `redemptionRateUSDC` in GovernanceTreasury, this becomes moot for the new contract.

### Deployment Sequence

**Step 1: Deploy ChayoleiGovernance.sol**

```javascript
const governance = await ChayoleiGovernance.deploy(
    "0x1A66CeE19C53956022f01842043d79d594BFb8E5",  // SecharToken
    "0xFA9Da3852829B3Fd94F05cFd7C160127980242fa",  // ChayoleiRegistry
    "0x41521c37dB02956185437C4e2461261A321073E1"   // deployer as initial admin
);
```

**Step 2: Deploy GovernanceTreasury.sol**

```javascript
const USDC_BASE_SEPOLIA = "0x...";  // USDC address on Base Sepolia (find or deploy mock)

const treasury = await GovernanceTreasury.deploy(
    "0x1A66CeE19C53956022f01842043d79d594BFb8E5",  // SecharToken
    USDC_BASE_SEPOLIA,                                // USDC
    governance.address,                                // ChayoleiGovernance
    "0x41521c37dB02956185437C4e2461261A321073E1"     // deployer as initial admin
);
```

**Step 3: Deploy ChibburRewardsV2.sol**

```javascript
const rewardsV2 = await ChibburRewardsV2.deploy(
    "0x1A66CeE19C53956022f01842043d79d594BFb8E5",  // SecharToken
    "0x41521c37dB02956185437C4e2461261A321073E1"   // deployer as initial approver
);
```

**Step 4: Grant Roles on SecharToken**

```javascript
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

// Governance can mint (for governance mint proposals)
await tmimToken.grantRole(MINTER_ROLE, governance.address);

// New treasury can mint (for donations) and burn (for redemptions)
await tmimToken.grantRole(MINTER_ROLE, treasury.address);
await tmimToken.grantRole(BURNER_ROLE, treasury.address);

// New rewards contract can mint
await tmimToken.grantRole(MINTER_ROLE, rewardsV2.address);
```

**Step 5: Grant Roles on ChayoleiRegistry**

```javascript
const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));

// If registry has a GOVERNANCE_ROLE for governance-triggered promotions:
await registry.grantRole(GOVERNANCE_ROLE, governance.address);
```

**Step 6: Revoke Old Roles (Optional, after migration)**

```javascript
// Revoke MINTER_ROLE from old ChibburRewards (original)
await tmimToken.revokeRole(MINTER_ROLE, "0xe4db2dD3fb79F92dCf2FFd856B4d18F83333b20C");

// Revoke MINTER_ROLE + BURNER_ROLE from old ChayoleiTreasury
await tmimToken.revokeRole(MINTER_ROLE, "0x3DB8a8A81f75eA2bAbDb481203AE4Db6C4dDA420");
await tmimToken.revokeRole(BURNER_ROLE, "0x3DB8a8A81f75eA2bAbDb481203AE4Db6C4dDA420");
```

**Step 7: Transfer Funds**

Transfer any ETH held by old ChayoleiTreasury to new GovernanceTreasury. This may require calling a withdrawal function on the old contract if it has one, or via deployer admin action.

**Step 8: Grant Governance its own admin** 

```javascript
// Let governance manage itself
await governance.grantRole(DEFAULT_ADMIN_ROLE, governance.address);

// Eventually, deployer renounces admin (after governance is proven stable):
// await governance.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
```

### Post-Deployment Verification Checklist

1. `tmimToken.hasRole(MINTER_ROLE, governance.address)` → true
2. `tmimToken.hasRole(MINTER_ROLE, treasury.address)` → true
3. `tmimToken.hasRole(BURNER_ROLE, treasury.address)` → true
4. `tmimToken.hasRole(MINTER_ROLE, rewardsV2.address)` → true
5. `governance.tmimToken()` → SecharToken address
6. `governance.registry()` → ChayoleiRegistry address
7. `treasury.tmimToken()` → SecharToken address
8. `treasury.governance()` → ChayoleiGovernance address
9. Test: Create a proposal, vote, wait, execute → verify it works end-to-end
10. Test: Donate USDC → verify Sechar minted to donor
11. Test: Approve chibbur via V2 → verify Sechar minted to assignee

---

# Section 2C: DAO UI Specification

All UI uses the academic theme from Spec 1. Components reference Spec 1 color tokens, typography, and design principles.

## New TypeScript Types

Add these to the existing types file (likely `src/lib/types/`):

```typescript
// Governance types

type ProposalState = 'active' | 'passed' | 'failed' | 'queued' | 'executed' | 'cancelled';

type ProposalType =
  | 'chaburah_funding'
  | 'redemption_rate'
  | 'emergency_pause'
  | 'emergency_unpause'
  | 'treasury_withdrawal'
  | 'grant_role'
  | 'parameter_update'
  | 'mint_tokens'
  | 'monthly_cap_update';

interface Proposal {
  id: string;                   // On-chain proposal ID as string
  proposer: string;             // Wallet address
  proposerChaver?: Chaver;      // Resolved chaver (from Firestore)
  type: ProposalType;
  title: string;
  description: string;
  target: string;               // Target contract address
  callData: string;             // Hex-encoded calldata
  callDataDecoded?: string;     // Human-readable description of what this does
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  snapshotBlock: number;
  votingStartTime: string;      // ISO timestamp
  votingEndTime: string;        // ISO timestamp
  executionTime?: string;       // ISO timestamp (set after passing)
  state: ProposalState;
  executed: boolean;
  quorumReached: boolean;
  quorumRequired: number;       // Number of tokens needed for quorum
  totalVotingTokens: number;    // Sum of voter balances (for quorum check)
  myVote?: 'for' | 'against' | 'abstain' | null;  // Current user's vote
}

interface VotingPower {
  tmimBalance: number;
  rankKey: string;
  rankVotingMultiplier: number;
  totalPower: number;           // tmimBalance × rankVotingMultiplier
  delegatedTo?: string;         // Wallet address if delegated
  delegatedFrom: string[];      // Wallets that delegated to this user
}

interface PaymentStream {
  id: string;
  recipient: string;
  recipientChaver?: Chaver;
  totalAmount: number;          // USDC (display as dollars)
  claimedAmount: number;
  startTime: string;
  endTime: string;
  cancelled: boolean;
  claimable: number;            // Currently claimable USDC
}

interface TreasuryStats {
  totalDonatedUSD: number;
  tmimCirculating: number;
  tmimTotalMinted: number;
  usdcBalance: number;
  ethBalance: number;
  reserveRatio: number;         // Percentage (e.g., 35.2)
  redemptionRate: number;       // USD per Sechar (e.g., 0.10)
  maxMonthlyMint: number;
  currentMonthMinted: number;
}

interface DonationForm {
  amount: number;
  currency: 'ETH' | 'USDC';
  earmarkType: 'none' | 'makom' | 'chaburah';
  earmarkId?: string;
  message?: string;
}

interface RedemptionForm {
  tmimAmount: number;
  usdcReceived: number;         // Calculated: tmimAmount × redemptionRate
  eligible: boolean;
  ineligibleReason?: string;
}
```

## New Route: `/governance` — Main Governance Page

### Route: `/governance/+page.svelte`

**Page title:** ממשל (Governance)

**Layout:** Three tabs using a horizontal tab bar below the page header.

#### Tab 1: הצעות פעילות (Active Proposals)

**Content:** Grid of `ProposalCard` components, 1 column on mobile, 2 on desktop.

**Empty state:** "אין הצעות פעילות כרגע" (No active proposals at this time). EmptyState component with scroll icon.

**Sort:** By voting end time (soonest-ending first).

**Auto-refresh:** Poll every 30 seconds for new proposals and vote count updates. Use Firestore `onSnapshot` listener on a `proposals` collection (synced from on-chain events by backend).

#### Tab 2: היסטוריה (Past Proposals)

**Content:** Table with columns:
- # (proposal ID)
- Title
- Type (badge)
- Proposer (name + rank badge)
- Result (Passed/Failed/Executed — status badge)
- Votes (For/Against as fraction, e.g., "1,234 / 456")
- Date (voting end date)

**Filters:** Dropdown for state (passed/failed/executed/cancelled). Search by title.

**Pagination:** 20 per page, load-more button at bottom.

#### Tab 3: הצעה חדשה (Create Proposal)

**Visibility:** Only shown to users who meet proposal threshold (officer rank OR 100+ Sechar). For others, show a message: "נדרשת דרגת סגן או 100 Sechar לפחות" (Requires Lieutenant rank or at least 100 Sechar).

**Form fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| סוג הצעה (Proposal Type) | Select dropdown | Yes | Options: all ProposalType values with Hebrew labels |
| כותרת (Title) | Text input | Yes | Max 256 chars |
| תיאור (Description) | Textarea | Yes | Max 2048 chars |
| פרטי ביצוע (Execution Details) | Dynamic fields | Yes | Changes based on proposal type (see below) |

**Dynamic fields by proposal type:**

| Proposal Type | Dynamic Fields |
|---|---|
| `chaburah_funding` | Chaburah selector (dropdown of active chaburot) + USDC amount input |
| `redemption_rate` | New rate input (number, in USD, e.g., "0.05") |
| `emergency_pause` | None — just confirmation text |
| `emergency_unpause` | None — just confirmation text |
| `treasury_withdrawal` | Recipient address input + USDC amount input |
| `grant_role` | Contract selector + Role selector + Address input |
| `parameter_update` | Parameter name selector + New value input |
| `mint_tokens` | Recipient address input + Amount input + Reason text |
| `monthly_cap_update` | New cap input (number) |

**Preview section:** Below the form, show a human-readable preview: "הצעה זו תבצע: שינוי שער המרה ל-$0.05 לכל Sechar" (This proposal will: change redemption rate to $0.05 per Sechar).

**Submit flow:**
1. User fills form → clicks "הגש הצעה" (Submit Proposal)
2. `ConfirmDialog`: "Are you sure? This will create an on-chain transaction."
3. User confirms → wallet signature request → transaction sent
4. Loading state while transaction confirms
5. Success toast: "ההצעה נוצרה בהצלחה" (Proposal created successfully) with link to proposal detail
6. Redirect to proposal detail page

**Error cases:**
- Wallet not connected → show "Connect Wallet" prompt
- Insufficient Sechar/rank → show eligibility message (should already be hidden, but guard anyway)
- Transaction rejected → toast with "העסקה נדחתה" (Transaction rejected)
- Transaction failed → toast with error message

## New Route: `/governance/[id]` — Proposal Detail

### Route: `/governance/[id]/+page.svelte`

**Page title:** Dynamic — proposal title

**Layout:**

**Header section:**
- Proposal title (`--text-h1`)
- Status badge (large)
- Proposer: avatar + name + rank badge
- Type badge
- Timestamps: "Voting started: [date] | Voting ends: [date] | Execution available: [date]"

**Voting progress section (prominent, centered):**
Three horizontal progress bars stacked:
- "בעד" (For): `--color-status-success` fill, vote count + percentage on right
- "נגד" (Against): `--color-status-error` fill, vote count + percentage on right
- "נמנע" (Abstain): `--color-status-draft` fill, vote count + percentage on right

Quorum indicator below bars:
- Bar showing total voting tokens vs. quorum threshold
- Text: "X / Y tokens voted (Z% quorum, Q% required)"
- If quorum not met: bar in `--color-status-warning`, text noting deficit

**Description section:**
- Full description text, generously typeset
- Calldata preview: Card with `--color-bg-tertiary` background showing human-readable decoded action: "הצעה זו תבצע: [action description]" (This proposal will execute: [action])

**Voting breakdown section:**
- Aggregated by rank tier (NOT individual votes — privacy):
  - "Officers: X for, Y against, Z abstain"
  - "NCOs: X for, Y against, Z abstain"
  - "Enlisted: X for, Y against, Z abstain"
- Total unique voters count

**Vote action section (if proposal is active):**
- Three buttons in a row: "בעד" (For), "נגד" (Against), "נמנע" (Abstain)
- Styled: For = `--color-status-success` bg, Against = `--color-status-error` bg, Abstain = `--color-bg-tertiary` bg with `--color-text-secondary` text
- If already voted: show current vote highlighted, other buttons dimmed, "שנה הצבעה" (Change vote) link
- Below buttons: "כוח ההצבעה שלך: Z" (Your voting power: Z) — links to VotingPower breakdown

**Execution section (if state = queued and timelock elapsed):**
- Prominent button: "בצע הצעה" (Execute Proposal)
- Text: "ניתן לביצוע מ-[date]. כל אחד יכול לבצע הצעה שעברה." (Executable from [date]. Anyone can execute a passed proposal.)
- After execution: button changes to "בוצע" (Executed) with checkmark, disabled

**Vote flow:**
1. User clicks For/Against/Abstain
2. `ConfirmDialog`: "Cast vote [For/Against/Abstain] with Z voting power?"
3. Confirm → wallet transaction
4. Loading → success toast → UI updates with new vote totals
5. If changing vote: "Change vote from [old] to [new]?" confirmation

**Execute flow:**
1. User clicks "Execute"
2. `ConfirmDialog` showing exactly what will happen (decoded calldata)
3. Confirm → wallet transaction
4. Loading → success/error toast
5. On success: proposal state updates to "Executed"

## Enhanced Route: `/treasury` — Treasury Page

### Route: `/treasury/+page.svelte`

Enhance the existing treasury page with new sections. Keep all existing content (stats, donation history) and add:

**Layout: 4 sections**

#### Section 1: סטטיסטיקות האוצר (Treasury Statistics)

`TreasuryStats` component (see below). Positioned at top of page.

#### Section 2: תרומה (Donate)

Card with donation form:
- Currency toggle: ETH / USDC (two buttons, selected state)
- Amount input (number field)
- Earmark section (optional, collapsible):
  - Radio: "ללא ייעוד" (No earmark) / "למקום" (To location) / "למבצע" (To campaign)
  - If location: dropdown of makom options
  - If campaign: dropdown of active chaburot
- Message textarea (optional)
- Preview: "תרומה של $X → Y Sechar יונפקו לארנקך" (Donation of $X → Y Sechar will be minted to your wallet)
- Submit button: "תרום" (Donate)

**Donation flow:**
1. User fills amount, optional earmark
2. Preview updates in real-time
3. Click "Donate" → ConfirmDialog: "Donate X USDC? You will receive Y Sechar (non-redeemable donor tokens)."
4. Confirm → wallet approval for USDC transfer → transaction
5. Success toast with Sechar amount

#### Section 3: פדיון (Redemption)

Card with redemption form:
- Sechar amount input
- Real-time calculation: "X Sechar = $Y USDC"
- Eligibility check display:
  - Green checkmark if eligible
  - Red X with reason if not (e.g., "Minimum rank: רב טוראי", "30-day hold requirement not met", "Monthly limit reached: X/5000")
- Available balance shown: "יתרת Sechar: Z" (TMIM balance: Z)
- Submit button: "פדה" (Redeem) — disabled if ineligible

**Redemption flow:**
1. User enters amount → eligibility checked in real-time (call `getRedemptionQuote` view function)
2. Click "Redeem" → ConfirmDialog: "Redeem X Sechar for $Y USDC? This burns your tokens permanently."
3. Confirm → wallet transaction (burn + transfer)
4. Success toast with USDC amount received

#### Section 4: זרמי תשלום (Payment Streams)

Table of payment streams relevant to the current user:
- Columns: Purpose (from stream description), Total, Claimed, Claimable Now, End Date, Status
- "Claim" button on each row where claimable > 0
- Empty state if no streams: "אין זרמי תשלום פעילים" (No active payment streams)

#### Section 5: היסטוריה (History) — existing

Keep the existing donation history table. Add a tab or toggle to switch between:
- Donations (existing)
- Redemptions (new — list of user's past redemptions)

#### Section 6: פרמטרים (Parameters) — governance-controlled display

Read-only card showing current governance parameters:

| Parameter | Current Value | Last Changed |
|---|---|---|
| שער פדיון (Redemption rate) | $0.10 / Sechar | [date] |
| יחס רזרבה מינימלי (Min reserve ratio) | 30% | [date] |
| תקרת הנפקה חודשית (Monthly mint cap) | 50,000 Sechar | [date] |

Small link: "שנה באמצעות הצעת ממשל" (Change via governance proposal) → links to `/governance` tab 3.

## New Components

### `ProposalCard.svelte`

**Props:**
```typescript
interface ProposalCardProps {
  proposal: Proposal;
  compact?: boolean;   // true for dashboard widget, false for governance page
}
```

**Visual states:**

| State | Border-left color | Status badge | Special treatment |
|---|---|---|---|
| `active` | `--color-accent-primary` | Blue "פעילה" (Active) | Voting bars animated (subtle), countdown timer to voting end |
| `passed` | `--color-status-success` | Green "אושרה" (Passed) | — |
| `failed` | `--color-status-error` | Red "נדחתה" (Failed) | — |
| `queued` | `--color-status-warning` | Amber "בהמתנה" (Queued) | Countdown to execution availability |
| `executed` | `--color-status-success` | Green "בוצעה" (Executed) | Checkmark icon |
| `cancelled` | `--color-status-draft` | Gray "בוטלה" (Cancelled) | Strikethrough title |

**Card structure:**
- Background: `--color-bg-secondary`, `1px solid --color-border-primary`, `border-radius: 8px`
- Left border (right in visual LTR, it's the leading edge in RTL): `4px solid [state color]`
- Top row: Title (`--text-h3`) + State badge (top-left in RTL)
- Second row: Type badge + Proposer name + rank badge
- Voting bars: Three thin horizontal bars (For/Against/Abstain) with percentage labels
- Bottom row: Voting end time ("Ends in X hours" or "Ended [date]") + "Your vote: [badge]" if voted + quorum indicator (small text: "Quorum: X%")
- Click handler: navigates to `/governance/[id]`

**Compact mode** (for dashboard widget):
- Smaller: no voting bars, just title + status + end time
- Single line layout

### `VotingPower.svelte`

**Props:**
```typescript
interface VotingPowerProps {
  votingPower: VotingPower;
  size?: 'sm' | 'md' | 'lg';   // sm = inline badge, md = card, lg = full breakdown
}
```

**Size `sm`** (inline, for sidebar/topbar):
- Single line: "כוח הצבעה: 1,500" (Voting power: 1,500)
- Font: `--text-caption`, `--color-text-secondary`

**Size `md`** (card, for dashboard widget):
- Card with `--color-bg-secondary`
- Title: "כוח ההצבעה שלך" (Your Voting Power)
- Large number: total power (`--text-h2`, `--color-accent-primary`)
- Breakdown line: "X Sechar × Y (דרגת [rank]) = Z" (X Sechar × Y ([rank] rank) = Z)
- Font: `--text-body`

**Size `lg`** (full, for governance page):
- Everything in `md` plus:
- Delegation info: "הועבר ל-[name]" (Delegated to [name]) or "מקבל הצבעות מ-[count] חיילים" (Receiving votes from [count] soldiers)
- Rank insignia (48px) next to the breakdown

### `TreasuryStats.svelte`

**Props:**
```typescript
interface TreasuryStatsProps {
  stats: TreasuryStats;
}
```

**Layout:** Row of 4 stat cards (responsive: 2×2 on mobile, 4×1 on desktop).

**Card 1: Treasury Balance**
- Icon: Small vault/safe SVG, `--color-accent-secondary`
- Large number: USD formatted treasury balance (`--text-h2`)
- Subtitle: "USDC + ETH equivalent" (`--text-caption`)

**Card 2: Sechar Circulating**
- Icon: Sechar menorah icon, `--color-accent-secondary`
- Large number: circulating Sechar (`--text-h2`)
- Subtitle: "מתוך X הונפקו" (of X total minted) (`--text-caption`)

**Card 3: Reserve Ratio**
- Circular gauge or horizontal bar showing ratio percentage
- Gauge colors: `--color-status-success` if above 30%, `--color-status-warning` if 20-30%, `--color-status-error` if below 20%
- Large number: "35.2%" (`--text-h2`)
- Subtitle: "יחס רזרבה (מינימום: 30%)" (Reserve ratio (minimum: 30%)) (`--text-caption`)

**Card 4: Monthly Minting**
- Progress bar: `currentMonthMinted / maxMonthlyMint`
- Large number: "X / Y Sechar" (`--text-h2`)
- Subtitle: "הנפקה חודשית" (Monthly minting) (`--text-caption`)
- Color: `--color-accent-primary` if under 80%, `--color-status-warning` if 80-95%, `--color-status-error` if over 95%

## Governance Flow UX Narratives

### Flow 1: Create and Pass a "Change Redemption Rate" Proposal

**Actors:** Sarah (סרן / Captain, 25,000 Sechar)

1. Sarah navigates to `/governance` → "הצעה חדשה" tab
2. Selects type: "שינוי שער פדיון" (Redemption Rate Change)
3. Enters title: "הפחתת שער הפדיון ל-$0.05"
4. Enters description explaining rationale
5. Dynamic field appears: "שער חדש ($)" → enters "0.05"
6. Preview shows: "הצעה זו תבצע: שינוי שער הפדיון מ-$0.10 ל-$0.05 לכל Sechar"
7. Clicks "הגש הצעה" → `ConfirmDialog` → confirms
8. **Loading state:** Spinner with "שולח עסקה..." (Sending transaction...)
9. Wallet popup → Sarah signs → transaction pending
10. **Loading state:** "ממתין לאישור..." (Waiting for confirmation...)
11. Transaction confirmed → **Success toast:** "ההצעה נוצרה (#42)" → redirect to `/governance/42`
12. Proposal detail page shows: Active state, 5-day voting period countdown, empty vote bars
13. Other chaverim receive notification (via Firestore listener) that a new proposal exists
14. Over 5 days, votes accumulate. Vote bars animate on each refresh.
15. Voting period ends → anyone calls `finalizeProposal` (or backend auto-calls)
16. If passed: State changes to "Queued" → 2-day timelock countdown shown
17. After timelock: "Execute" button appears → anyone clicks → transaction → rate changed
18. **Error case:** If transaction fails during execution, toast: "הביצוע נכשל: [error]" with retry button

### Flow 2: Cast a Vote

**Actor:** David (סמל / Sergeant, 1,200 Sechar, voting power = 1,200 × 5 = 6,000)

1. David sees active proposal on dashboard widget → clicks → arrives at `/governance/42`
2. Reads description, sees current vote tallies
3. Scrolls to vote section → sees three buttons: בעד / נגד / נמנע
4. Below buttons: "כוח ההצבעה שלך: 6,000 (1,200 Sechar × 5 דרגת סמל)"
5. Clicks "בעד" (For)
6. `ConfirmDialog`: "הצבע בעד הצעה #42 עם 6,000 כוח הצבעה?" (Vote For proposal #42 with 6,000 voting power?)
7. Confirms → wallet signature → transaction
8. **Loading:** Vote button shows spinner
9. Success → button changes to highlighted state, "הצבעתך: בעד" (Your vote: For) displayed
10. Vote bars update with his contribution
11. **Change vote:** Later, David wants to change. Clicks "שנה הצבעה" → sees three buttons again → selects "נגד" → confirm → transaction
12. **Error case:** Wallet disconnected → toast: "חבר ארנק להצבעה" (Connect wallet to vote)
13. **Error case:** Voting period ended → buttons disabled, message: "תקופת ההצבעה הסתיימה" (Voting period has ended)

### Flow 3: Donate to Treasury

**Actor:** Rabbi Goldstein (external donor, not a chaver, has wallet)

1. Navigates to `/treasury`
2. Scrolls to donation section
3. Selects USDC, enters 5000
4. Opens earmark section → selects "למבצע" → selects "Talmud Bavli Research" from dropdown
5. Preview: "תרומה של $5,000 → 50,000 Sechar יונפקו לארנקך (אסימוני תורם — לא ניתנים לפדיון)" (Donation of $5,000 → 50,000 Sechar will be minted to your wallet (donor tokens — non-redeemable))
6. Clicks "תרום" (Donate)
7. `ConfirmDialog`: "Approve USDC transfer of $5,000 to Chayolei Treasury? You will receive 50,000 Sechar donor tokens (voting rights, non-redeemable)."
8. Confirms → two wallet prompts: (a) approve USDC spending, (b) confirm donation transaction
9. **Loading:** "מעבד תרומה..." (Processing donation...)
10. Success → toast: "תודה רבה! 50,000 Sechar הונפקו לארנקך" (Thank you! 50,000 Sechar minted to your wallet)
11. Treasury stats update in real-time
12. **Error case:** Insufficient USDC → toast: "אין מספיק USDC בארנק" (Insufficient USDC in wallet)
13. **Error case:** Monthly mint cap reached → toast: "תקרת ההנפקה החודשית הושגה" (Monthly mint cap reached)

### Flow 4: Redeem Sechar

**Actor:** Moshe (רס"מ / Master Sergeant, 8,000 Sechar, rank 4)

1. Navigates to `/treasury` → scrolls to redemption section
2. Available balance shown: "יתרת Sechar: 8,000"
3. Enters 500 in the amount field
4. Real-time calculation: "500 Sechar = $50.00 USDC"
5. Eligibility checks all show green:
   - Rank: רס"מ ✓
   - Hold time: 45 days ✓
   - Monthly limit: 0/5,000 ✓
   - Reserve ratio after: 33.1% ✓
6. Clicks "פדה" (Redeem)
7. `ConfirmDialog`: "Burn 500 Sechar and receive $50.00 USDC? This action is irreversible."
8. Confirms → wallet transaction
9. **Loading:** "מעבד פדיון..." (Processing redemption...)
10. Success → toast: "$50.00 USDC הועברו לארנקך" ($50.00 USDC transferred to your wallet)
11. Token balance updates, treasury stats update
12. **Error case — ineligible:** Red indicators show which requirement is not met. Button disabled. Example: "Hold time: 12 days of 30 required ✗"

## Integration with Existing Pages

### Dashboard (`/` — בית המדרש)

**Add: Governance summary widget**

Position: Below the "My chibburim" section, above the activity feed.

Card contents:
- Title: "ממשל" (Governance) with small link "הכל →" (See all →) to `/governance`
- Active proposals count: "3 הצעות פעילות" (3 active proposals)
- If user has unvoted active proposals: "2 הצעות ממתינות להצבעתך" (2 proposals awaiting your vote) in `--color-status-warning`
- Compact `ProposalCard` for the most urgent (soonest-ending) proposal
- `VotingPower` component in `sm` size

### Chaver Profile (`/anash/[id]`)

**Add: Voting History tab**

New tab alongside existing tabs: "היסטוריית הצבעות" (Voting History)

Table contents:
- Proposal # + title (linked)
- Vote cast (For/Against/Abstain badge)
- Voting power used
- Proposal result (Passed/Failed badge)
- Date

Note: Only show voting history for the currently viewed profile. If viewing someone else's profile, aggregate data only: "Voted on X proposals" without revealing specific votes — privacy consideration.

**Updated implementation:** On your own profile, full table. On others' profiles: summary card only: "השתתף ב-X הצבעות" (Participated in X votes) + "אחוז השתתפות: Y%" (Participation rate: Y%).

### Settings (`/settings` — הגדרות)

**Add: Delegation section**

New section below profile edit:

Title: "הצבעה — האצלת סמכויות" (Voting — Delegation)

- Current status: "כוח ההצבעה שלך פעיל" (Your voting power is active) or "מואצל ל-[name]" (Delegated to [name])
- Delegate button: "האצל כוח הצבעה" (Delegate voting power)
- On click: text input for wallet address or dropdown of known chaverim
- Confirm → on-chain transaction (delegation is an on-chain action)
- Revoke button: "בטל האצלה" (Revoke delegation)

**Note on delegation implementation:** Delegation is a stretch goal. The `ChayoleiGovernance` contract as specified above does not include delegation. If delegation is desired:
- Add `mapping(address => address) public delegation` to governance contract
- `delegateVotingPower(address _to)` function
- `castVote()` checks if voter has delegation from others and adds their power
- For MVP: skip delegation, show "בקרוב" (Coming soon) on the delegation section

## AppStore Updates

Add to the existing `AppStore` class in `$stores/app.svelte.ts`:

```typescript
// New state arrays for governance
proposals = $state<Proposal[]>([]);
paymentStreams = $state<PaymentStream[]>([]);
treasuryStats = $state<TreasuryStats | null>(null);

// Derived
activeProposals = $derived(this.proposals.filter(p => p.state === 'active'));
myUnvotedProposals = $derived(
  this.activeProposals.filter(p => p.myVote === null)
);
myVotingPower = $derived<VotingPower>(() => {
  const me = this.activeChaver;
  if (!me) return { tmimBalance: 0, rankKey: 'turai', rankVotingMultiplier: 1, totalPower: 0, delegatedFrom: [] };
  const multiplier = RANK_VOTING_POWER[me.rank];
  return {
    tmimBalance: me.tokenBalance,
    rankKey: me.rank,
    rankVotingMultiplier: multiplier,
    totalPower: me.tokenBalance * multiplier,
    delegatedFrom: []
  };
});
```

## Sidebar Navigation Update

Add governance link to sidebar nav:

```
... existing links ...
פארבריינגען  →  /farbrengen
ממשל         →  /governance     ← NEW
אוצר         →  /treasury
הגדרות       →  /settings
```

Icon for governance nav item: A small ballot box or scales of justice SVG.

If there are unvoted active proposals, show a small notification dot (8px, `--color-status-warning`) on the governance nav item.

---

## Mock Data for Development

Add to the existing mock data system:

### Mock Proposals (4)

```typescript
const MOCK_PROPOSALS: Proposal[] = [
  {
    id: '1',
    proposer: '0x...',
    proposerChaver: /* reference to mock chaver (officer) */,
    type: 'redemption_rate',
    title: 'הפחתת שער הפדיון ל-$0.05',
    description: 'בהתחשב בגידול מהיר בהיצע ה-TMIM ובצורך לשמור על יציבות האוצר, מוצע להפחית את שער הפדיון מ-$0.10 ל-$0.05 לכל Sechar. צעד זה יאפשר לנו לתמוך ביותר תלמידים תוך שמירה על יחס רזרבה בריא.',
    target: '0x...',   // GovernanceTreasury address
    callData: '0x...',
    callDataDecoded: 'שינוי שער הפדיון מ-$0.10 ל-$0.05',
    votesFor: 45000,
    votesAgainst: 12000,
    votesAbstain: 3000,
    snapshotBlock: 100000,
    votingStartTime: '2026-04-10T10:00:00Z',
    votingEndTime: '2026-04-15T10:00:00Z',
    state: 'active',
    executed: false,
    quorumReached: true,
    quorumRequired: 10000,
    totalVotingTokens: 8500,
    myVote: null
  },
  {
    id: '2',
    proposer: '0x...',
    type: 'chaburah_funding',
    title: 'הקצאת 5,000 Sechar למבצע תלמוד בבלי',
    description: 'הקצאת תקציב נוסף למבצע המחקר בתלמוד בבלי, מסכת בבא מציעא. התקציב הנוכחי אזל ו-12 משימות ממתינות למימון.',
    target: '0x...',
    callData: '0x...',
    callDataDecoded: 'הקצאת 5,000 Sechar למבצע "מחקר בבא מציעא"',
    votesFor: 78000,
    votesAgainst: 5000,
    votesAbstain: 1000,
    snapshotBlock: 99500,
    votingStartTime: '2026-04-05T08:00:00Z',
    votingEndTime: '2026-04-10T08:00:00Z',
    executionTime: '2026-04-12T08:00:00Z',
    state: 'queued',
    executed: false,
    quorumReached: true,
    quorumRequired: 10000,
    totalVotingTokens: 12000,
    myVote: 'for'
  },
  {
    id: '3',
    proposer: '0x...',
    type: 'mint_tokens',
    title: 'מענק מיוחד לזוכי התחרות',
    description: 'הנפקת 500 Sechar לכל אחד משלושת הזוכים בתחרות חידון הלכות שבת.',
    target: '0x...',
    callData: '0x...',
    callDataDecoded: 'הנפקת 1,500 Sechar (500 × 3 זוכים)',
    votesFor: 92000,
    votesAgainst: 2000,
    votesAbstain: 500,
    snapshotBlock: 98000,
    votingStartTime: '2026-03-28T12:00:00Z',
    votingEndTime: '2026-04-02T12:00:00Z',
    state: 'executed',
    executed: true,
    quorumReached: true,
    quorumRequired: 10000,
    totalVotingTokens: 15000,
    myVote: 'for'
  },
  {
    id: '4',
    proposer: '0x...',
    type: 'parameter_update',
    title: 'העלאת תקרת הנפקה חודשית ל-100,000',
    description: 'עם הצטרפות 50 תלמידים חדשים, התקרה הנוכחית של 50,000 Sechar לחודש אינה מספיקה. מוצע להכפיל את התקרה.',
    target: '0x...',
    callData: '0x...',
    callDataDecoded: 'שינוי תקרת הנפקה חודשית מ-50,000 ל-100,000 Sechar',
    votesFor: 30000,
    votesAgainst: 55000,
    votesAbstain: 8000,
    snapshotBlock: 97000,
    votingStartTime: '2026-03-20T09:00:00Z',
    votingEndTime: '2026-03-25T09:00:00Z',
    state: 'failed',
    executed: false,
    quorumReached: true,
    quorumRequired: 10000,
    totalVotingTokens: 14000,
    myVote: 'against'
  }
];
```

### Mock Treasury Stats

```typescript
const MOCK_TREASURY_STATS: TreasuryStats = {
  totalDonatedUSD: 25000,
  tmimCirculating: 180000,
  tmimTotalMinted: 195000,
  usdcBalance: 18500,
  ethBalance: 2.5,
  reserveRatio: 35.2,
  redemptionRate: 0.10,
  maxMonthlyMint: 50000,
  currentMonthMinted: 32000
};
```

### Mock Payment Streams (2)

```typescript
const MOCK_STREAMS: PaymentStream[] = [
  {
    id: '1',
    recipient: '0x...',
    totalAmount: 1200,
    claimedAmount: 400,
    startTime: '2026-03-01T00:00:00Z',
    endTime: '2026-09-01T00:00:00Z',
    cancelled: false,
    claimable: 200
  },
  {
    id: '2',
    recipient: '0x...',
    totalAmount: 600,
    claimedAmount: 600,
    startTime: '2026-01-01T00:00:00Z',
    endTime: '2026-04-01T00:00:00Z',
    cancelled: false,
    claimable: 0
  }
];
```

---

## Implementation Checklist (for the implementer)

### Smart Contracts
1. Create `contracts/contracts/ChayoleiGovernance.sol` per 2B.1 spec
2. Create `contracts/contracts/GovernanceTreasury.sol` per 2B.2 spec
3. Create `contracts/contracts/ChibburRewardsV2.sol` per 2B.3 spec
4. Write deployment script following 2B.4 sequence
5. Write basic tests for each new contract
6. Deploy to Base Sepolia
7. Run post-deployment verification checklist

### UI — New Routes
8. Create `src/routes/governance/+page.svelte` (3 tabs)
9. Create `src/routes/governance/[id]/+page.svelte` (proposal detail)
10. Enhance `src/routes/treasury/+page.svelte` (add donation, redemption, streams, parameters)

### UI — New Components
11. Create `src/lib/components/ProposalCard.svelte`
12. Create `src/lib/components/VotingPower.svelte`
13. Create `src/lib/components/TreasuryStats.svelte`

### UI — Integration
14. Add governance widget to dashboard
15. Add voting history tab to chaver profile
16. Add delegation section to settings (or "coming soon" placeholder)
17. Add governance nav item to sidebar (with notification dot)

### Types & Store
18. Add governance types to types file
19. Add governance state + derived to AppStore
20. Add mock data for development

### Data Layer (stretch — may be deferred)
21. Add Firestore listeners for proposal events (sync on-chain → Firestore)
22. Add ethers.js contract instances for new contracts
23. Wire up real contract calls in place of mock data

---

*End of Spec 2: DAO Requirements*
