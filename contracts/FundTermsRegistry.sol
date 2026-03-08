// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Demo-friendly on-chain registry for key fund terms extracted from legal docs.
 *
 * Notes:
 * - Full documents stay off-chain.
 * - Admin stores normalized key/value terms and source hash reference.
 * - Values are intentionally simple for demo visibility.
 */
contract FundTermsRegistry is Ownable {
    enum ValueType {
        STRING,
        UINT,
        BOOL,
        BYTES32
    }

    struct Term {
        string key;
        ValueType valueType;
        string stringValue;
        uint256 uintValue;
        bool boolValue;
        bytes32 bytes32Value;
        bytes32 sourceDocumentHash;
        uint256 updatedAt;
        bool exists;
    }

    // fundIdHash => termKeyHash => term
    mapping(bytes32 => mapping(bytes32 => Term)) private terms;

    event TermUpserted(
        bytes32 indexed fundIdHash,
        bytes32 indexed termKeyHash,
        string key,
        ValueType valueType,
        bytes32 sourceDocumentHash,
        uint256 updatedAt
    );

    constructor() Ownable(msg.sender) {}

    function setStringTerm(
        bytes32 fundIdHash,
        string calldata key,
        string calldata value,
        bytes32 sourceDocumentHash
    ) external onlyOwner {
        _upsertBase(fundIdHash, key, ValueType.STRING, sourceDocumentHash);
        bytes32 termKeyHash = keccak256(bytes(key));
        terms[fundIdHash][termKeyHash].stringValue = value;
    }

    function setUintTerm(
        bytes32 fundIdHash,
        string calldata key,
        uint256 value,
        bytes32 sourceDocumentHash
    ) external onlyOwner {
        _upsertBase(fundIdHash, key, ValueType.UINT, sourceDocumentHash);
        bytes32 termKeyHash = keccak256(bytes(key));
        terms[fundIdHash][termKeyHash].uintValue = value;
    }

    function setBoolTerm(
        bytes32 fundIdHash,
        string calldata key,
        bool value,
        bytes32 sourceDocumentHash
    ) external onlyOwner {
        _upsertBase(fundIdHash, key, ValueType.BOOL, sourceDocumentHash);
        bytes32 termKeyHash = keccak256(bytes(key));
        terms[fundIdHash][termKeyHash].boolValue = value;
    }

    function setBytes32Term(
        bytes32 fundIdHash,
        string calldata key,
        bytes32 value,
        bytes32 sourceDocumentHash
    ) external onlyOwner {
        _upsertBase(fundIdHash, key, ValueType.BYTES32, sourceDocumentHash);
        bytes32 termKeyHash = keccak256(bytes(key));
        terms[fundIdHash][termKeyHash].bytes32Value = value;
    }

    function getTerm(bytes32 fundIdHash, string calldata key)
        external
        view
        returns (Term memory)
    {
        bytes32 termKeyHash = keccak256(bytes(key));
        return terms[fundIdHash][termKeyHash];
    }

    function _upsertBase(
        bytes32 fundIdHash,
        string calldata key,
        ValueType valueType,
        bytes32 sourceDocumentHash
    ) internal {
        bytes32 termKeyHash = keccak256(bytes(key));
        Term storage t = terms[fundIdHash][termKeyHash];

        t.key = key;
        t.valueType = valueType;
        t.sourceDocumentHash = sourceDocumentHash;
        t.updatedAt = block.timestamp;
        t.exists = true;

        emit TermUpserted(
            fundIdHash,
            termKeyHash,
            key,
            valueType,
            sourceDocumentHash,
            block.timestamp
        );
    }
}
