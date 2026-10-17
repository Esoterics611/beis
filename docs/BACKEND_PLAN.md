# Beis — Backend & Smart Contract Plan

> Phase 3 complete. Vocabulary updated. Firebase backend (Phases 1–2) is implemented via SvelteKit API routes + Firestore; Cloud Functions replaced by server-side handlers. Smart contracts deployed on Base Sepolia.

---

## Current State
- SvelteKit 2 + Svelte 5 frontend with full CRUD, state machines, toast, signup
- All data in-memory (AppStore with `$state` arrays)
- Mock wallet connection (returns random address)
- No persistence, no auth, no backend

---

## Phase 1: Firebase Backend (1-2 sessions)

### 1A. Firebase Project Setup
- Create Firebase project `beis-learning` (or your chosen project ID)
- Enable: Auth, Firestore, Cloud Functions, Hosting
- Install `firebase` + `firebase-admin` SDKs
- Create `backend/` directory with Cloud Functions (TypeScript)
- Add `src/lib/firebase.ts` — client-side Firebase init

### 1B. Authentication — Wallet-Based
- **Firebase Custom Auth** with crypto wallet signature:
  1. User connects wallet (MetaMask/WalletConnect)
  2. Frontend requests nonce from Cloud Function `getNonce(walletAddress)`
  3. User signs nonce with wallet → produces signature
  4. Frontend sends `{ walletAddress, signature }` to Cloud Function `verifyWallet`
  5. Cloud Function verifies signature with ethers.js → creates Firebase custom token
  6. Frontend calls `signInWithCustomToken(token)`
- No email/password — wallet IS the identity
- Store `walletAddress` as Firebase UID or in user profile doc

### 1C. Firestore Data Model
```
/mekomot/{makomId}           — Makom
/chaverim/{chaverId}         — Chaver (uid = wallet address or Firebase UID)
/chaburot/{chaburahId}         — Chaburah
  /enrolledIds[]             — array field
/chibburim/{chibburId}          — Chibbur
/seifim/{seifId}         — Seif
/peerReviews/{reviewId}      — PeerReview
/discussions/{discussionId}  — Discussion
/donations/{donationId}      — Donation
/treasury                    — single doc with aggregate counters
/activities/{activityId}     — Activity feed (capped at 500)
```

### 1D. Cloud Functions (TypeScript)
```
auth/
  getNonce(walletAddress) → nonce
  verifyWallet(walletAddress, signature) → customToken

chaburot/
  createChaburah(data) → chaburahId         // officer check via custom claims
  updateChaburah(id, data)
  deleteChaburah(id)                       // cascade
  enrollInChaburah(chaverId, chaburahId)
  unenrollFromChaburah(chaverId, chaburahId)

chibburim/
  createChibbur(data) → chibburId
  updateChibbur(id, data)
  submitChibbur(id, contentUrl?)
  startReview(id)
  approveChibbur(id)                      // triggers token award
  requestRevision(id, notes)
  publishChibbur(id)

seifim/
  createSeif(data) → seifId
  startSeif(id)
  submitSeif(id, notes?)
  approveSeif(id)                      // triggers token award
  rejectSeif(id)

social/
  addPeerReview(data) → reviewId
  addDiscussion(data) → discussionId
  promoteChaver(id)                      // officer-only

treasury/
  addDonation(data)
  redeemTmim(chaverId, amount)
```

Each function:
- Validates caller's role via custom claims (`tier: officer|nco|enlisted`)
- Validates state machine transitions
- Updates Firestore atomically (batch writes)
- Logs activity
- Updates treasury counters

### 1E. Frontend Migration
- Replace `AppStore.$state` arrays with Firestore `onSnapshot` listeners
- Replace `AppStore.add*()` methods with Cloud Function calls
- Keep `$derived` computations — just feed them from Firestore
- Add loading/error states to all pages
- Add offline support with Firestore persistence

### 1F. Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read
    match /chaverim/{chaverId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.tier in ['officer'];
    }
    match /chaburot/{chaburahId} {
      allow read: if request.auth != null;
      allow create: if request.auth.token.tier == 'officer';
    }
    // ... etc
  }
}
```

---

## Phase 2: Smart Contracts — Base Sepolia (2-3 sessions)

### 2A. Contract Architecture

**SecharToken.sol** — ERC-20 token
- `mint(address to, uint256 amount)` — only treasury
- `burn(address from, uint256 amount)` — redemption
- `transfer/approve/transferFrom` — standard ERC-20
- Total supply tracks all minted Sechar

**ChayoleiRegistry.sol** — On-chain identity
- `register(address wallet, bytes32 nameHash)` — new chaver
- `ranks mapping(address => uint8)` — 0-9 for turai→aluf
- `promote(address chaver)` — only officer (rank >= 5)
- `getRank(address)` → rank
- Events: `Registered`, `Promoted`

**ChaburahManager.sol** — Campaign management
- `createChaburah(bytes32 nameHash, uint256 tokenBudget)` — officer only
- `enroll(uint256 chaburahId)` — self-enroll
- `chaburot mapping(uint256 => Chaburah)` — id, creator, budget, status
- Events: `ChaburahCreated`, `Enrolled`

**ChibburRewards.sol** — Task completion & token distribution
- `approveChibbur(uint256 chibburId, address assignee, uint256 reward)` — officer
- `approveSeif(uint256 seifId, address assignee, uint256 reward)` — officer
- Calls `SecharToken.mint()` to reward
- Events: `ChibburApproved`, `SeifApproved`, `TokensAwarded`

**PeerReviewVault.sol** — Review incentives
- `submitReview(uint256 chibburId, uint8 rating)` — reviewer
- `acknowledgeReview(uint256 reviewId)` — author
- Auto-mints small Sechar reward to reviewer
- Events: `ReviewSubmitted`, `ReviewAcknowledged`

**Treasury.sol** — DAO treasury
- `donate(uint256 amount)` — accepts ETH/USDC, mints Sechar
- `redeem(uint256 tmimAmount)` — burns Sechar, sends stablecoin
- `allocateToChaburah(uint256 chaburahId, uint256 amount)` — officer
- Redemption rate: 1 Sechar = $0.10 (configurable by governance)
- Events: `DonationReceived`, `TmimRedeemed`

### 2B. Hardhat Setup
- `contracts/` directory with Hardhat + TypeScript
- Solidity 0.8.20, OpenZeppelin 5.x (ERC-20, AccessControl, ReentrancyGuard)
- Deploy scripts for Base Sepolia testnet
- Ethers.js v6 integration in Cloud Functions

### 2C. Hybrid Architecture
```
User Action → Cloud Function → Firestore (fast, real-time)
                             ↘ Smart Contract (on-chain authority)
```
- **Firestore** = fast reads, real-time UI updates, complex queries
- **Smart Contracts** = token minting/burning, rank authority, treasury funds
- Cloud Functions bridge both: write Firestore + call contract in same function
- On-chain events sync back to Firestore via event listeners

### 2D. What Goes On-Chain vs Off-Chain

| Data | On-Chain | Off-Chain (Firestore) |
|------|----------|----------------------|
| Sechar token balances | ✓ ERC-20 | cached |
| Rank/promotion | ✓ Registry | cached |
| Chaburah creation | ✓ hash + budget | full data |
| Chibbur approval | ✓ reward event | full workflow |
| Peer reviews | ✓ rating + reward | comments/suggestions |
| Donations | ✓ on-chain tx | metadata |
| Redemptions | ✓ burn + payout | metadata |
| Discussions | — | ✓ Firestore only |
| Activity feed | — | ✓ Firestore only |
| User profiles | — | ✓ Firestore only |
| Task details | — | ✓ Firestore only |

---

## Phase 3: Polish & Launch Prep (1-2 sessions)

### 3A. Real Wallet Integration
- Replace mock `connectWallet()` with ethers.js BrowserProvider
- Support MetaMask, WalletConnect v2, Coinbase Wallet
- Sign-in-with-Ethereum (SIWE) standard
- Display ENS names where available

### 3B. IPFS Integration
- Chibbur content uploads to IPFS (Pinata/web3.storage)
- Content URL stored on-chain as IPFS hash
- Peer review evidence on IPFS
- Publication PDFs on IPFS

### 3C. Notifications
- Firebase Cloud Messaging (push)
- In-app notification center (bell icon in TopBar)
- Notify on: review requested, chibbur approved, tokens received, promotion, new discussion reply

### 3D. Mobile Responsiveness
- Test all pages at mobile/tablet breakpoints
- Collapsible sidebar → bottom nav on mobile
- Touch-friendly action buttons

### 3E. Social Features (Future)
- Follow/unfollow chaverim across locations
- Personal activity feed ("what my network did")
- Reputation scores (weighted: reviews given > tasks done > tokens earned)
- Leaderboard per location + global
- Achievement badges (first publication, 10 reviews, etc.)
- Direct messaging between chaverim

---

## Recommended Build Order

1. **Firebase auth + Firestore** (Phase 1A-1C) — gets real persistence
2. **Cloud Functions for CRUD** (Phase 1D) — server-side validation
3. **Frontend migration** (Phase 1E) — real-time data
4. **Smart contracts** (Phase 2A-2B) — token economics
5. **Hybrid bridge** (Phase 2C) — connect Firebase ↔ contracts
6. **Real wallet** (Phase 3A) — production auth
7. **IPFS** (Phase 3B) — content permanence
8. **Notifications + mobile** (Phase 3C-3D) — UX polish
9. **Social features** (Phase 3E) — growth & engagement
