-- Add admin-customizable subject + markdown body to notices.
-- Backwards compatible: legacy rows render through the original pdf-lib path
-- when body_markdown is null.

ALTER TABLE "notices"
  ADD COLUMN IF NOT EXISTS "subject" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "body_markdown" TEXT,
  ADD COLUMN IF NOT EXISTS "template_key" VARCHAR(64);
