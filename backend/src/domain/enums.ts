export enum FundStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}
export enum LegalForm {
  LP = 'LP',
  LLC = 'LLC',
  OTHER = 'OTHER',
}
export enum VerificationStatus {
  UNKNOWN = 'UNKNOWN',
  VERIFIED = 'VERIFIED',
  REVOKED = 'REVOKED',
}
export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}
export enum EligibilityStatus {
  NOT_SET = 'NOT_SET',
  ELIGIBLE = 'ELIGIBLE',
  REVOKED = 'REVOKED',
}
export enum DocumentType {
  MASTER_LPA = 'MASTER_LPA',
  LPA_AMENDMENT = 'LPA_AMENDMENT',
  SIDE_LETTER = 'SIDE_LETTER',
  JOINDER = 'JOINDER',
  ASSIGNMENT_AND_ASSUMPTION = 'ASSIGNMENT_AND_ASSUMPTION',
  SUBSCRIPTION_AGREEMENT = 'SUBSCRIPTION_AGREEMENT',
  SUBSCRIPTION_RECORD = 'SUBSCRIPTION_RECORD',
  WIRE_CONFIRMATION = 'WIRE_CONFIRMATION',
  PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
  GP_REPORT = 'GP_REPORT',
  INVESTOR_UPLOAD = 'INVESTOR_UPLOAD',
  CAPITAL_CALL_NOTICE = 'CAPITAL_CALL_NOTICE',
  DISTRIBUTION_NOTICE = 'DISTRIBUTION_NOTICE',
  OTHER = 'OTHER',
}

/**
 * Document types that govern fund terms (LPA stack).
 * These can be uploaded as governing documents and may have parent links
 * (e.g. an amendment references the Master LPA it modifies).
 */
export const GOVERNING_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  DocumentType.MASTER_LPA,
  DocumentType.LPA_AMENDMENT,
  DocumentType.SIDE_LETTER,
  DocumentType.JOINDER,
  DocumentType.ASSIGNMENT_AND_ASSUMPTION,
]);

/**
 * Document types that REQUIRE a parent document (they only make sense
 * as modifications to an existing governing document).
 */
export const AMENDS_PARENT_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  DocumentType.LPA_AMENDMENT,
  DocumentType.SIDE_LETTER,
  DocumentType.JOINDER,
  DocumentType.ASSIGNMENT_AND_ASSUMPTION,
]);
export enum StorageProvider {
  LOCAL_FS = 'LOCAL_FS',
  S3 = 'S3',
  SUPABASE = 'SUPABASE',
}
export enum ParseStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
export enum HashAlgorithm {
  SHA256 = 'SHA256',
}
export enum SubscriptionStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  SETTLED = 'SETTLED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}
export enum SettlementStatus {
  REQUESTED = 'REQUESTED',
  VERIFYING = 'VERIFYING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}
export enum SettlementFailureCode {
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  INVESTOR_MISMATCH = 'INVESTOR_MISMATCH',
  REFERENCE_MISMATCH = 'REFERENCE_MISMATCH',
  HASH_MISMATCH = 'HASH_MISMATCH',
  DOUBLE_SETTLEMENT = 'DOUBLE_SETTLEMENT',
  UNKNOWN = 'UNKNOWN',
}
export enum ContractDeploymentStatus {
  NOT_DEPLOYED = 'NOT_DEPLOYED',
  DEPLOYING = 'DEPLOYING',
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
}
export enum TokenEventType {
  MINT = 'MINT',
  TRANSFER = 'TRANSFER',
  BURN = 'BURN',
  ADJUSTMENT = 'ADJUSTMENT',
  SYNC = 'SYNC',
}
export enum TransferRequestStatus {
  REQUESTED = 'REQUESTED',
  PRECHECK_FAILED = 'PRECHECK_FAILED',
  SUBMITTED = 'SUBMITTED',
  MINED = 'MINED',
  CHAIN_REVERTED = 'CHAIN_REVERTED',
}
export enum TransferFailureCode {
  RECIPIENT_NOT_ELIGIBLE = 'RECIPIENT_NOT_ELIGIBLE',
  SENDER_NOT_ELIGIBLE = 'SENDER_NOT_ELIGIBLE',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  CONTRACT_REVERT = 'CONTRACT_REVERT',
  UNKNOWN = 'UNKNOWN',
}
export enum DistributionRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
export enum ExportStatus {
  QUEUED = 'QUEUED',
  BUILDING = 'BUILDING',
  READY = 'READY',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}
export enum WaterfallBasis {
  IRR = 'IRR',
  MULTIPLE = 'MULTIPLE',
}
export enum DistributionFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  MANUAL = 'MANUAL',
}
export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}
