-- Document amendments + governing-doc versioning support.
-- Adds parent_document_id (self-referential FK), version, and effective_date columns.
-- Type vocabulary (LPA_AMENDMENT, SIDE_LETTER, JOINDER, etc.) is stored in the existing
-- document_type string column; no DB-level enum changes needed.

ALTER TABLE "documents"
  ADD COLUMN "parent_document_id" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "effective_date" TIMESTAMPTZ;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_parent_document_id_fkey"
  FOREIGN KEY ("parent_document_id") REFERENCES "documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "documents_parent_document_id_idx" ON "documents"("parent_document_id");
