// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentRegistry is Ownable {
    struct Document {
        bytes32 docHash;
        uint256 timestamp;
        string docType;
        address uploader;
        bool exists;
    }

    mapping(bytes32 => Document) public documents;

    event DocumentRegistered(
        bytes32 indexed docHash,
        string docType,
        address indexed uploader,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    function registerDocument(bytes32 docHash, string calldata docType) external onlyOwner {
        require(!documents[docHash].exists, "Document already registered");
        documents[docHash] = Document({
            docHash: docHash,
            timestamp: block.timestamp,
            docType: docType,
            uploader: msg.sender,
            exists: true
        });
        emit DocumentRegistered(docHash, docType, msg.sender, block.timestamp);
    }

    function verifyDocument(bytes32 docHash)
        external
        view
        returns (bytes32, uint256, string memory, address, bool)
    {
        Document storage doc = documents[docHash];
        return (doc.docHash, doc.timestamp, doc.docType, doc.uploader, doc.exists);
    }

    function documentExists(bytes32 docHash) external view returns (bool) {
        return documents[docHash].exists;
    }
}
