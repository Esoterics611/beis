# Chayolei Beis Dovid — Smart Contract Audit Package
**Version:** C3 (post-hardening) + C4 coverage + supermajority (2026-05-11)  
**Network:** Base Sepolia (Chain ID 84532)  
**Deployed governance:** `0x1589ca8E04be8e8F76261EacDE2f1C6687B356e8`  

---

## Contracts in Scope

| Contract | Address | Description |
|---|---|---|
| `ChayoleiGovernance.sol` | `0x1589ca8E04be8e8F76261EacDE2f1C6687B356e8` | Main DAO governance |
| `TMIMToken.sol` | `0x1A66CeE19C53956022f01842043d79d594BFb8E5` | Voting token (0 decimals) |
| `ChayoleiRegistry.sol` | `0xFA9Da3852829B3Fd94F05cFd7C160127980242fa` | On-chain rank attestation |
| `GovernanceTreasury.sol` | `0xBBedE83f5B488500b6CB42A5519dc9E56c9A9B7E` | DAO treasury |
| `ChayoleiTreasury.sol` | `0x3DB8a8A81f75eA2bAbDb481203AE4Db6C4dDA420` | Operational treasury |

---

## Architecture

```
                    Backend Signer
                    (attestation key)
                          │
                          │ EIP-712 RankAttestation
                          ▼
PROPOSER_ROLE ──► propose() ──► [Active]
                                     │
                    voters ──► castVote() (nonReentrant)
                                     │
                               finalizeProposal()
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                      [Failed]              [Queued]
                                               │
                                          timelock
                                               │
                    EXECUTOR_ROLE ──► executeProposal() (nonReentrant)
                                               │
                                          [Executed]
```

**Security hardening (C1 + C3 + supermajority):**

| Layer | Mechanism |
|---|---|
| C1 | EIP-712 rank attestation — votes require backend signature bound to (voter, rank, proposalId, nonce, expiry) |
| C3 | Trusted-target + per-type selector whitelist — propose() rejects calls to un-approved targets/functions |
| C3 | Execution gas reserve — callee cannot DoS executor by burning all gas |
| C4 | Supermajority (66%) enforced for GRANT_ROLE, PARAMETER_UPDATE, MONTHLY_CAP_UPDATE |
| All | nonReentrant on castVote and executeProposal |
| All | OZ AccessControl with named roles (PROPOSER, EXECUTOR, APPROVER, DEFAULT_ADMIN) |

---

## Test Coverage (ChayoleiGovernance.sol)

| Metric | Coverage |
|---|---|
| Statements | 100% |
| Functions | 100% |
| Lines | 100% |
| Branches | 93.75% |

95 tests across 7 describe suites:
- C1: rank attestation + EIP-712 (15 tests)
- C3: target/selector whitelist (12 tests)
- C3: execution gas control (6 tests)
- C4: cancel/admin parameter paths (20 tests)
- C4: supermajority enforcement + setSupermajorityBps (17 tests)
- C4: quorum boundary, idempotency, reentrancy guard (6 tests)
- C4: voting invariants (2 tests)

The remaining 6.25% uncovered branches are:
- `nonReentrant` modifier internal branch (OZ library — tested behaviorally via reentrancy tests)
- `require(!p.executed)` — dead code behind `require(p.state == Queued)` guard
- `require(block.timestamp >= p.votingStart)` — always satisfied (votingStart = block.timestamp)
- `require(gasNow > executionGasReserve)` — requires specific gas-limit manipulation

---

## Static Analysis Findings

### [slither-report.md](./slither-report.md)

| ID | Severity | Title |
|---|---|---|
| M-1 | Medium | Arbitrary external call via governance execution |
| M-2 | Medium | Proposer-initiated cancellation after majority vote |
| L-1 | Low | abi.decode panic on non-standard revert data |
| L-2 | Low | Unbounded quorumOverride in propose() |
| L-3 | Low | Role concentration at deployment |
| I-1..4 | Info | Dead code, O(n) loop, selector collision |

### [mythril-report.md](./mythril-report.md)

No critical findings. Symbolic analysis verified:
- No unauthorized execution path (role checks enforced)
- No double-execution path (state machine enforced)
- No attestation bypass (EIP-712 digest bound to all sensitive fields)
- No reentrancy-exploitable state transition
- Supermajority invariant formally validated at boundary conditions

---

## Recommended Remediation Priority

| Priority | Finding | Effort |
|---|---|---|
| **P1** | Post-deployment: transfer DEFAULT_ADMIN_ROLE to multisig (L-3) | 30 min |
| **P2** | Clamp `quorumOverride` to a sane upper bound (L-2) | 1 hour |
| **P3** | Restrict proposer cancellation to pre-vote period (M-2) | 2 hours |
| **P4** | Harden `_extractRevertReason` with try/catch (L-1) | 1 hour |
| **P5** | Add timelock to whitelist admin functions (M-1) | 1 day |

---

## How to Reproduce

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test test/ChayoleiGovernance.test.ts   # 95 tests, ~11s
npx hardhat coverage --testfiles test/ChayoleiGovernance.test.ts
```

To install Slither and run automated analysis:
```bash
pip install slither-analyzer
slither . --config-file slither.config.json \
  --checklist \
  --filter-paths "node_modules,test" \
  > audit/slither-auto-report.txt 2>&1
```

To run Mythril:
```bash
pip install mythril
myth analyze contracts/ChayoleiGovernance.sol \
  --solc-json hardhat.config.ts \
  --max-depth 20 \
  > audit/mythril-auto-report.txt 2>&1
```

---

## Known Out-of-Scope Items

- Backend attestation signer key management (off-chain operational security)
- Firestore reconciliation listener (off-chain, no on-chain exposure)
- Cross-chain replay (EIP-712 domain includes chainId)
- Frontend / SvelteKit application layer
- D3 donation flow (not yet implemented)
