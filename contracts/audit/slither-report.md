# Slither Static Analysis — ChayoleiGovernance.sol
**Commit:** claude/nice-jepsen-7375ac  
**Analyzer:** Slither v0.10 (manual equivalent — tool not available in environment)  
**Compiler:** solc 0.8.24 (evm target: cancun)  
**Date:** 2026-05-11  

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 0     |
| Medium   | 2     |
| Low      | 3     |
| Informational | 4 |

---

## Medium Severity

### M-1: Arbitrary external call via governance execution
**File:** `ChayoleiGovernance.sol:366`  
**Pattern:** `controlled-delegatecall` / arbitrary external call

```solidity
(bool success, bytes memory ret) = p.target.call{gas: gasToForward}(p.callData);
```

**Description:**  
`executeProposal` forwards an arbitrary call to `p.target` with attacker-supplied `p.callData`. Although protected by the trusted-target whitelist (C3 hardening) and selector allowlist, the whitelist is editable by `DEFAULT_ADMIN_ROLE`. If admin keys are compromised, an attacker can add a malicious target and drain treasury contracts.

**Mitigation:** Whitelist changes should go through a time-locked proposal (PARAMETER_UPDATE type) rather than direct admin calls. Consider adding a 48-hour delay on `setTrustedTarget` / `setAllowedSelector` changes. (Currently these are direct admin calls with no timelock.)

**Verified mitigations in place:**
- Trusted-target + per-type selector allowlist ✓  
- `nonReentrant` on execution ✓  
- State update before external call ✓  

---

### M-2: Proposer-initiated cancellation after majority vote
**File:** `ChayoleiGovernance.sol:387`  
**Pattern:** griefing / proposal manipulation

```solidity
require(
    p.proposer == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
    "Not authorized"
);
require(p.state == ProposalState.Active || p.state == ProposalState.Queued, "Cannot cancel");
```

**Description:**  
A PROPOSER_ROLE holder can create a proposal, observe how voting trends, and cancel it before finalization if the outcome does not match their preference. This grants the proposer a free "vote reveal" option.

**Mitigation:** Restrict proposer-initiated cancellation to Active proposals only (before any votes are cast), or remove proposer cancellation rights entirely and rely on admin-only cancel. Alternatively, set a cancellation deadline (e.g., only cancellable within the first 24 hours of the voting period).

---

## Low Severity

### L-1: `abi.decode` panic on non-standard revert data
**File:** `ChayoleiGovernance.sol:377-383`  

```solidity
function _extractRevertReason(bytes memory ret) private pure returns (string memory) {
    if (ret.length < 68) return "Execution failed";
    bytes memory data = new bytes(ret.length - 4);
    for (uint256 i = 0; i < data.length; i++) {
        data[i] = ret[i + 4];
    }
    return abi.decode(data, (string));
}
```

**Description:**  
If a callee reverts with non-ABI-standard data of length ≥ 68 bytes (e.g., a multi-slot custom error), `abi.decode(data, (string))` will panic, reverting the entire `executeProposal` transaction. The proposal remains in Queued state and can be retried or cancelled — no funds are at risk. However, a malicious callee could craft a revert payload that permanently prevents a specific proposal from executing (admin cancel is the escape hatch).

**Mitigation:** Wrap `abi.decode` in a try/catch or use assembly to safely extract the revert reason. Example:
```solidity
try this._decodeRevertReason(data) returns (string memory s) {
    return s;
} catch {
    return "Execution failed";
}
```

---

### L-2: Unbounded `quorumOverride` in `propose`
**File:** `ChayoleiGovernance.sol:224`  

```solidity
quorumRequired: quorumOverride > 0 ? quorumOverride : defaultQuorum,
```

**Description:**  
A proposer can set `quorumOverride` to `type(uint256).max`, creating a proposal whose quorum can never be met. This wastes governance attention and blocks honest proposals by cluttering the proposal list. Impact is low since the proposal simply fails at finalization.

**Mitigation:** Clamp `quorumOverride` to `[defaultQuorum, type(uint128).max]` or add a separate admin-only `setQuorumOverride` mechanism.

---

### L-3: Role concentration at deployment
**File:** `ChayoleiGovernance.sol:166-169`  

```solidity
_grantRole(DEFAULT_ADMIN_ROLE, admin);
_grantRole(PROPOSER_ROLE, admin);
_grantRole(EXECUTOR_ROLE, admin);
_grantRole(APPROVER_ROLE, admin);
```

**Description:**  
The deployer address receives all four roles simultaneously. A single compromised key could pause the DAO, execute arbitrary queued proposals, and rotate the attestation signer.

**Mitigation:** Post-deployment, transfer `DEFAULT_ADMIN_ROLE` and `APPROVER_ROLE` to a multisig; keep `EXECUTOR_ROLE` as a separate operations key or use a keeper bot address.

---

## Informational

### I-1: `castVote` voting-not-started branch is dead code
**File:** `ChayoleiGovernance.sol:267`  

```solidity
require(block.timestamp >= p.votingStart, "Voting not started");
```

`votingStart = block.timestamp` at proposal creation, so this branch is always satisfied. The check is harmless dead code but increases bytecode size.

---

### I-2: `require(!p.executed)` is dead code behind state guard
**File:** `ChayoleiGovernance.sol:356`  

```solidity
require(!p.executed, "Already executed");
```

`executeProposal` already requires `p.state == ProposalState.Queued`, but `p.executed` is set to `true` only when state transitions to `Executed`. Since the state machine prevents reaching `Queued` once `executed = true`, this check can never fail. It is defense-in-depth dead code.

---

### I-3: `_extractRevertReason` O(n) memory loop
**File:** `ChayoleiGovernance.sol:380-382`  

A Solidity memory copy loop runs O(n) iterations. For large revert messages, this consumes significant gas from the `executionGasReserve`. Since Base Sepolia block gas limits are generous and callee messages are typically short, the practical impact is negligible.

---

### I-4: Selector collision risk in bootstrapSelectorWhitelist
**File:** `ChayoleiGovernance.sol:444-455`  

Whitelisted selectors are 4-byte hashes. Although no known collisions exist with the seeded function signatures, a future function added to a trusted target could collide. Off-chain tooling should verify no selector collision exists before `setTrustedTarget` is called for a new contract.
