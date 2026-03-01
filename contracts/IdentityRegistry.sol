// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityRegistry is Ownable {
    mapping(address => bool) public isVerified;
    mapping(address => bool) public isEligible;

    event InvestorAdded(address indexed investor);
    event InvestorRemoved(address indexed investor);
    event EligibilityChanged(address indexed investor, bool eligible);

    constructor() Ownable(msg.sender) {}

    function addInvestor(address investor) external onlyOwner {
        isVerified[investor] = true;
        emit InvestorAdded(investor);
    }

    function removeInvestor(address investor) external onlyOwner {
        isVerified[investor] = false;
        isEligible[investor] = false;
        emit InvestorRemoved(investor);
    }

    function setEligibility(address investor, bool eligible) external onlyOwner {
        isEligible[investor] = eligible;
        emit EligibilityChanged(investor, eligible);
    }

    function isEligibleLP(address investor) external view returns (bool) {
        return isVerified[investor] && isEligible[investor];
    }
}
