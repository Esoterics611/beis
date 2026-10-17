// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @notice Minimal ERC-20 for local Hardhat testing. Mimics USDC (6 decimals).
 *         Allows the owner to mint freely.
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalsVal
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimalsVal;
        // Mint 1M tokens to deployer for testing
        _mint(msg.sender, 1_000_000 * (10 ** decimalsVal));
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
