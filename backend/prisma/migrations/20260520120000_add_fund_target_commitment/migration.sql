-- Fund target commitment: total capital the fund is raising.
-- Each LP's allocation % is derived as committed_amount / target_commitment * 100.
-- Nullable so existing funds without a documented total keep working.

ALTER TABLE "funds"
  ADD COLUMN IF NOT EXISTS "target_commitment" DECIMAL(20, 2);
