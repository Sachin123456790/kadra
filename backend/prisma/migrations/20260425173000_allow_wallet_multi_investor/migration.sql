-- Allow the same wallet address to be linked to multiple investors.
-- Drop the cross-investor uniqueness on (chain_id, address_norm) and replace
-- with a per-investor uniqueness so a single investor still cannot duplicate
-- the same wallet on the same chain.

ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_chain_id_address_norm_key";
DROP INDEX IF EXISTS "wallets_chain_id_address_norm_key";

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_investor_id_chain_id_address_norm_key"
  ON "wallets" ("investor_id", "chain_id", "address_norm");

CREATE INDEX IF NOT EXISTS "wallets_chain_id_address_norm_idx"
  ON "wallets" ("chain_id", "address_norm");
