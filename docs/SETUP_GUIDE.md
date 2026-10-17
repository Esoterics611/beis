# Beis — Setup & Usage Guide

> Last updated: Phase 3 complete (2026-05-12)

---

## What Is Beis?

Beis is a Torah-learning platform for yeshiva communities: chaburot (learning groups), peer-reviewed chibburim (compositions), governance by contribution score, and a sechar (שכר) token that records scholarly contribution on-chain. The aesthetic is parchment-and-ink — sefer typography, burgundy accent, RTL Hebrew throughout.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | via nvm recommended |
| npm | 9+ | comes with Node |
| WSL 2 + Ubuntu | any | Windows dev only |
| Firebase account | — | for Firestore + Auth |
| MetaMask (browser) | — | for wallet-based sign-in |

---

## 1. Clone & Install

```bash
# On WSL Ubuntu
git clone <repo-url> /home/$USER/code/beis
cd /home/$USER/code/beis
npm install

# Contracts sub-package
cd contracts && npm install && cd ..
```

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in the blanks:

```bash
cp .env.example .env
```

### Firebase (required for dev)

Get from **Firebase Console → Project Settings → Service accounts → Generate new private key**:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Get from **Firebase Console → Project Settings → Your apps → Web app**:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
```

### Blockchain (optional — leave blank for UI-only dev)

```env
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0x...
VITE_SECHAR_TOKEN_ADDRESS=0x...
VITE_BEIS_REGISTRY_ADDRESS=0x...
VITE_CHIBBUR_REWARDS_ADDRESS=0x...
VITE_TREASURY_ADDRESS=0x...
VITE_GOVERNANCE_ADDRESS=0x...
```

---

## 3. Firebase Project Setup

### 3A. Firestore

1. In Firebase Console, enable **Firestore Database** in production mode.
2. Add a security rule that allows authenticated users to read/write:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Seed initial data (after starting the dev server):

```bash
# POST to the seed endpoint as an authenticated officer
curl -X POST http://localhost:5173/api/seed \
  -H "Authorization: Bearer <firebase-id-token>"
```

Or use the **Admin** page in the app if you have officer access.

### 3B. Firestore Collections (Phase 3 names)

| Collection | Document type |
|---|---|
| `mekomot` | Makom (yeshiva/campus locations) |
| `chaverim` | Chaver (members / users) |
| `chaburot` | Chaburah (learning groups) |
| `chibburim` | Chibbur (compositions / assignments) |
| `seifim` | Seif (task steps within a chibbur) |
| `peerReviews` | PeerReview |
| `discussions` | Discussion (threaded comments on chibburim) |
| `donations` | Donation records |
| `treasury` | Single `global` doc with aggregate counters |
| `activities` | Activity feed (latest 500) |
| `proposals` | Governance proposals |
| `nonces` | Auth challenge nonces (short-lived) |

> **Migrating from before Phase 3?** Run the collection migration script:
> ```bash
> node scripts/migrate-collections.js --dry-run   # preview changes
> node scripts/migrate-collections.js              # apply
> ```

---

## 4. Run the Dev Server

```bash
# On WSL Ubuntu
source ~/.nvm/nvm.sh   # if using nvm
npm run dev
```

App starts at **http://localhost:5173**.

> `npm run build` requires all env vars including `FIREBASE_PRIVATE_KEY`. Use `npm run dev` for iteration.

---

## 5. First Login

1. Open http://localhost:5173 — you'll land on the signup page.
2. Click **התחבר** (Connect).
3. In dev mode, click **"דלג (מצב פיתוח) →"** — skips wallet signing, generates a random dev address.
4. Choose a learning track (נגלה / חסידות / תמים).
5. Click **הצטרף ל-Beis** — creates your Chaver document in Firestore with 50 starting sechar.

### Making the First Officer

After your first login, grant officer tier via Firebase Admin SDK or Console:

```js
// Firebase Admin SDK
await admin.auth().setCustomUserClaims(uid, { tier: 'officer' });
```

Then sign out and back in. Officers can create chaburot, promote members, and manage chibburim.

---

## 6. Feature Walkthrough

### Chaburot (Learning Groups) — `/chaburot`

- **Create** (officer only): "חבורה חדשה" → name, type (course/research/publication/chaburah), category (nigleh/chassidus/halacha…), description, optional publication metadata.
- **Enroll**: Any member can join (or apply if approval required).
- **Bulk wizard**: For publication chaburot, use `/chaburot/[id]/wizard` to create many chibburim at once with a shared deadline and type.

### Chibburim (Compositions) — `/chibburim`

Status flow: `open → in_progress → submitted → in_review → revision_requested → approved → published`

- **Create** (NCO or officer): Assign to chaburah, set type (chapter_draft, research_paper, translation, editing, proofreading, etc.), set sechar reward.
- **Start**: Assignee clicks "התחל".
- **Submit**: Assignee submits with content URL and notes.
- **Review**: NCO/officer starts review, then approves or requests revision.
- **Approve**: Firestore updates status → `approved`; sechar tokens are awarded to assignee; on-chain ChibburRewards contract called if configured.

### Seifim (Task Steps) — `/seifim`

Sub-tasks within a chibbur with priority (low/medium/high/critical). Same approval flow. Token reward separate from the parent chibbur.

### Anash (Members) — `/anash`

Member directory with contribution scores, tier badges, activity history.
- Officers can **promote** a member (adds 5,000 contribution score).
- Filter by tier: מתחיל / בקי / מורה.

### Governance — `/governance`

- Create proposals (officer only).
- Vote with contribution-weighted power: `floor(log₂(score + 1))`.
- Passed proposals can be queued on-chain via BeisGovernance contract.

### Treasury — `/treasury`

View sechar circulation, donation history. Redeem sechar for USD via the Base Sepolia contract.

---

## 7. Tier System

Replaces the old 10-level rank system with 3 clean tiers based on `contribution_score`:

| Tier | Hebrew | Score | Voting weight |
|---|---|---|---|
| Enlisted | מתחיל | 0–999 | `floor(log₂(score+1))` |
| NCO | בקי | 1,000–9,999 | same formula |
| Officer | מורה | 10,000+ | same formula |

Score accrues from: chibbur approvals, seif completions, peer reviews, discussion contributions, enlistment bonus (50), and manual promotions (+5,000).

---

## 8. Smart Contracts (Base Sepolia)

All in `contracts/contracts/`:

| Contract | Purpose |
|---|---|
| `SecharToken.sol` | ERC-20 reward token (0 decimals, 1 Sechar ≈ $0.10) |
| `BeisGovernance.sol` | On-chain governance with EIP-712 attestations |
| `BeisRegistry.sol` | Member wallet registry |
| `BeisTreasury.sol` | Treasury: donations + redemption |
| `ChibburRewards.sol` | Reward minter for approved chibburim |
| `ChibburRewardsV2.sol` | V2 with signature verification |
| `GovernanceTreasury.sol` | Funds passed governance proposals |

### Compile & Deploy

```bash
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### Test

```bash
cd contracts
npx hardhat test
```

---

## 9. Project Structure

```
src/
  app.css                    # All design tokens (@theme block, parchment palette)
  lib/
    components/              # Shared UI components
      RankInsignia.svelte    # Score-tier insignia SVG (3 tiers)
      RankBadge.svelte       # Tier label chip
      Sidebar.svelte         # Navigation sidebar
      DiscussionThread.svelte
      PeerReviewCard.svelte
    server/                  # Server-only modules (Node.js)
      firebase-admin.ts      # Firestore Admin SDK init
      auth.ts                # requireAuth / requireOfficer guards
      contracts.ts           # ethers.js helpers for on-chain calls
    stores/
      app.svelte.ts          # AppStore: reactive Svelte 5 store (Firestore-backed)
      mock-data.ts           # Seed data used by /api/seed
    types/
      index.ts               # All interfaces: Chaver, Chaburah, Chibbur, Seif…
  routes/
    +page.svelte             # Dashboard
    chaburot/                # Chaburah pages (list, detail, new, wizard, apply)
    chibburim/               # Chibbur pages (list, detail, new)
    seifim/                  # Seif pages (list, new)
    anash/                   # Member directory + profile
    governance/              # Proposal list + detail
    treasury/                # Token + donation views
    farbrengen/              # Community gathering (Farbrengen) feed
    api/
      chaburot/              # POST/PATCH/DELETE chaburot
      chibburim/             # Full chibbur CRUD + state machine endpoints
      seifim/                # Seif CRUD + approve/reject/submit
      chaverim/              # Member management + promote
      discussions/           # Comment creation
      reviews/               # Peer review create + acknowledge
      governance/            # Proposal create + vote + attestation
      auth/                  # Nonce + wallet verify
      treasury/              # Redeem endpoint
      donations/             # Donation logging
      seed/                  # Dev seeder (officer only)
contracts/                   # Hardhat project (separate package.json)
  contracts/                 # Solidity sources
  scripts/                   # Deploy + admin scripts
  test/                      # Hardhat Mocha tests
scripts/
  migrate-collections.js     # Firestore Phase 3 migration script
docs/
  SPEC_1_ACADEMIC_UI.md      # Sefer aesthetic UI spec
  SPEC_2_DAO_REQUIREMENTS.md # Economic model + governance spec
  BACKEND_PLAN.md            # Backend architecture reference
  PUBLIC_INTRODUCTION.md     # Non-technical product overview
```

---

## 10. Type-Check

```bash
npm run check
```

> ~262 pre-existing TypeScript errors exist (Firebase DataConnect implicit-any params in generated files, missing `.env` members since `.env` is not committed, legacy `Maamar`/`Farbrengen` property mismatches). These do not affect runtime. The app runs correctly once env vars are populated.
