# DocumentRegistry Contract

**File**: `contracts/DocumentRegistry.sol`
**License**: MIT
**Solidity**: `^0.8.24`
**Inherits**: `Ownable` (OpenZeppelin v5)

## Purpose

The DocumentRegistry contract provides immutable, time-stamped, on-chain anchoring of document hashes. It serves as a cryptographic proof layer -- documents (e.g., the Master LPA) are hashed off-chain using SHA-256, and the resulting hash is registered on-chain with a document type label and timestamp.

Once a document hash is registered, it cannot be modified, overwritten, or removed. This guarantees document provenance: anyone can verify that a specific document existed at a specific point in time by checking its hash against the registry.

## Struct

```solidity
struct Document {
    bytes32 docHash;
    uint256 timestamp;
    string docType;
    address uploader;
    bool exists;
}
```

| Field | Type | Description |
|---|---|---|
| `docHash` | `bytes32` | SHA-256 hash of the document content |
| `timestamp` | `uint256` | Block timestamp when the document was registered |
| `docType` | `string` | Document type label (e.g., `"MASTER_LPA"`) |
| `uploader` | `address` | Address that registered the document (always the owner) |
| `exists` | `bool` | Flag indicating whether this hash has been registered |

## State Variables

```solidity
mapping(bytes32 => Document) public documents;
```

| Variable | Type | Description |
|---|---|---|
| `documents` | `mapping(bytes32 => Document)` | Maps document hashes to their registration records |

The mapping key is the document hash itself (`bytes32`). The auto-generated getter for `public` mappings returns the struct fields as a tuple.

## Constructor

```solidity
constructor() Ownable(msg.sender) {}
```

Sets the deployer as the contract owner.

## Functions

### `registerDocument(bytes32 docHash, string calldata docType)`

```solidity
function registerDocument(bytes32 docHash, string calldata docType) external onlyOwner
```

Registers a new document hash on-chain. Creates an immutable record with the hash, block timestamp, document type, and uploader address.

- **Access**: `onlyOwner`
- **Reverts**: If `documents[docHash].exists == true` (duplicate rejection)
- **Effect**: Stores a `Document` struct in the `documents` mapping
- **Emits**: `DocumentRegistered(docHash, docType, msg.sender, block.timestamp)`

**Duplicate protection**: The function checks `require(!documents[docHash].exists, "Document already registered")` before writing. This prevents overwriting an existing record and ensures each hash can only be registered once.

**Immutability**: There is no `updateDocument()` or `removeDocument()` function. Once registered, a document record is permanent.

### `verifyDocument(bytes32 docHash)`

```solidity
function verifyDocument(bytes32 docHash)
    external
    view
    returns (bytes32, uint256, string memory, address, bool)
```

Returns the full registration record for a given document hash.

- **Access**: Public (view)
- **Returns**: Tuple of `(docHash, timestamp, docType, uploader, exists)`

If the hash has not been registered, all fields return their zero/default values and `exists` returns `false`.

| Return Index | Type | Field |
|---|---|---|
| 0 | `bytes32` | `docHash` |
| 1 | `uint256` | `timestamp` |
| 2 | `string` | `docType` |
| 3 | `address` | `uploader` |
| 4 | `bool` | `exists` |

### `documentExists(bytes32 docHash)`

```solidity
function documentExists(bytes32 docHash) external view returns (bool)
```

Returns `true` if the hash has been registered, `false` otherwise. This is a convenience function for simple existence checks without retrieving the full record.

- **Access**: Public (view)
- **Returns**: `documents[docHash].exists`

## Events

```solidity
event DocumentRegistered(
    bytes32 indexed docHash,
    string docType,
    address indexed uploader,
    uint256 timestamp
);
```

| Parameter | Indexed | Description |
|---|---|---|
| `docHash` | Yes | The registered document hash |
| `docType` | No | Document type label |
| `uploader` | Yes | Address that registered the document |
| `timestamp` | No | Block timestamp of registration |

## Typical Usage Flow

```
1. Off-chain: compute SHA-256 hash of document (e.g., Master LPA PDF)
   -> lib/document-hasher.js: hashFile(path) returns { hash, algorithm, size }

2. On-chain: owner calls registerDocument(hash, "MASTER_LPA")
   -> Document struct stored, event emitted

3. Verification: anyone calls verifyDocument(hash) or documentExists(hash)
   -> Confirms the document was registered and retrieves its timestamp
```

## Hash Format

The `docHash` parameter is `bytes32`. In the Kadra system, documents are hashed using SHA-256 (via `lib/document-hasher.js`), which produces a 256-bit (32-byte) hash that maps directly to `bytes32`.

Example from the deployment script:

```javascript
const { hashFile } = require("../lib/document-hasher");
const lpaHashResult = hashFile("data/sample-lpa.txt");
// lpaHashResult.hash is a 0x-prefixed hex string (bytes32)
await docRegistry.registerDocument(lpaHashResult.hash, "MASTER_LPA");
```

## Security Properties

- **Immutability**: No update or delete functions exist. Records are permanent.
- **Duplicate prevention**: The same hash cannot be registered twice.
- **Timestamp integrity**: Uses `block.timestamp`, which is set by the network validators/miners. On Hardhat local network, this is deterministic.
- **Access control**: Only the contract owner can register documents. Verification is open to anyone.
