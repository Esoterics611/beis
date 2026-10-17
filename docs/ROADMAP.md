# Beis — Roadmap (July 2026 re-baseline)

> Written after a full repo audit on 2026-07-05, following a ~2-month pause.
> Supersedes the sequencing implied by BACKEND_PLAN.md (which describes a
> pre-Firebase state that no longer exists) and the original Phases 1–6
> rebrand plan (Phases 1–2 shipped; this document replaces Phases 3+).

---

## Where the project actually is

**Vision** ([PUBLIC_INTRODUCTION.md](PUBLIC_INTRODUCTION.md)): GitHub for Torah
research — projects with claimable sections, drafting, peer review, mashpia
approval, AI research agents with attributed contributions, and a publication
pipeline that ships real seforim. Transparent funding surfaces as a public
ledger, not as crypto.

**Code**: the chayolei engine — a task tracker (mivtzaot → masimot → tafkidim)
with IDF ranks, TMIM token rewards, on-chain governance, and a treasury.
Solid infrastructure (Firebase-first store, wallet auth, 7 audited contracts
on Base Sepolia, 175 passing contract tests) — but **none of the vision's core
loop exists in code**:

| Vision pillar | In code today |
|---|---|
| Drafting surface / editor | ❌ nothing — masimot carry a `contentUrl` string |
| Peer review anchored to text | ❌ reviews are card-level ratings + comments |
| Corpus / source integration | ❌ none |
| AI agents ("AI as a chaver") | ❌ zero AI code anywhere |
| Publication pipeline | ❌ `publish` is a status flip + optional IPFS CID field |
| Contribution record | ⚠️ exists, but implemented as IDF ranks × voting multipliers |
| Public ledger | ⚠️ chain exists; donor-facing surface is wallet-first |

The Phase 1 rebrand renamed **UI strings only**. The data model, routes,
Firestore collections, and contract names still speak chayolei. Every feature
built before the structural rename makes that rename more expensive.

**Health** (as of this audit):

- `npm run build` **fails on a fresh clone** — `src/lib/server/firebase-admin.ts`
  imports credentials from `$env/static/private`, so the build requires a
  populated `.env`.
- 177 `svelte-check` errors — but 130 are in `src/dataconnect-generated/` and
  `src/dataconnect-admin-generated/`, which **nothing imports** (dead code).
  ~47 real errors across ~15 files.
- Contracts: 175/175 tests pass; slither + mythril reports in `contracts/audit/`.
- No git remote, no CI, no web-app tests.
- Docs drift: README references `docs/SESSION_HANDOFF.md` (moved to
  `legacy/`); BACKEND_PLAN.md says "all data in-memory" (long false);
  SETUP_GUIDE.md is chayolei-era (vanguard-dao project, Windows paths).

---

## The strategic reframe

Stop treating this as "rebrand chayolei in phases." Treat it as **build the
Beis product on the chayolei engine**. The token/governance plumbing is done
and audited — it is not the bottleneck and needs no further investment now.
The differentiator, per the vision doc itself, is the **scholarship
workspace**: drafting + text-anchored review + sources + AI. That is what
doesn't exist and what every stage below drives toward.

Two standing corrections to the inherited design:

1. **Auth must not require a wallet.** The vision says crypto stays
   underneath, but sign-in is wallet-signature-only. Chaverim, mashpiim, and
   donors will not install MetaMask. Move to normal Firebase Auth
   (email/Google/phone); make the wallet an optional linked credential; the
   server's existing attestation signer covers on-chain actions on the user's
   behalf until they link one.
2. **Ranks contradict the vision.** IDF ranks with voting-power multipliers
   were "buried" in copy during Phase 1 but still drive governance weight.
   Replace with a contribution score derived from accepted work + reviews —
   which is what the vision promises donors and contributors.

---

## Stage 0 — Revive the repo (1 session)

Goal: a stranger can clone, install, build, and trust the docs.

- [ ] Fix the build: switch server env access to `$env/dynamic/private` with
      lazy Firebase-admin init (build succeeds without secrets; runtime still
      fails fast with a clear error if unconfigured).
- [ ] Delete `dataconnect/`, `src/dataconnect-generated/`,
      `src/dataconnect-admin-generated/`, and the `dataconnect` block in
      `firebase.json` — unused, and the source of 130/177 type errors.
- [ ] Fix the ~47 real type errors (`farbrengen`, `mivtzaot/[id]`, the
      `src/lib/server/*` files, etc.).
- [ ] Re-baseline docs: rewrite README's status/layout sections; move
      SETUP_GUIDE.md and BACKEND_PLAN.md to `docs/legacy/` with a pointer here.
- [ ] Commit the pending PUBLIC_INTRODUCTION.md trim; gitignore the generated
      PDF (or commit it deliberately as a release artifact).
- [ ] Add a git remote + CI (GitHub Actions: `svelte-check`, `vite build`,
      `hardhat test`).
- [ ] Decide fate of the stale `.claire/` directory.

## Stage 1 — Ontology rewrite (the deferred "Phase 3") — do this BEFORE feature work

Goal: the code speaks Beis. One mechanical, no-behavior-change pass.

- [ ] Rename the domain model end to end — types, routes, API paths,
      Firestore collections, store fields:
      - Mivtza → **Project** (chaburah project)
      - Masima → **Chibbur** (the unit of scholarship)
      - Tafkid → **Stage/Step**
      - Talmid → **Chaver**; Anash page → Chaverim
      - Farbrengen → community page under a neutral name
- [ ] Replace `RANKS`/`RANK_META`/multipliers with a **contribution score**
      (accepted chibburim, reviews given/received, weighting TBD — start
      simple and linear). Governance weight = f(contribution score).
- [ ] Keep the deployed contracts as-is behind a thin adapter module; they are
      testnet-only and internally named Chayolei/TMIM, which no user sees.
      Rename on-chain only if/when a mainnet deployment is planned.
- [ ] Auth: add Firebase email/Google sign-in as the primary path; wallet
      becomes an optional linked credential (existing nonce/verify flow kept).
- [ ] Migration: **confirm whether the vanguard-dao Firestore holds real user
      data.** If not (likely), rename collections clean and reseed — no
      migration scripts needed.

## Stage 2 — The scholarship workspace (the missing product core)

Goal: a chaver can claim a section, draft in the app, get text-anchored
review, and the mashpia can approve — all in one place.

- [ ] **Editor**: TipTap (ProseMirror) with RTL Hebrew + nikud support,
      autosave to Firestore, revision snapshots per submit. This replaces the
      `contentUrl` string on chibburim.
- [ ] **Text-anchored review**: reviewers comment on ranges of the draft (the
      "PR review" of GitHub-for-Torah). Existing PeerReview model gains
      anchors; review threads resolve like PR conversations.
- [ ] **Sources as first-class data**: integrate the Sefaria API for lookup
      and citation. A citation = a structured ref (e.g. `Berakhot 2a`,
      `Tanya, Likutei Amarim 32`) that resolves to text in a side panel.
      Store citations on chibburim; they become the substrate for the AI
      agent in Stage 3 and for the searchable corpus.
- [ ] **Publication pipeline v1**: compile a project's approved chibburim
      into (a) a public read-only web edition and (b) a typeset,
      print-ready PDF (Typst is the strongest current option for Hebrew/RTL
      typesetting; Paged.js is the fallback if staying in HTML/CSS).
- [ ] Testing starts here: Vitest on the state machines + API routes,
      one Playwright smoke test over the claim→draft→review→approve loop.

## Stage 3 — AI chaver v1 (the marquee claim, currently vaporware)

Goal: one agent role, done properly: the **mekorot agent** (source-finder).

- Given a draft chibbur, it proposes relevant sources with exact citations,
  grounded in Sefaria text fetches (retrieve → cite → link), never from
  memory alone.
- Its output surfaces as **review comments from an agent identity** —
  attributed, permission-scoped by the rosh chaburah, and always
  suggestions a human accepts or rejects. This mechanically enforces the
  "doesn't pasken, doesn't write chiddushim" stance.
- Implementation: SvelteKit server route → `@anthropic-ai/sdk` (TypeScript).
  Default model `claude-opus-4-8` (adaptive thinking); consider
  `claude-sonnet-5` for high-volume/lower-stakes passes (formatting,
  bibliography) once costs are measured. Use prompt caching on the stable
  system prompt + loaded source context.
- [ ] Agent identity in the data model (a Chaver with `kind: 'agent'`,
      role + permissions set per project).
- [ ] Mekorot endpoint + UI ("suggest sources" on a draft; suggestions land
      as pending review comments).
- [ ] Accept/reject flow writes accepted citations onto the chibbur.
- Later roles (each is small once the first exists): bibliography/footnote
  formatter, glossary maintainer, parallel-passage flagger across the
  project's own corpus.

## Stage 4 — Donor & funding surface

Goal: the "transparently funded" pillar, presented as a ledger, not crypto.

- [ ] Public project pages: scope, progress, contributors, funding status —
      readable logged-out.
- [ ] Ledger view: donations and allocations rendered from chain events in
      plain language (the existing governance-listener already syncs events).
- [ ] Fiat rail: Stripe (or equivalent) donations recorded on the ledger via
      the existing attestation signer — donors need crypto even less than
      chaverim do.
- [ ] Contribution-weighted decisions using the Stage 1 contribution score.

---

## Sequencing rationale

- **Rename before building** (Stage 1 before 2): every feature written in the
  old ontology digs the Phase-3 hole deeper; the rename is cheap now and only
  gets more expensive.
- **Workspace before AI** (Stage 2 before 3): agents need a document model,
  a citation model, and a review-comment channel to act through. Building the
  agent first would mean bolting it onto a task tracker.
- **AI before donor surface** (Stage 3 before 4): the AI chaver is the
  differentiator and the retention driver; the donor surface sells best when
  there is real work to show.

## Open questions (answer before Stage 1)

1. Is there any real user data in the `vanguard-dao` Firestore, or only seeds?
   (Determines whether the rename needs migration scripts. Assumption: seeds only.)
2. Does chayolei (../chayolei) still need to run against the same Firebase
   project/contracts? If so, Beis should get its own Firebase project before
   the collection rename.
3. Target for first real users: a single pilot chaburah? That would argue for
   compressing Stage 4 and focusing Stages 2–3 on the pilot's actual seder.
