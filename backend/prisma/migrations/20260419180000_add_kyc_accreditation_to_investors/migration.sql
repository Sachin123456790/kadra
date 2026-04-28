-- Add first-class columns for KYC and accreditation status on investors.
-- Backfills existing rows with 'PENDING' default. No data migration needed
-- because prior values lived in metadata JSON and can be consulted via a
-- one-off SQL if you want to copy them over: UPDATE investors SET
-- kyc_status = COALESCE(metadata->>'kycStatus', 'PENDING'),
-- accreditation_status = COALESCE(metadata->>'accreditationStatus', 'PENDING');

ALTER TABLE "investors"
  ADD COLUMN "kyc_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "accreditation_status" TEXT NOT NULL DEFAULT 'PENDING';

-- Copy any values previously stored in metadata JSON into the new columns.
UPDATE "investors"
SET "kyc_status" = COALESCE(metadata->>'kycStatus', 'PENDING'),
    "accreditation_status" = COALESCE(metadata->>'accreditationStatus', 'PENDING');
