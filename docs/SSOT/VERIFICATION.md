# Angainor SSOT for deployed app verification

## 1. Product identity and core claim

Angainor is **not** a generic crypto dashboard. It is an operating system for private real-estate fund administration. Its value is that executed legal agreements, investor permissioning, settlement evidence, on-chain ownership, transfer restrictions, distributions, and auditability all become one connected system instead of being split across PDFs, spreadsheets, emails, and manual back-office review.  

The strongest claim Angainor must prove is:

**A fund can upload its governing legal document, create structured subscription intent for investors, validate settlement, mint ownership only after settlement, enforce fund-specific transfer restrictions on-chain, and expose cap table, history, distributions, and audit exports through a clean institutional dashboard.**  

If the deployed app does not prove that full chain of logic, it is incomplete even if isolated features work.

---

## 2. Deployment assumption for this SSOT

This SSOT assumes the live system is deployed like this:

### 2.1 Frontend and application runtime

The web application is deployed on **Vercel**, using **React + Vite** as the core framework and a clean institutional UI style using **Tailwind CSS** and **shadcn/ui**, consistent with the PDF requirement to avoid a crypto aesthetic.  

### 2.2 Database and off-chain canonical layer

The off-chain state is implemented in **Supabase** rather than local PostgreSQL or SQLite. This is a deployment substitution for the same conceptual role described in the PDFs: the canonical off-chain subscription ledger, event log, identity mapping, capital accounts, audit metadata, and structured records that make blockchain activity readable and operable.  

### 2.3 File storage

Uploaded LPAs, wire confirmations, and derived export artifacts are stored off-chain, which is consistent with the PDF requirement that the PDF itself is stored off-chain while its hash and reference are used as the immutable proof layer. In the deployed version, that off-chain file layer should be Supabase Storage or an equivalent managed object store. 

### 2.4 Blockchain layer

The smart contracts are deployed to the **Sepolia testnet** (Hardhat is used for local development only). The token standard remains **ERC-3643**, and transfer hooks must still enforce identity- and fund-specific restrictions. 

### 2.5 Wallet and chain communication

The app uses **viem** (frontend wallet detection) and **ethers.js** (backend signature verification) for chain communication against Sepolia testnet RPC endpoints. 

### 2.6 Backend execution model

The backend logic originally described as Node scripts is assumed to run as:

* Vercel serverless functions and/or route handlers
* Supabase Edge Functions and/or DB triggers
* background jobs where needed for parsing, reconciliation, export generation, and state sync

This is an implementation adaptation. The PDFs define the required logic, not the deployed hosting primitive. The required logic includes file ingestion, SHA-256 hashing, 3-way settlement validation, and generation of mint authorization data. 

---

## 3. Non-negotiable product behaviors

For Claude Code verification, the deployed app must satisfy these top-level truths.

### 3.1 Legal document first

The system begins with a **Master LPA** or governing legal document uploaded into the dashboard. Angainor must parse the document, extract relevant governing clauses, compute a **SHA-256 hash**, timestamp it, and register it as the governing agreement for the fund. The original document stays off-chain; the cryptographic reference and structured metadata become canonical system references.  

### 3.2 Ownership intent is not ownership

Uploading the LPA and creating investor subscriptions must **not** prematurely create settled ownership. Subscription records must initially exist in a **Pending** state. This is a core requirement from the demo spec.  

### 3.3 Settlement gates ownership

Only after payment evidence matches the correct investor, amount, and subscription/deal reference may the system flip the subscription from Pending to Settled and authorize minting of the ERC-3643 ownership token.  

### 3.4 Transfer rules are enforced on-chain

An unapproved wallet must never successfully receive a fund token. A legal LP-to-LP transfer between eligible wallets must succeed and update all downstream records automatically. 

### 3.5 Dashboard is institutional and operational

The UI must look like financial software, not retail web3, and expose fund overview, LP list, cap table, history, settlement state, ownership details, event evidence, and export controls.  

### 3.6 Auditability is native

The app must be able to show provenance and export structured records including hashes, timestamps, ownership tables, event history, contract address, transaction references, and related evidence.  

---

## 4. Canonical business objects

Claude Code should verify that the deployed app has representations for all of the following, whether as database tables, typed models, API shapes, or combined views.

### 4.1 Fund

A fund entity must exist and hold:

* fund name
* legal form
* jurisdiction or legal metadata
* fund-specific eligibility criteria
* governing LPA reference
* watermark or status for whether ownership has been issued
* waterfall configuration version
* linked token contract address once deployed/activated

The demo spec names the example fund as **Angainor Demo Fund I** and requires that the fund, the rules, and the investors can exist before ownership exists. 

### 4.2 Governing document

The LPA document object must include:

* file reference
* storage location
* original filename
* parsed text and/or extracted structured fields
* SHA-256 hash
* upload timestamp
* status
* derived clauses such as ownership rules and transfer restrictions
* provenance pointer used elsewhere in the system

The PDFs explicitly require hash, timestamp, document reference, and use as the governing agreement reference. 

### 4.3 Investor identity

Each investor must have:

* investor name or identity key
* verification status
* wallet mapping
* fund-specific eligibility status
* timestamps
* potentially supporting identity artifacts

The system must distinguish between a generally known investor and a fund-approved eligible LP.  

### 4.4 Wallet mapping

Each investor must map to exactly one visible deterministic wallet for the fund flow. The docs describe this as one investor mapped to one wallet, visible, deterministic, and non-custodial. 

### 4.5 Subscription record

Each investor subscription must hold:

* investor identity
* wallet address
* allocation amount and/or allocation percentage
* governing document reference
* subscription record ID
* status: Pending or Settled
* created timestamp
* settled timestamp
* payment confirmation reference after settlement
* hash references tying it to the LPA and supporting evidence

This is one of the clearest requirements in the spec and should exist exactly in the deployed system.  

### 4.6 Payment evidence

A payment or wire evidence record must include:

* uploaded wire/mock payment document reference
* parsed amount
* parsed identity
* subscription/deal reference
* validation result
* mismatch reason if failed
* linked subscription ID
* timestamp
* one-to-one or one-to-many relation to settlement checks

The PDFs require 3-way match logic and no accidental double-settlement or wrong-subscription settlement.  

### 4.7 Settlement event

A settlement event must exist when a subscription transitions from Pending to Settled and should include:

* subscription ID
* investor ID
* amount validated
* validator output
* mint authorization or signature reference
* timestamp
* actor or system source
* event evidence reference

The appendix describes a validator that generates an ECDSA signature used by the smart contract to authorize minting. 

### 4.8 Tokenized ownership record

After successful settlement, ownership must be represented on-chain and mirrored off-chain. The system needs to persist:

* contract address
* token balance
* wallet owner
* ownership percentage
* associated subscription ID
* governing LPA hash
* timestamps for mint and later changes

The final fund dashboard requirement explicitly lists token balance, governing hash, and ownership detail. 

### 4.9 Capital account

For each LP, the system must maintain a capital account layer with:

* initial capital contribution
* date contributed
* ownership percentage
* capital returned
* accrued preferred return
* residual allocation
* ending capital balance

It must update when settlement, transfers, and distribution simulations occur. 

### 4.10 Waterfall configuration

The waterfall configuration must exist as structured application state and should include at least:

* calculation basis, such as IRR vs multiple
* distribution frequency
* catch-up yes/no
* preferred return
* return of capital
* GP promote
* versioning and provenance back to governing agreement

The spec also requires version history and explicit derivation from an LPA hash.  

### 4.11 Event and evidence log

A canonical event log must exist and include:

* event type
* actor
* timestamp
* document hash or transaction hash
* immutable reference ID
* links to the affected object

The required event types include LPA ingestion, subscription creation, settlement confirmation, token issuance, and transfers. 

---

## 5. Required on-chain contracts and behaviors

## 5.1 ERC-3643 ownership token

The deployed app must use an ERC-3643-style permissioned token to represent fund ownership. The token contract must:

* represent ownership interest
* support minting after validated settlement
* consult identity/compliance checks for transfers
* reject unauthorized transfers deterministically

The docs make ERC-3643 central, not optional.  

## 5.2 Identity/compliance linkage

The contract layer must be linked to a registry or equivalent eligibility source so that transfers are allowed only between wallets carrying the fund-specific LP eligibility marker. The phrase “wallet stamped with fund-specific LP eligibility marker” is explicit in the demo spec. 

## 5.3 Transfer hooks

The deployed testnet contracts must implement pre-transfer checks. The appendix specifically requires transfer hooks that query the on-chain identity registry and revert unauthorized transfers. In the deployed version this may use an eligibility registry contract, role manager contract, or equivalent, but the observable behavior must match. 

## 5.4 Minting authorization

Minting must not happen simply because an admin clicked a button. The expected flow is that settlement validation produces an authorization artifact and the contract only mints after that condition is satisfied. In the appendix this is described as an ECDSA signature used to authorize minting. 

---

## 6. Required off-chain deployed architecture

This section is the Supabase/Vercel adaptation of the PDFs.

### 6.1 Supabase database must be the canonical operational source

Supabase should be the canonical source for:

* funds
* investor identities
* wallet mappings
* LP eligibility state
* uploaded document metadata
* LPA hashes
* subscription records
* payment evidence
* settlement validations
* ownership mirrors
* capital accounts
* waterfall configs
* event/evidence log
* export jobs and output references

The blockchain remains the source of truth for on-chain ownership events, but Supabase is the human-operable canonical state layer for the application. This is directly aligned with the PDF’s off-chain event log and canonical off-chain subscription ledger concepts.  

### 6.2 Supabase storage must hold off-chain artifacts

The app should store:

* Master LPA PDFs
* wire confirmation PDFs
* generated CSVs
* generated PDFs
* packaged audit ZIPs or equivalent

The PDF states that the original PDFs are off-chain and exports are downloadable bundles.  

### 6.3 Vercel app must expose app flows

The Vercel deployment should surface:

* fund dashboard
* document upload
* investor registry
* subscription status views
* settlement confirmation flow
* transfer attempt UI
* distribution and waterfall view
* audit/export view

These are all directly required by the PDFs.  

### 6.4 Event synchronization layer

Because the app is on testnet rather than local chain, the system must have some mechanism to sync on-chain events back into Supabase. That can be:

* webhook-based indexing
* periodic polling
* provider event subscriptions
* third-party indexing service
* custom worker

This is an implementation choice, but the required result is not optional: the off-chain event log must mirror document uploads, settlement events, and blockchain ownership activity in a user-readable way. 

---

## 7. Required page-level product surfaces

Claude Code should verify not just backend logic, but visible product surfaces.

## 7.1 Fund dashboard

The main dashboard must show:

* fund name
* ownership allocated
* active LP count
* cap table
* ownership timeline
* transaction history
* settlement statuses

The spec’s opening state for the demo is:

* Fund name: Angainor Demo Fund I
* Ownership allocated: 0%
* Active LPs: 0
* Cap table: empty
* five LP identities visible as pending

This opening state matters because it proves that fund and investor setup exists before settled ownership exists. 

## 7.2 Document upload and governance page

This page or modal must support:

* drag-and-drop or file upload of Master LPA
* parsing trigger
* extracted governing clauses display
* SHA-256 hash display
* timestamp
* document reference
* registration of the LPA as governing agreement

This is a first-class proof point in the spec. 

## 7.3 Investor registry page

This UI must show:

* investors
* wallet addresses
* identity verification state
* LP eligibility for the specific fund
* ability to distinguish approved from unapproved wallets

The short brief explicitly describes changing status from Unknown to Verified and authorizing the wallet to hold the asset. 

## 7.4 Subscription / cap table page

This surface must show, per investor:

* investor name
* wallet address
* allocation percentage
* status: Pending or Settled
* linked LPA hash
* subscription record ID
* timestamps

The pre-settlement cap table is explicitly part of the demo narrative and must not look like final ownership until settlement happens. 

## 7.5 Settlement validation interface

This surface must support:

* wire/mock payment upload
* parsed fields preview
* 3-way matching against identity, amount, and subscription/deal reference
* clear failure state if mismatch
* success state changing subscription to Settled
* no mint if mismatch or partial amount

The spec explicitly gives the negative case where a lower-than-agreed amount leaves the subscription pending and blocks token minting.  

## 7.6 Ownership detail view

Clicking an LP in the final state must show:

* ownership percentage
* wallet address
* settlement timestamp
* token balance
* governing LPA hash
* subscription record ID
* payment confirmation reference

This exact list appears in the final dashboard section of the demo PDF. 

## 7.7 Ledger / history view

The ledger view must show:

* on-chain contract address
* token/LPA supply
* transfer restrictions active
* ownership changes
* timestamps for every process

These are explicitly required in the final-state dashboard. 

## 7.8 Distribution and waterfall page

This must show:

* waterfall configuration
* preferred return
* return of capital
* IRR basis
* GP promote
* basis type and frequency
* outputs per LP
* event log entry after execution

The PDFs require the distribution module to be based on settled ownership and capital accounts, not arbitrary spreadsheet overrides.  

## 7.9 Audit and export page

This interface must show and/or export:

* final cap table
* ownership ledger snapshot
* all document hashes
* settlement timestamps
* transaction history
* contract address and verification link
* provenance details
* export package outputs

This requirement is explicit and central.  

---

## 8. Required state machine

Claude Code should verify the actual state transitions.

## 8.1 Document states

A governing document should move through something like:

* uploaded
* parsed
* hashed
* registered as governing agreement

The key check is that the system never treats a document as canonical without a hash and reference. 

## 8.2 Investor states

Investor states should distinguish:

* unknown or unverified
* verified identity
* fund-eligible LP
* wallet linked

The short brief and demo both require this distinction.  

## 8.3 Subscription states

Subscriptions must at minimum support:

* Pending
* Settled

This is explicitly named in the PDF and should not be omitted. 

## 8.4 Settlement states

A settlement workflow should conceptually include:

* evidence uploaded
* validating
* matched
* mismatched
* settled

The exact internal labels may differ, but the business behavior must produce those outcomes. The negative case is required. 

## 8.5 Ownership states

Ownership must be:

* non-existent before settlement
* created only after successful settlement and mint
* updated after valid transfers
* unchanged after blocked transfers

This is one of the main demonstration proofs.  

---

## 9. Required flows

## 9.1 Master LPA ingestion flow

The deployed app must support this exact business flow:

1. User uploads Master LPA PDF.
2. System parses relevant governing clauses.
3. System computes SHA-256 hash.
4. System timestamps and records document reference.
5. System registers LPA as governing agreement for the fund.
6. System creates or updates subscription records for each investor tied to that LPA.
7. Dashboard shows the investors, allocations, pending states, hash, and timestamps.

This is directly specified in the demo process. 

## 9.2 Pre-settlement cap table flow

After LPA ingestion but before settlement:

* investors should appear in the cap table
* their allocations should appear
* their status should still be Pending
* ownership should not yet be final or settled on-chain

This is a required visual proof. 

## 9.3 Settlement validation flow

1. User uploads mock wire or payment evidence.
2. System parses amount, identity, and reference.
3. System validates against subscription.
4. If successful, status changes to Settled.
5. Mint is authorized and executed.
6. Token balances and ownership appear in final state.
7. Evidence and event logs are appended.

This is required by both PDFs.  

## 9.4 Mismatch flow

If payment amount is wrong or linkage is wrong:

* subscription remains Pending
* mismatch is flagged visibly
* no tokens are minted
* no partial ownership is created

This must be testable in the deployed app because it is explicitly included as a demo proof. 

## 9.5 Illegal transfer flow

1. Eligible LP initiates transfer to non-approved wallet.
2. Contract transfer hook checks eligibility.
3. Transfer fails immediately.
4. No partial execution.
5. Error is shown to user.
6. Ownership ledger remains unchanged except for failed-attempt evidence if tracked.
7. Dashboard can surface the blocked attempt.

The exact example error in the spec is “Transfer blocked: recipient is not an approved Limited Partner for Angainor Demo Fund I.” 

## 9.6 Legal transfer flow

1. Eligible LP wallet #1 transfers to eligible LP wallet #2.
2. Transfer succeeds on-chain.
3. No manual approvals or extra compliance step.
4. Token balances update.
5. Cap table recalculates.
6. Ownership ledger records a new entry.
7. Timestamp and transaction hash appear.
8. Capital accounts move proportionally.
9. Accrued preferred return follows ownership.

This is one of the strongest end-to-end checks for Claude Code to verify. 

## 9.7 Distribution flow

1. Pull settled ownership ledger.
2. Pull capital accounts.
3. Apply waterfall tiers sequentially.
4. Update capital accounts.
5. Generate per-LP breakdown.
6. Append event log entry.
7. Surface results in UI and optionally export them.

This is explicitly defined in the PDF. 

## 9.8 Audit export flow

The app must let a user export an auditor package containing structured records such as:

* cap table
* ownership history
* legal document hash registry
* settlement timeline
* transfer log
* on-chain proofs
* contract address
* transaction hashes
* block timestamps

This export capability is a required proof point. 

---

## 10. Canonical data expectations in Supabase

This section is not quoted from the PDFs word-for-word, but it is the deployed translation of what the PDFs require.

At minimum, Claude Code should verify there are persistent tables or equivalent models for:

* `funds`
* `governing_documents`
* `investors`
* `wallet_mappings`
* `lp_eligibility`
* `subscriptions`
* `payment_evidence`
* `settlement_validations`
* `token_positions` or `ownership_snapshots`
* `capital_accounts`
* `waterfall_configurations`
* `event_log`
* `audit_exports`

The names can differ. The important part is that the concepts exist and are queryable. These concepts come directly from the subscription, identity, settlement, capital account, waterfall, and audit requirements in the PDFs.   

---

## 11. What the deployed app must show in final state

In the settled final state, the app must be able to show:

* all investors settled
* final cap table
* ownership allocated
* active LP count
* each LP’s token balance
* governing LPA hash
* payment confirmation reference
* contract address
* transaction history
* timestamps for every major process
* waterfall configuration and output
* audit export controls

This is the direct final dashboard requirement. 

---

## 12. Verification checklist for Claude Code

Claude Code should treat the implementation as correct only if the following are true:

1. **There is a deployed React + Vite app on Vercel with an institutional, non-crypto UI.** 
2. **There is a canonical off-chain data layer equivalent to the PDF’s subscription ledger, event log, capital accounts, and audit metadata, now implemented in Supabase.** 
3. **The app supports Master LPA upload, parsing, SHA-256 hashing, timestamping, and governing-agreement registration.** 
4. **The app creates Pending subscription records per investor tied to the LPA and wallet.** 
5. **The app distinguishes verified LP wallets from unapproved wallets using fund-specific eligibility logic.** 
6. **Settlement is validated using amount, identity, and subscription/deal reference matching.** 
7. **Successful settlement changes Pending to Settled and triggers authorized minting.**  
8. **Mismatched settlement keeps ownership pending and blocks minting.** 
9. **The token contract on testnet is ERC-3643-based or behaviorally equivalent for permissioned ownership.** 
10. **Illegal transfer to an unapproved wallet fails deterministically on-chain.** 
11. **Legal LP-to-LP transfer succeeds and updates cap table, history, balances, capital accounts, and event logs.** 
12. **The fund dashboard shows fund overview, LP count, cap table, ownership timeline, and history.** 
13. **Clicking an LP shows ownership percentage, wallet, settlement timestamp, token balance, LPA hash, subscription ID, and payment reference.** 
14. **There is a structured waterfall/distribution module driven by settled ownership and capital accounts, not ad hoc spreadsheet math.**  
15. **There is an event-and-evidence log with provenance, hashes, timestamps, and immutable references.** 
16. **There is an audit/export interface that can output the required records and proofs.**  

---

## 13. One-paragraph SSOT summary

**Angainor, in its deployed form, is a Vercel-hosted React + Vite application backed by Supabase and the Sepolia testnet that ingests a Master LPA, computes and stores its SHA-256 provenance record, maps verified investors to fund-specific eligible wallets, creates Pending subscription records, validates payment evidence through a 3-way match, mints ERC-3643-based ownership only after settlement succeeds, enforces transfer restrictions on-chain so unapproved recipients are blocked deterministically, mirrors ownership and evidence into a canonical off-chain ledger with capital accounts and waterfall logic, and exposes all of this through a clean institutional dashboard with cap tables, histories, settlement states, distributions, and audit-ready exports.** This preserves the exact business behavior described in the PDFs while adapting the infrastructure from local demo tooling to Vercel, Supabase, and testnet deployment.   

