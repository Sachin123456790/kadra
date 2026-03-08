# Kadra: complete in-depth description

## 1. What Kadra is

**Kadra is a programmable infrastructure layer for private real estate funds.** Its purpose is to replace fragmented, manual, trust-heavy back-office workflows with a blockchain-backed settlement and recordkeeping system. Instead of relying on siloed spreadsheets, PDFs, email threads, manual compliance checks, and human reconciliation, Kadra creates a single workflow where legal documents, investor permissions, settlement, ownership issuance, transfer enforcement, distributions, and audit exports all flow through one canonical system.  

At a high level, Kadra is meant to prove several claims at once. It argues that blockchain-based infrastructure gives better integration of data, tamper-resistant and time-stamped records, fewer failure modes than existing systems, improved integrity, provable auditability, lower dependence on trust in people and processes, fewer handoff points between systems, lower operational redundancy, faster settlement, lower cost, and a simpler operating model overall. The documents explicitly position Kadra as a system where even if the application layer were compromised, the underlying ledger history could not be rewritten. 

The short brief also states the strongest commercial framing: Kadra anchors legal documents on-chain and hardcodes compliance rules directly into an **ERC-3643 security token**, which allows it to automate administration, reduce wire-fraud risk, and compress settlement timelines from weeks to seconds while maintaining a mathematically verifiable system of record. 

---

## 2. What the demo is trying to prove

The demo is not just a UI walkthrough. It is intended to prove that **executed legal intent can become structured, verifiable, machine-readable state**, and that settlement and ownership can then be recognized deterministically rather than through manual operations. The demo also aims to show that the resulting state can be presented as clean structured data, continuously updated cap tables, ownership records, waterfall calculations, and audit-ready exports. 

The exact capabilities the demo intends to show are:

* PDF upload of a simple contract
* reading the PDF and hashing the necessary information
* creating a smart contract
* confirming asset transfer
* verifying all users
* storing information so it is viewable later
* presenting the result in a clean institutional UI
* exposing structured data views in the dashboard
* enabling data export
* showing cap tables
* showing automatic waterfall calculations derived from the LPA and ownership structure 

So the real proof is not "we can mint tokens." The real proof is:

**legal document + identity + payment settlement + contract enforcement + ownership reporting + auditability all become one continuous, verifiable workflow.**  

---

## 3. Core architecture

Kadra is described as a layered system with a clean UI, a backend and database, a blockchain environment (Sepolia testnet for production, Hardhat for local dev), smart contracts, and export tooling. The recommended setup is intentionally practical and demo-friendly.  

### Frontend

The frontend is a **React + Vite** application styled with **Tailwind CSS** and **shadcn/ui** to maintain a clean, institutional, banking-style aesthetic while avoiding anything that feels like a retail crypto app. Frontend-to-chain communication is handled using **viem** (frontend EIP-6963 provider detection) and **ethers.js** (backend signature verification).  

### Backend and off-chain state

Kadra keeps important structured state off-chain as well. The short brief says the local backend stores off-chain data such as names and emails, while the full demo spec recommends **PostgreSQL or SQLite** with **Prisma or Drizzle** to manage the canonical off-chain subscription ledger. This off-chain layer is not optional decoration. It is what makes the blockchain events understandable, queryable, and presentable to humans.  

### Blockchain environment

The blockchain layer targets the **Sepolia testnet** for production deployment, with a local Hardhat node available for development only. **Seeding scripts** automatically pre-populate the database and whitelist the five mock investors during initialization. 

### Smart contracts

Contracts are written in **Solidity**, using standard **OpenZeppelin** security libraries, and the security token standard called out in both docs is **ERC-3643**. Transfer hooks must query the identity registry and deterministically revert any unauthorized transfer. The short brief says the transfer restrictions are hardcoded conditional logic that intercepts transfers and blocks transactions to unverified wallets.  

### File handling, cryptography, and validator logic

The full demo spec recommends **Multer** or an equivalent multipart form parser for ingesting the Master LPA and wire receipts. The hashing engine uses **SHA-256** to generate the cryptographic anchor for the uploaded LPA PDF. The settlement validator is described as a Node.js backend script that performs the 3-way wire match and then generates an **ECDSA signature** that the smart contract requires in order to authorize token minting. The shorter brief also allows AI tooling for document extraction and says the hash is anchored to the smart contract to prove the document’s state.  

---

## 4. The major functional pillars of the demo

The full demo document says the demo is composed of:

* legal authority
* identity permissioning
* settlement validation
* deterministic enforcement
* data generation
* data structuring
* native auditability

All of that is presented through a single fund dashboard. 

Those pillars map to the following real modules.

---

## 5. Legal and governance layer

The legal starting point of the entire system is the **Master LPA**, represented in the demo as a single uploaded PDF. This document governs the fund and defines the key legal and economic rules that the rest of the system uses. The detailed spec says the Master LPA defines fund structure, ownership percentages and distributions, ownership generally, transfer restrictions such as LP-only transfers, capital committed, and the legal sentence or provision establishing that the asset is legally represented on-chain. 

The PDF itself remains **stored off-chain**, but its content is transformed into at least two important references:

* an **immutable hash**
* a **time-stamped reference** 

When uploaded, Kadra parses the document, extracts governing clauses such as fund identity, ownership, and transfer restrictions, computes a **SHA-256 cryptographic hash**, and then anchors the hash, timestamp, and document reference so that the existence and content of the document can be independently verified later. The system also registers the uploaded Master LPA as the governing agreement for the fund.  

This means Kadra is not just storing a file. It is turning the file into a legally meaningful, cryptographically anchored reference object that downstream records can point to. 

---

## 6. Subscription records and ownership intent

After the LPA is ingested, the system creates **subscription records** for investors. These records represent ownership intent before economic settlement has occurred. Each subscription record includes:

* investor identity
* allocation amount or allocation percentage
* reference to the governing document
* wallet address
* status
* timestamps
* references to the Master LPA hash and investor identity 

The status model is explicitly defined:

* **Pending** = intent of ownership exists, but it is not settled
* **Settled** = payment is confirmed and ownership is finalized 

The timestamps include when the subscription was created and when it was settled. The documents also say that these subscription records are created before the live demo and form part of the canonical off-chain structured subscription ledger. 

One of the most important design points in the demo is that **ownership is not created merely because a document was uploaded**. The system can show intended ownership and a pending cap table, but actual finalized ownership should only exist after settlement validation succeeds. 

---

## 7. Identity and wallet permissioning

Kadra includes an **Investor Registry UI** that maps real-world investor identities to specific blockchain wallet addresses. The shorter brief says this dashboard changes an investor’s status from "Unknown" to "Verified" and explicitly authorizes the wallet on-chain to hold the fund’s asset. The longer document says the investor registry contains **pre-approved and pre-structured LPs**, each mapped deterministically to exactly one wallet address. The wallets are visible and non-custodial, meaning investors retain control of their own wallets.  

The detailed spec adds that the five LP identities are initialized before the demo, identity-verified, wallet-linked, and marked both on-chain and off-chain as eligible LPs for the specific fund. Their wallets are stamped with a **fund-specific LP eligibility marker**. That is important because transfer rules are fund-specific, not merely "verified globally." 

This identity-permissioning layer is what makes the later compliance enforcement possible. A transfer is legal only if the receiving wallet has the correct eligibility marker for that fund. 

---

## 8. Settlement validator and payment recognition

Settlement is a core stage in the flow. The system uses a **mock payment confirmation PDF** or a mock bank wire receipt upload rather than a live bank integration. The validator checks the uploaded payment evidence against a **3-way match**. The short spec names the three dimensions explicitly:

* investor identity
* capital amount
* specific deal reference 

The detailed spec phrases the same logic as:

* subscription amount
* investor match
* document linkage, ensuring the payment settles the correct subscription and not a different one
* a payment reference and matching subscription ID 

The validator confirms that the amount matches the uploaded LPA or subscription, the investor identity is correct, the document or reference is linked correctly, and there is no double settlement. When verification succeeds, the state flips from **Pending** to **Settled**. That state transition is not just cosmetic. It is the trigger for final ownership recognition and token minting.  

The shorter brief describes this as the function that flips the state from pending to settled and triggers the smart contract to mint tokens. The technical appendix in the longer file adds that the backend validator generates an **ECDSA signature** that the smart contract requires to authorize minting.  

---

## 9. Smart contract and tokenized ownership

Once settlement is validated, Kadra uses an **ERC-3643 security token** to represent fund ownership. The contract is deployed or activated after settlement, encodes transfer restrictions and identity checks, and represents the ownership interest itself. The identity/compliance module is linked to the investor registry and checks eligibility on every transfer, blocking illegal transfers deterministically. 

The shorter brief says the ERC-3643 deployment is the actual security token contract representing fund ownership, and its transfer restrictions are hardcoded logic that intercept transfer attempts, check the identity registry, and deterministically block transfers to unverified wallets. 

When settlement succeeds, tokens are minted in exact correspondence to the ownership amount and sent to the LP’s wallet. Ledger entries are time-stamped, immutable, and linked to documents. This is where legal subscription intent becomes finalized ownership. 

---

## 10. On-chain ledger and off-chain event log

Kadra is explicitly both an on-chain and off-chain system.

### On-chain ledger

The on-chain ledger records:

* token minting
* transfers
* immutable time-stamped state changes 

### Off-chain event log

The off-chain event log is a compiled visibility layer that pulls information from the blockchain and makes it understandable to the user. It mirrors:

* document uploads
* settlement events
* linked hashes 

So the chain is the underlying source of truth for certain events, but the application creates a structured human-readable mirror of these events so that operators can see what happened and why. 

---

## 11. Capital account module

The longer demo spec adds a very important business layer: the **Capital Account Module**, described as an off-chain structured layer. For each LP, it stores:

* initial capital contribution
* date contributed
* ownership percentage
* capital returned
* accrued preferred return
* residual allocation
* ending capital balance 

These capital accounts update automatically when:

* settlement occurs
* transfers occur
* distribution simulation occurs 

This means Kadra is not only tracking token balances. It is also maintaining investment-accounting state that supports waterfall calculations and investor reporting. 

---

## 12. Waterfall configuration and distribution logic

The system includes a **Waterfall Configuration Module** visible in the UI. The configuration shows:

* calculation basis, such as IRR vs multiple
* distribution frequency
* catch-up yes or no 

Later in the demo, the Waterfall Configuration Panel is described in even more concrete terms, with example fields:

* preferred return X%
* return of capital X%
* IRR X%
* GP promote X% 

The distribution calculation flow is explicitly defined:

1. pull the settled ownership ledger
2. pull the capital accounts
3. apply waterfall tiers sequentially
4. update capital accounts
5. generate per-LP breakdowns
6. append an event log entry 

The short technical brief summarizes this as a **distribution calculator** that calculates pro-rata distributions for each investor based directly on the real-time token cap table, with an execution button to simulate the payout of yield across all verified wallets. 

The long doc emphasizes that the waterfall is not a spreadsheet guess. It is supposed to be derived from the governing legal agreement and bound to the ownership ledger, capital accounts, and distribution events, with no human spreadsheet modeling or discretionary adjustments during execution. 

---

## 13. Fund dashboard

All of this is surfaced through a single **Fund Dashboard**. The dashboard is one of the most important parts of the demo because it is what executives will actually see. It should be institutional and clean. The short brief calls it an institutional-grade UI mimicking standard banking software. The larger spec repeatedly stresses avoiding a crypto aesthetic.  

The dashboard is expected to show:

* fund overview
* fund name
* allocation percentage
* LP count
* cap table
* ownership timeline
* transaction history 

The shorter brief also adds:

* live cap table reading token balances directly from chain
* yield management/distribution interface
* audit export button 

At different points in the demo, the dashboard needs to show different states: empty fund state, pending subscription state, mixed settled and pending state, and fully settled ownership state. 

---

## 14. Audit, provenance, and export

Auditability is native to the Kadra pitch. The system must show not only operational state but also **how that state can be exported and independently examined**. The short brief says the audit packet generator should bundle:

* the original PDF
* the cryptographic hash
* a CSV log of all blockchain transactions
* into a downloadable ZIP file 

The longer spec expands this significantly. It says the structured data and audit views should expose:

* canonical ownership table
* event history
* document references
* export engine
* cap table
* on-chain references 

Later, it defines a dedicated audit interface that can export:

* final cap table
* ownership ledger snapshot
* all document hashes, including LPA, subscriptions, and payments
* settlement timestamps
* transaction history
* contract address and verification link 

The final export package should support:

* CSV files for cap table and ownership history
* PDF outputs for legal document hash registry, settlement timeline, and transfer log
* on-chain proofs, including contract address, transaction hashes, and block timestamps 

The provenance model is also defined: the system should show original PDF reference, cryptographic hash, timestamp, on-chain anchor reference, and version history such as Waterfall Version 1.0 derived from a specific LPA hash, and any future rule changes reflected as new versions like 1.1. 

---

## 15. Pre-demo environment

The demo is not supposed to start from a blank engineering environment. The larger spec provides a very explicit **pre-demo setup**.

Before the demo begins, the following should already exist:

* a fund entity created
* fund name: **Kadra Demo Fund I**
* legal form: LP or LLC taxed as partnership
* jurisdiction metadata stored for reference
* state: no ownership issued and no capital settled
* legal and compliance documents ready to upload
* fund-specific eligibility criteria
* waterfall rules pre-configured, derived from Master LPA, locked, and versioned
* identity layer initialized
* five LP identities pre-approved
* identity verified
* wallets linked
* marked on-chain and off-chain as eligible LPs
* fund-specific LP eligibility markers stamped onto the wallets
* transfer rules pre-defined, only allowing transfers between wallets that hold the fund-specific LP eligibility marker
* ERC-3643 template prepared but not yet deployed
* parameters ready for transfer restrictions, compliance hooks, and identity registry linkage
* fund dashboard ready to display the system state 

This setup matters because the demo is meant to show the fund, rules, and investors already existing before ownership is recognized. That distinction is important to the legal and settlement story. 

---

## 16. Demo process, step by step

The larger document provides a detailed nine-step demo narrative. Here is the complete interpretation.

### Step 1: show the fragmented world Kadra is replacing

The executives first see the Kadra fund dashboard and are meant to recognize the contrast between existing fragmented analog systems and Kadra’s structured system. The opening dashboard should show:

* fund name: Kadra Demo Fund I
* ownership allocated: 0%
* active LPs: 0
* cap table: empty
* the five LP identities visible as pending

The key message is: the fund, rules, and investors exist, but ownership does not yet exist because no capital has settled. 

### Step 2: upload the Master LPA and structure legal intent

The five investors are already onboarded, wallets are linked, and they are already marked as eligible LPs for the fund. One Master LPA governs the fund and defines ownership and transfer restrictions for all LPs. The user drags and drops the LPA PDF into the upload section. Kadra parses the document, extracts the relevant clauses, computes SHA-256, anchors the hash, timestamp, and document reference, and registers the LPA as the governing agreement. Then for each of the five investors, the system creates a subscription record with investor ID, wallet address, allocation percentage, references to the LPA hash and subscription ID, and initial state Pending. The dashboard should show the five LPs, their allocations, pending status, linked LPA hash, timestamp, and cap table representation. This is meant to replace email threads, spreadsheet rows, and PDF folders with a canonical structured representation. 

### Step 3: show intended ownership before settlement

The dashboard then shows the pre-settlement cap table, for example Investor A through E each at 20 percent, but all labeled Pending. Each line item links to the subscription record, governing LPA hash, and time-stamped reference. This visually demonstrates ownership intent without prematurely minting actual ownership. The canonical off-chain subscription ledger now exists and is auditable. 

### Step 4: recognize settlement deterministically

Next, a mock bank wire confirmation is uploaded for each investor matching the amount in the LPA. The uploaded statement includes amount and investor identity. Kadra automatically checks payment amount against subscription, investor identity, document hash or reference, and confirms there is no double settlement. Status goes through Verifying and then flips from Pending to Settled when correct. Once verification succeeds, ownership changes from intent to final ownership, the ownership ledger is finalized, the ERC-3643 contract is deployed or activated, compliance rules are embedded, tokens are minted in exact correspondence with ownership percentage, and those tokens are sent to the LP’s wallet. A ledger entry is added with timestamp, immutability, and linked documents. The fund dashboard updates live to show settled investors, finalized cap table entries, and activity log items indicating ownership recognition and settlement confirmation. 

The demo then includes a negative case: upload a bank wire that is **less than the amount agreed in the LPA**. The statement is scanned and parsed, the discrepancy is detected automatically, the status stays Pending, a settlement mismatch is flagged, the system displays a message that the settlement amount does not match the subscribed commitment, and **no tokens are minted**. No partial ownership is created. The remaining mock bank statements can then be batch uploaded to show that in mixed-state conditions the cap table remains correct without manual reconciliation. That is supposed to prove Kadra eliminates back-office ambiguity. 

### Step 5: final fund dashboard state

Once all correct settlements are completed, the cap table should show all five investors at their final settled ownership positions, for example 20 percent each. The dashboard should display totals such as ownership allocated and active LPs. Clicking on any LP should show ownership percentage, wallet address, settlement timestamp, token balance, governing LPA hash, subscription record ID, and payment confirmation reference. A ledger view should also show on-chain contract address, token or LPA supply, transfer restrictions active, ownership changes, and timestamps for every process. The audit-ready export interface should expose final cap table, ownership ledger snapshot, all document hashes, settlement timestamps, transaction history, contract address, and verification link. 

### Step 6: distribution logic and waterfall

Once ownership is final, settled, and immutable, the demo shows a predefined waterfall configuration panel. Example visible values include preferred return, return of capital, IRR, and GP promote. The rules are configured from governing documents and are bound to ownership ledger, capital accounts, and distribution events. The narrative here is that the waterfall is applied from legal terms to live ownership data without discretionary spreadsheet work. 

### Step 7: illegal transfer attempt

The system then demonstrates deterministic compliance enforcement. LP A initiates a transfer to a wallet that is not approved for this fund. The transfer is rejected immediately. There is no pending state and no partial execution. An error should be shown, with wording along the lines of: **Transfer blocked: recipient is not an approved Limited Partner for Kadra Demo Fund I**. The spec says the demo should highlight the wallet stamp check, the fund-specific LP eligibility marker, the ERC-3643 transfer hook, and the failed pre-transfer validation. 

### Step 8: legal transfer execution

The demo then shows a legal transfer from LP wallet 1 to LP wallet 2. Both wallets are identity verified and both carry the fund-specific LP eligibility marker. The transfer succeeds, executes on-chain, does not require manual approvals or compliance review, and immediately updates token balances, recalculates the cap table, appends a new ownership ledger entry, and records the timestamp and transaction hash. The frontend refreshes instantly to reflect the reduced position of LP wallet 1 and the increased position of LP wallet 2, along with the transfer event, from and to wallets, timestamp, and on-chain reference. After a legal LP-to-LP transfer, the dashboard should also show that capital accounts move proportionally and accrued preferred return follows ownership. 

### Step 9: structured data, audit, and export

The final stage shows the canonical ownership table and event-and-evidence log. The ownership table includes investor name, wallet address, ownership percentage, status, last updated timestamp, and governing LPA hash. The event log includes event type, actor, timestamp, document hash or transaction hash, and immutable reference ID, covering things like LPA ingestion, subscription creation, settlement confirmation, asset issuance, and transfers. Provenance must show original PDF reference, hash, timestamp, and on-chain anchor reference. Version history should show derivations like Waterfall Version 1.0 from LPA Hash XYZ and future rule changes as new versions. The export auditor package button then outputs the structured CSVs, PDFs, and on-chain proof references. The concluding message is explicit: fewer handoffs mean fewer breaches, rules are enforced before anyone can break them, ownership is provable, and auditability is native. 

---

## 17. Live cap table and data visibility

The cap table is a recurring centerpiece of the entire demo. In the short spec, it is a live frontend component that reads token balances directly from the blockchain. In the longer document, it begins as a pending-intent cap table linked to subscription records and LPA references, later becomes a mixed-state cap table with some pending and some settled investors, and ultimately becomes the finalized ownership table once all settlements clear. After legal transfers, it updates instantly again.  

So the cap table is not just a static report. It is a living interface that shows the entire lifecycle from intent to settlement to transfer-adjusted final ownership. 

---

## 18. Security and compliance logic

Kadra’s security proposition rests on deterministic enforcement. Rather than relying on humans to check documents, approvals, and transfer rules manually, the system embeds compliance checks into the control flow itself. The short brief says transfer restrictions are hardcoded. The long brief says transfer hooks query the on-chain identity registry and require a fund-specific LP eligibility marker. Illegal recipients fail pre-transfer validation and are blocked immediately. There is no partial execution and no ambiguous intermediate state.  

The same deterministic philosophy applies to settlement. Until the amount, identity, and reference match correctly, the subscription remains pending and no ownership is issued. That directly supports the claim that Kadra reduces operational and fraud risk by eliminating ambiguous handoffs.  

---

## 19. What Kadra stores on-chain versus off-chain

The system is careful about what goes where.

### Off-chain

* original PDFs
* names and emails
* structured subscription ledger
* capital accounts
* dashboard-friendly event logs
* settlement validation workflow state
* exported audit artifacts in user-friendly formats  

### On-chain

* smart contract state
* token balances
* minting events
* transfer events
* contract address
* time-stamped immutable ownership actions
* document anchors or references such as the cryptographic fingerprint of the LPA  

The documents consistently describe the off-chain layer as the structured, readable, canonical interface around the immutable ledger. Kadra is therefore hybrid by design, not purely on-chain. 

---

## 20. What makes the demo persuasive

The demo is persuasive because it shows the entire workflow, not isolated features. It begins with legal documents, shows pending intent, demonstrates deterministic settlement recognition, finalizes ownership only after proof of payment, enforces compliance at transfer time, updates business reporting automatically, and ends with auditable export. The audience is meant to feel that what currently takes multiple systems and multiple manual reconciliation steps can be run through a single structured system with better integrity and traceability.  

The short brief summarizes that value crisply: legal docs are anchored on-chain, compliance is encoded in ERC-3643, distributions use the live cap table, and an audit packet can be generated in one click. The larger spec then turns that into an operational demo with preconditions, states, failure cases, final UI expectations, and technical implementation guidance.  

---

## 21. Final one-paragraph description

**Kadra is a private real-estate fund operating system that ingests governing legal documents, hashes and anchors them, maps verified investors to fund-specific eligible wallets, creates pending subscription records, validates off-chain settlement through a 3-way payment match, converts settled subscriptions into ERC-3643 tokenized ownership, blocks illegal transfers through on-chain transfer hooks tied to an identity registry, maintains structured off-chain capital-account and event data, computes distributions and waterfalls from the live ownership ledger, and exposes the entire lifecycle through a clean institutional dashboard with native audit and export functionality.**  

