// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityRegistry {
    function isEligibleLP(address investor) external view returns (bool);
}

contract KadraToken is ERC20, Ownable {
    IIdentityRegistry public identityRegistry;

    constructor(
        string memory name,
        string memory symbol,
        address _identityRegistry
    ) ERC20(name, symbol) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(
                identityRegistry.isEligibleLP(from),
                "Transfer blocked: sender is not an approved Limited Partner"
            );
            require(
                identityRegistry.isEligibleLP(to),
                "Transfer blocked: recipient is not an approved Limited Partner"
            );
        }
        super._update(from, to, value);
    }
}
