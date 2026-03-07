-- CreateTable
CREATE TABLE "wallet_link_challenges" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "investor_id" TEXT,
    "chain_id" INTEGER NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "wallet_address_norm" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_ip" TEXT,
    "created_user_agent" TEXT,

    CONSTRAINT "wallet_link_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_link_challenges_nonce_key" ON "wallet_link_challenges"("nonce");

-- CreateIndex
CREATE INDEX "wallet_link_challenges_auth_user_id_created_at_idx" ON "wallet_link_challenges"("auth_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_link_challenges_wallet_address_norm_chain_id_idx" ON "wallet_link_challenges"("wallet_address_norm", "chain_id");

-- CreateIndex
CREATE INDEX "wallet_link_challenges_expires_at_idx" ON "wallet_link_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "wallet_link_challenges" ADD CONSTRAINT "wallet_link_challenges_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
