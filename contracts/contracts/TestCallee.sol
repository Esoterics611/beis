// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test-only helper for C3 execution gas control tests.
contract TestCallee {
    uint256 public value;

    function setValue(uint256 v) external {
        value = v;
    }

    function revertWithMessage() external pure {
        revert("callee reverted");
    }

    function revertNoReason() external pure {
        revert();
    }

    error TwoWordError(uint256 a, uint256 b);

    /// @dev 68 bytes of revert data that is not Error(string): the old
    ///      abi.decode-based reason extraction panicked on this (audit L-1).
    function revertWithCustomError() external pure {
        revert TwoWordError(32, type(uint256).max);
    }

    /// @dev An Error(string) selector whose length word runs past the data.
    function revertWithMalformedError() external pure {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0x08c379a0))
            mstore(add(ptr, 4), 32)
            mstore(add(ptr, 36), 1000)
            revert(ptr, 68)
        }
    }

    /// @dev Calls gov.executeProposal(pid) and requires it succeeds.
    ///      Used to prove the nonReentrant guard blocks re-entry when
    ///      this function is itself triggered by executeProposal.
    function attackExecute(address gov, uint256 pid) external {
        (bool ok,) = gov.call(abi.encodeWithSignature("executeProposal(uint256)", pid));
        require(ok, "Reentrancy blocked");
    }

    /// @dev Same as attackExecute but silently ignores the result.
    ///      Lets the parent executeProposal succeed; we then verify the
    ///      re-entered proposal's state was NOT changed.
    function attackExecuteQuiet(address gov, uint256 pid) external {
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok,) = gov.call(abi.encodeWithSignature("executeProposal(uint256)", pid));
        ok; // intentionally ignored — tests that the caller doesn't propagate failure
    }
}
