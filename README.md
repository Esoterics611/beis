# Beis

**A workspace for Torah scholarship — chaburos, peer review, AI-assisted research, and a shared corpus that grows with every contribution.**

For the full vision, read [`docs/PUBLIC_INTRODUCTION.md`](docs/PUBLIC_INTRODUCTION.md).

---

## Status

This repository is the **Beis** rebuild of the original Chayolei Beis Dovid platform. Beis carries the same underlying engine forward into a new framing:

- A workspace for **both** Chassidus/Kabbalah and Talmud/Halacha scholarship
- **AI as a chaver** in the chaburah — agentic members with defined roles, attributed contributions, mashpia-controlled permissions
- **Big projects** as a first-class concept — multi-year, multi-contributor, donor-funded ambitious works
- **Sefer aesthetic** in place of the older "sacred night" theme — parchment, serif, restrained
- Crypto infrastructure stays underneath; transparency surfaces as a public ledger, not as crypto

---

## Quick start

```bash
# Web app
cd beis
npm install
cp .env.example .env
# Fill in Firebase and contract env vars
npm run dev

# Smart contracts
cd contracts
npm install
cp .env.example .env
npx hardhat test
```

Requires Node 20+.

---

## Repo layout

```
beis/
├── docs/
│   ├── PUBLIC_INTRODUCTION.md      ← Beis vision (start here)
│   ├── SPEC_1_ACADEMIC_UI.md       ← UI spec (carried from chayolei, due for rewrite)
│   ├── SPEC_2_DAO_REQUIREMENTS.md  ← DAO/governance spec (carried, due for rewrite)
│   ├── SESSION_HANDOFF.md          ← active dev state (from chayolei; will be re-baselined)
│   ├── BACKEND_PLAN.md             ← backend roadmap
│   └── legacy/                     ← chayolei-era marketing prompts, preserved
├── contracts/                      ← Solidity (Hardhat) — carried from chayolei
├── src/                            ← SvelteKit app — carried from chayolei
├── static/
└── package.json
```

The contracts and the SvelteKit app are the chayolei codebase at the point of fork. Phase 1 of the rebrand performs the terminology and branding pass; Phases 2–6 follow per the active plan.

---

## Heritage

Beis is a continuation of the work begun under the name *Chayolei Beis Dovid* — itself a reference to the Rebbe Rashab's Tomchei Tmimim. That instance is preserved separately and may continue to operate as a Tomchei Tmimim-specific configuration of the same engine.
