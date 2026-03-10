-- CreateTable
CREATE TABLE "capital_calls" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "call_number" INTEGER NOT NULL,
    "amount_due" DECIMAL(20,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "due_date" TIMESTAMPTZ NOT NULL,
    "wire_instructions" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "capital_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_call_responses" (
    "id" TEXT NOT NULL,
    "capital_call_id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "amount_received" DECIMAL(20,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "wire_document_id" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_call_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "recipient_investor_id" TEXT NOT NULL,
    "capital_call_id" TEXT,
    "distribution_run_id" TEXT,
    "document_hash" VARCHAR(128),
    "anchor_tx_hash" VARCHAR(66),
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_deliveries" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'GENERATED',
    "sent_at" TIMESTAMPTZ,
    "opened_at" TIMESTAMPTZ,
    "downloaded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_reports" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "tax_entity_name" VARCHAR(255) NOT NULL,
    "ordinary_income" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "return_of_capital" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "ltcg" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "stcg" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "total_distributions" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capital_calls_fund_id_status_idx" ON "capital_calls"("fund_id", "status");

-- CreateIndex
CREATE INDEX "capital_calls_fund_id_due_date_idx" ON "capital_calls"("fund_id", "due_date" DESC);

-- CreateIndex
CREATE INDEX "capital_call_responses_capital_call_id_idx" ON "capital_call_responses"("capital_call_id");

-- CreateIndex
CREATE INDEX "capital_call_responses_investor_id_idx" ON "capital_call_responses"("investor_id");

-- CreateIndex
CREATE INDEX "notices_fund_id_type_idx" ON "notices"("fund_id", "type");

-- CreateIndex
CREATE INDEX "notices_recipient_investor_id_idx" ON "notices"("recipient_investor_id");

-- CreateIndex
CREATE INDEX "notice_deliveries_notice_id_idx" ON "notice_deliveries"("notice_id");

-- CreateIndex
CREATE INDEX "notice_deliveries_status_idx" ON "notice_deliveries"("status");

-- CreateIndex
CREATE INDEX "tax_reports_investor_id_idx" ON "tax_reports"("investor_id");

-- CreateIndex
CREATE INDEX "tax_reports_fund_id_tax_year_idx" ON "tax_reports"("fund_id", "tax_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_reports_investor_id_fund_id_tax_year_key" ON "tax_reports"("investor_id", "fund_id", "tax_year");

-- AddForeignKey
ALTER TABLE "capital_calls" ADD CONSTRAINT "capital_calls_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_call_responses" ADD CONSTRAINT "capital_call_responses_capital_call_id_fkey" FOREIGN KEY ("capital_call_id") REFERENCES "capital_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_call_responses" ADD CONSTRAINT "capital_call_responses_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_call_responses" ADD CONSTRAINT "capital_call_responses_wire_document_id_fkey" FOREIGN KEY ("wire_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_recipient_investor_id_fkey" FOREIGN KEY ("recipient_investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_capital_call_id_fkey" FOREIGN KEY ("capital_call_id") REFERENCES "capital_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_deliveries" ADD CONSTRAINT "notice_deliveries_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reports" ADD CONSTRAINT "tax_reports_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reports" ADD CONSTRAINT "tax_reports_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
