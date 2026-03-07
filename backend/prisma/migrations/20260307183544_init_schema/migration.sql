-- CreateTable
CREATE TABLE "funds" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_form" TEXT NOT NULL DEFAULT 'LP',
    "jurisdiction_code" TEXT,
    "base_currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "created_by" TEXT,
    "updated_by" TEXT,
    "row_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL,
    "external_ref" TEXT,
    "legal_name" TEXT NOT NULL,
    "email" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "verification_provider" TEXT,
    "verified_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "created_by" TEXT,
    "updated_by" TEXT,
    "row_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "investors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "address_norm" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "wallet_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_fund_eligibility" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "eligibility_status" TEXT NOT NULL DEFAULT 'NOT_SET',
    "effective_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "investor_fund_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'LOCAL_FS',
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parse_status" TEXT NOT NULL DEFAULT 'QUEUED',
    "linked_entity_type" TEXT,
    "linked_entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_hashes" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "hash_algorithm" TEXT NOT NULL DEFAULT 'SHA256',
    "hash_hex" CHAR(64) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anchored_onchain" BOOLEAN NOT NULL DEFAULT false,
    "anchor_chain_id" INTEGER,
    "anchor_tx_hash" TEXT,
    "anchor_block_number" BIGINT,
    "anchor_confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_hashes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_document_fields" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "extraction_run_ref" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "field_path" TEXT,
    "field_value_text" TEXT,
    "field_value_numeric" DECIMAL(30,10),
    "field_value_date" DATE,
    "field_value_json" JSONB,
    "normalized_value" TEXT,
    "confidence" DECIMAL(5,4),
    "source_page" INTEGER,
    "source_bbox" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_document_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "subscription_ref" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "governing_document_id" TEXT NOT NULL,
    "governing_hash_id" TEXT NOT NULL,
    "allocation_pct" DECIMAL(9,6) NOT NULL,
    "committed_amount" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pending_reason" TEXT,
    "settled_at" TIMESTAMPTZ,
    "rejected_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_records" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "validator_version" TEXT,
    "expected_amount" DECIMAL(20,2) NOT NULL,
    "received_amount" DECIMAL(20,2),
    "expected_currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "received_currency" CHAR(3),
    "check_amount_match" BOOLEAN,
    "check_investor_match" BOOLEAN,
    "check_reference_match" BOOLEAN,
    "check_hash_match" BOOLEAN,
    "check_no_double_settlement" BOOLEAN,
    "failure_reason_code" TEXT,
    "failure_reason_text" TEXT,
    "validated_at" TIMESTAMPTZ,
    "validated_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_evidence" (
    "id" TEXT NOT NULL,
    "settlement_record_id" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "document_id" TEXT,
    "document_hash_id" TEXT,
    "external_reference" TEXT,
    "provided_by" TEXT,
    "provided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "settlement_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_contracts" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "contract_address" TEXT NOT NULL,
    "contract_address_norm" TEXT NOT NULL,
    "token_standard" TEXT NOT NULL DEFAULT 'ERC-3643',
    "deployment_status" TEXT NOT NULL DEFAULT 'NOT_DEPLOYED',
    "deployment_tx_hash" TEXT,
    "deployed_block_number" BIGINT,
    "deployed_at" TIMESTAMPTZ,
    "identity_registry_address" TEXT,
    "transfer_restrictions_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "token_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_position_events" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "token_contract_id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" TIMESTAMPTZ NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "log_index" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_wallet_address" TEXT,
    "to_wallet_address" TEXT,
    "token_amount" DECIMAL(38,18) NOT NULL,
    "related_subscription_id" TEXT,
    "related_transfer_request_id" TEXT,
    "ingest_status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "raw_event" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_position_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_positions" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "token_contract_id" TEXT NOT NULL,
    "wallet_id" TEXT,
    "wallet_address" TEXT NOT NULL,
    "wallet_address_norm" TEXT NOT NULL,
    "settled_token_balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "last_event_id" TEXT,
    "as_of_block_number" BIGINT,
    "as_of_timestamp" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_snapshots" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "token_contract_id" TEXT,
    "snapshot_type" TEXT NOT NULL DEFAULT 'ON_DEMAND',
    "as_of_block_number" BIGINT,
    "as_of_timestamp" TIMESTAMPTZ NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'EVENTS_REBUILD',
    "generated_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_snapshot_rows" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "investor_id" TEXT,
    "wallet_id" TEXT,
    "wallet_address" TEXT NOT NULL,
    "settled_token_balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "ownership_pct" DECIMAL(9,6),
    "pending_allocation_pct" DECIMAL(9,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_snapshot_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_requests" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "token_contract_id" TEXT NOT NULL,
    "requested_by" TEXT,
    "correlation_id" TEXT,
    "from_wallet_id" TEXT,
    "from_wallet_address" TEXT NOT NULL,
    "to_wallet_id" TEXT,
    "to_wallet_address" TEXT NOT NULL,
    "token_amount" DECIMAL(38,18) NOT NULL,
    "request_status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "precheck_passed" BOOLEAN,
    "precheck_reason_code" TEXT,
    "precheck_reason_text" TEXT,
    "submitted_tx_hash" TEXT,
    "submitted_at" TIMESTAMPTZ,
    "finalized_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_events" (
    "id" TEXT NOT NULL,
    "transfer_request_id" TEXT,
    "fund_id" TEXT NOT NULL,
    "token_contract_id" TEXT,
    "event_kind" TEXT NOT NULL,
    "tx_hash" TEXT,
    "block_number" BIGINT,
    "block_timestamp" TIMESTAMPTZ,
    "reason_code" TEXT,
    "reason_text" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_accounts" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "opening_balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "initial_contribution" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "contributed_at" TIMESTAMPTZ,
    "capital_returned" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "accrued_pref" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "residual_allocation" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "ending_capital_balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "as_of_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "capital_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterfall_configs" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "derived_from_document_hash_id" TEXT,
    "calculation_basis" TEXT NOT NULL DEFAULT 'IRR',
    "distribution_frequency" TEXT NOT NULL DEFAULT 'QUARTERLY',
    "catch_up_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gp_promote_pct" DECIMAL(9,6),
    "pref_return_pct" DECIMAL(9,6),
    "rules_json" JSONB NOT NULL,
    "effective_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retired_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "waterfall_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterfall_tiers" (
    "id" TEXT NOT NULL,
    "waterfall_config_id" TEXT NOT NULL,
    "tier_order" SMALLINT NOT NULL,
    "tier_name" TEXT NOT NULL,
    "hurdle_type" TEXT NOT NULL DEFAULT 'NONE',
    "hurdle_value" DECIMAL(18,6),
    "lp_share_pct" DECIMAL(9,6) NOT NULL,
    "gp_share_pct" DECIMAL(9,6) NOT NULL,
    "catch_up" BOOLEAN NOT NULL DEFAULT false,
    "rules_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterfall_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_runs" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "waterfall_config_id" TEXT NOT NULL,
    "ownership_snapshot_id" TEXT NOT NULL,
    "run_status" TEXT NOT NULL DEFAULT 'QUEUED',
    "as_of_timestamp" TIMESTAMPTZ NOT NULL,
    "triggered_by" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "total_gross_amount" DECIMAL(20,2),
    "total_net_amount" DECIMAL(20,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "failure_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distribution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_line_items" (
    "id" TEXT NOT NULL,
    "distribution_run_id" TEXT NOT NULL,
    "investor_id" TEXT NOT NULL,
    "wallet_id" TEXT,
    "capital_account_id" TEXT,
    "gross_amount" DECIMAL(20,2) NOT NULL,
    "net_amount" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "ownership_pct_used" DECIMAL(9,6),
    "pref_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "return_of_capital_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "promote_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "tier_breakdown" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distribution_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_exports" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL DEFAULT 'AUDIT_PACKET',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "requested_by" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "artifact_storage_provider" TEXT NOT NULL DEFAULT 'LOCAL_FS',
    "artifact_path" TEXT,
    "manifest_json" JSONB NOT NULL DEFAULT '{}',
    "checksum_sha256" CHAR(64),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_event_log" (
    "id" BIGSERIAL NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT,
    "fund_id" TEXT,
    "source_context" TEXT NOT NULL,
    "correlation_id" TEXT,
    "causation_id" TEXT,
    "idempotency_key" TEXT,
    "payload_json" JSONB NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "chain_id" INTEGER,
    "tx_hash" TEXT,
    "block_number" BIGINT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_replayed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "system_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "locked_by" TEXT,
    "locked_at" TIMESTAMPTZ,
    "scheduled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs_dead_letter" (
    "id" TEXT NOT NULL,
    "original_job_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "failed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_dead_letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funds_code_key" ON "funds"("code");

-- CreateIndex
CREATE UNIQUE INDEX "investors_external_ref_key" ON "investors"("external_ref");

-- CreateIndex
CREATE INDEX "wallets_investor_id_chain_id_idx" ON "wallets"("investor_id", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_chain_id_address_norm_key" ON "wallets"("chain_id", "address_norm");

-- CreateIndex
CREATE INDEX "investor_fund_eligibility_fund_id_eligibility_status_idx" ON "investor_fund_eligibility"("fund_id", "eligibility_status");

-- CreateIndex
CREATE UNIQUE INDEX "investor_fund_eligibility_fund_id_wallet_id_key" ON "investor_fund_eligibility"("fund_id", "wallet_id");

-- CreateIndex
CREATE INDEX "documents_fund_id_document_type_uploaded_at_idx" ON "documents"("fund_id", "document_type", "uploaded_at" DESC);

-- CreateIndex
CREATE INDEX "document_hashes_anchor_tx_hash_idx" ON "document_hashes"("anchor_tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "document_hashes_hash_algorithm_hash_hex_key" ON "document_hashes"("hash_algorithm", "hash_hex");

-- CreateIndex
CREATE INDEX "extracted_document_fields_document_id_field_name_idx" ON "extracted_document_fields"("document_id", "field_name");

-- CreateIndex
CREATE INDEX "extracted_document_fields_extraction_run_ref_idx" ON "extracted_document_fields"("extraction_run_ref");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_subscription_ref_key" ON "subscriptions"("subscription_ref");

-- CreateIndex
CREATE INDEX "subscriptions_fund_id_status_idx" ON "subscriptions"("fund_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_investor_id_status_idx" ON "subscriptions"("investor_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_wallet_id_idx" ON "subscriptions"("wallet_id");

-- CreateIndex
CREATE INDEX "settlement_records_subscription_id_status_created_at_idx" ON "settlement_records"("subscription_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "settlement_evidence_settlement_record_id_evidence_type_idx" ON "settlement_evidence"("settlement_record_id", "evidence_type");

-- CreateIndex
CREATE INDEX "token_contracts_fund_id_chain_id_idx" ON "token_contracts"("fund_id", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_contracts_chain_id_contract_address_norm_key" ON "token_contracts"("chain_id", "contract_address_norm");

-- CreateIndex
CREATE INDEX "token_position_events_token_contract_id_block_number_log_in_idx" ON "token_position_events"("token_contract_id", "block_number" DESC, "log_index" DESC);

-- CreateIndex
CREATE INDEX "token_position_events_fund_id_block_timestamp_idx" ON "token_position_events"("fund_id", "block_timestamp" DESC);

-- CreateIndex
CREATE INDEX "token_position_events_to_wallet_address_idx" ON "token_position_events"("to_wallet_address");

-- CreateIndex
CREATE INDEX "token_position_events_from_wallet_address_idx" ON "token_position_events"("from_wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "token_position_events_chain_id_tx_hash_log_index_key" ON "token_position_events"("chain_id", "tx_hash", "log_index");

-- CreateIndex
CREATE INDEX "token_positions_fund_id_settled_token_balance_idx" ON "token_positions"("fund_id", "settled_token_balance" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "token_positions_token_contract_id_wallet_address_norm_key" ON "token_positions"("token_contract_id", "wallet_address_norm");

-- CreateIndex
CREATE INDEX "ownership_snapshots_fund_id_as_of_timestamp_idx" ON "ownership_snapshots"("fund_id", "as_of_timestamp" DESC);

-- CreateIndex
CREATE INDEX "ownership_snapshot_rows_snapshot_id_ownership_pct_idx" ON "ownership_snapshot_rows"("snapshot_id", "ownership_pct" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ownership_snapshot_rows_snapshot_id_wallet_address_key" ON "ownership_snapshot_rows"("snapshot_id", "wallet_address");

-- CreateIndex
CREATE INDEX "transfer_requests_fund_id_request_status_created_at_idx" ON "transfer_requests"("fund_id", "request_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transfer_requests_submitted_tx_hash_idx" ON "transfer_requests"("submitted_tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_requests_correlation_id_key" ON "transfer_requests"("correlation_id");

-- CreateIndex
CREATE INDEX "transfer_events_transfer_request_id_created_at_idx" ON "transfer_events"("transfer_request_id", "created_at");

-- CreateIndex
CREATE INDEX "transfer_events_fund_id_created_at_idx" ON "transfer_events"("fund_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transfer_events_tx_hash_idx" ON "transfer_events"("tx_hash");

-- CreateIndex
CREATE INDEX "capital_accounts_fund_id_as_of_date_idx" ON "capital_accounts"("fund_id", "as_of_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "capital_accounts_fund_id_investor_id_is_current_key" ON "capital_accounts"("fund_id", "investor_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "waterfall_configs_fund_id_version_key" ON "waterfall_configs"("fund_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "waterfall_tiers_waterfall_config_id_tier_order_key" ON "waterfall_tiers"("waterfall_config_id", "tier_order");

-- CreateIndex
CREATE INDEX "distribution_runs_fund_id_run_status_created_at_idx" ON "distribution_runs"("fund_id", "run_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "distribution_line_items_distribution_run_id_gross_amount_idx" ON "distribution_line_items"("distribution_run_id", "gross_amount" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "distribution_line_items_distribution_run_id_investor_id_wal_key" ON "distribution_line_items"("distribution_run_id", "investor_id", "wallet_id");

-- CreateIndex
CREATE INDEX "audit_exports_fund_id_status_requested_at_idx" ON "audit_exports"("fund_id", "status", "requested_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "system_event_log_event_id_key" ON "system_event_log"("event_id");

-- CreateIndex
CREATE INDEX "system_event_log_event_type_occurred_at_idx" ON "system_event_log"("event_type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "system_event_log_aggregate_type_aggregate_id_occurred_at_idx" ON "system_event_log"("aggregate_type", "aggregate_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "system_event_log_fund_id_occurred_at_idx" ON "system_event_log"("fund_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "system_event_log_tx_hash_idx" ON "system_event_log"("tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "system_event_log_idempotency_key_key" ON "system_event_log"("idempotency_key");

-- CreateIndex
CREATE INDEX "jobs_status_priority_scheduled_at_idx" ON "jobs"("status", "priority" DESC, "scheduled_at");

-- CreateIndex
CREATE INDEX "jobs_job_type_status_idx" ON "jobs"("job_type", "status");

-- CreateIndex
CREATE INDEX "jobs_dead_letter_job_type_failed_at_idx" ON "jobs_dead_letter"("job_type", "failed_at" DESC);

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_fund_eligibility" ADD CONSTRAINT "investor_fund_eligibility_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_fund_eligibility" ADD CONSTRAINT "investor_fund_eligibility_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_fund_eligibility" ADD CONSTRAINT "investor_fund_eligibility_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_hashes" ADD CONSTRAINT "document_hashes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_document_fields" ADD CONSTRAINT "extracted_document_fields_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_governing_document_id_fkey" FOREIGN KEY ("governing_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_governing_hash_id_fkey" FOREIGN KEY ("governing_hash_id") REFERENCES "document_hashes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_records" ADD CONSTRAINT "settlement_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_evidence" ADD CONSTRAINT "settlement_evidence_settlement_record_id_fkey" FOREIGN KEY ("settlement_record_id") REFERENCES "settlement_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_evidence" ADD CONSTRAINT "settlement_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_evidence" ADD CONSTRAINT "settlement_evidence_document_hash_id_fkey" FOREIGN KEY ("document_hash_id") REFERENCES "document_hashes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_contracts" ADD CONSTRAINT "token_contracts_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_position_events" ADD CONSTRAINT "token_position_events_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_position_events" ADD CONSTRAINT "token_position_events_token_contract_id_fkey" FOREIGN KEY ("token_contract_id") REFERENCES "token_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_position_events" ADD CONSTRAINT "token_position_events_related_subscription_id_fkey" FOREIGN KEY ("related_subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_position_events" ADD CONSTRAINT "token_position_events_related_transfer_request_id_fkey" FOREIGN KEY ("related_transfer_request_id") REFERENCES "transfer_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_positions" ADD CONSTRAINT "token_positions_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_positions" ADD CONSTRAINT "token_positions_token_contract_id_fkey" FOREIGN KEY ("token_contract_id") REFERENCES "token_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_positions" ADD CONSTRAINT "token_positions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_positions" ADD CONSTRAINT "token_positions_last_event_id_fkey" FOREIGN KEY ("last_event_id") REFERENCES "token_position_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_snapshots" ADD CONSTRAINT "ownership_snapshots_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_snapshots" ADD CONSTRAINT "ownership_snapshots_token_contract_id_fkey" FOREIGN KEY ("token_contract_id") REFERENCES "token_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_snapshot_rows" ADD CONSTRAINT "ownership_snapshot_rows_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "ownership_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_snapshot_rows" ADD CONSTRAINT "ownership_snapshot_rows_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_snapshot_rows" ADD CONSTRAINT "ownership_snapshot_rows_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_token_contract_id_fkey" FOREIGN KEY ("token_contract_id") REFERENCES "token_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_from_wallet_id_fkey" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_to_wallet_id_fkey" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_request_id_fkey" FOREIGN KEY ("transfer_request_id") REFERENCES "transfer_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_token_contract_id_fkey" FOREIGN KEY ("token_contract_id") REFERENCES "token_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_accounts" ADD CONSTRAINT "capital_accounts_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_accounts" ADD CONSTRAINT "capital_accounts_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterfall_configs" ADD CONSTRAINT "waterfall_configs_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterfall_configs" ADD CONSTRAINT "waterfall_configs_derived_from_document_hash_id_fkey" FOREIGN KEY ("derived_from_document_hash_id") REFERENCES "document_hashes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterfall_tiers" ADD CONSTRAINT "waterfall_tiers_waterfall_config_id_fkey" FOREIGN KEY ("waterfall_config_id") REFERENCES "waterfall_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_waterfall_config_id_fkey" FOREIGN KEY ("waterfall_config_id") REFERENCES "waterfall_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_runs" ADD CONSTRAINT "distribution_runs_ownership_snapshot_id_fkey" FOREIGN KEY ("ownership_snapshot_id") REFERENCES "ownership_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_line_items" ADD CONSTRAINT "distribution_line_items_distribution_run_id_fkey" FOREIGN KEY ("distribution_run_id") REFERENCES "distribution_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_line_items" ADD CONSTRAINT "distribution_line_items_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_line_items" ADD CONSTRAINT "distribution_line_items_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_line_items" ADD CONSTRAINT "distribution_line_items_capital_account_id_fkey" FOREIGN KEY ("capital_account_id") REFERENCES "capital_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_exports" ADD CONSTRAINT "audit_exports_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_event_log" ADD CONSTRAINT "system_event_log_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
