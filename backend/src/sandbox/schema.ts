// Separate namespace: the interactive sandbox never exposes legacy global-role routes.
export const schema = `
CREATE TABLE IF NOT EXISTS sb_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sb_organizations (
 id uuid PRIMARY KEY, name text NOT NULL, generation integer NOT NULL DEFAULT 1 CHECK(generation>0)
);
CREATE TABLE IF NOT EXISTS sb_memberships (
 org_id uuid NOT NULL REFERENCES sb_organizations(id), user_id uuid NOT NULL REFERENCES sb_users(id),
 role text NOT NULL CHECK(role IN ('owner','editor','reviewer','approver','reader')), PRIMARY KEY(org_id,user_id)
);
CREATE TABLE IF NOT EXISTS sb_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES sb_users(id), org_id uuid NOT NULL REFERENCES sb_organizations(id),
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sb_funds (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES sb_organizations(id), generation integer NOT NULL,
 name text NOT NULL, currency char(3) NOT NULL CHECK(currency='USD'), synthetic boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
CREATE TABLE IF NOT EXISTS sb_records (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('investor','spv','property','financial')),
 data jsonb NOT NULL, amount numeric(20,2), revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,fund_id,id),
 FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id)
);
ALTER TABLE sb_funds ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS sb_documents (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, logical_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 filename text NOT NULL, mime text NOT NULL, document_type text NOT NULL, effective_date date,
 content bytea NOT NULL, sha256 char(64) NOT NULL, synthetic boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'QUEUED', error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(org_id,fund_id,id), UNIQUE(org_id,logical_id,version), FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id)
);
CREATE TABLE IF NOT EXISTS sb_sources (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, document_id uuid NOT NULL,
 locator jsonb NOT NULL, text text NOT NULL, UNIQUE(org_id,fund_id,id),
 FOREIGN KEY(org_id,fund_id,document_id) REFERENCES sb_documents(org_id,fund_id,id)
);
ALTER TABLE sb_documents ADD COLUMN IF NOT EXISTS rendition bytea;
CREATE TABLE IF NOT EXISTS sb_facts (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, document_id uuid NOT NULL,
 taxonomy_key text NOT NULL, value jsonb, source_id uuid, state text NOT NULL, taxonomy_version text NOT NULL,
 extraction jsonb NOT NULL, decision jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,fund_id,document_id) REFERENCES sb_documents(org_id,fund_id,id),
 FOREIGN KEY(org_id,fund_id,source_id) REFERENCES sb_sources(org_id,fund_id,id)
);
CREATE TABLE IF NOT EXISTS sb_rulebooks (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, version integer NOT NULL,
 rules jsonb NOT NULL, hash char(64) NOT NULL, actor_id uuid NOT NULL REFERENCES sb_users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,fund_id,version),
 FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id)
);
CREATE TABLE IF NOT EXISTS sb_calls (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, number integer NOT NULL,
 amount numeric(20,2) NOT NULL CHECK(amount>0), purpose text NOT NULL, as_of date NOT NULL, due_date date NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT', revision integer NOT NULL DEFAULT 1, created_by uuid NOT NULL REFERENCES sb_users(id),
 UNIQUE(org_id,fund_id,id), UNIQUE(org_id,fund_id,number), FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id)
);
CREATE TABLE IF NOT EXISTS sb_runs (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, call_id uuid, kind text NOT NULL,
 input jsonb NOT NULL, result jsonb NOT NULL, input_hash char(64) NOT NULL, result_hash char(64) NOT NULL,
 status text NOT NULL, created_by uuid NOT NULL REFERENCES sb_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(org_id,fund_id,id), FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id),
 FOREIGN KEY(org_id,fund_id,call_id) REFERENCES sb_calls(org_id,fund_id,id)
);
CREATE TABLE IF NOT EXISTS sb_approvals (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, run_id uuid NOT NULL UNIQUE,
 actor_id uuid NOT NULL REFERENCES sb_users(id), input_hash char(64) NOT NULL, result_hash char(64) NOT NULL,
 decision text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,fund_id,run_id) REFERENCES sb_runs(org_id,fund_id,id)
);
CREATE TABLE IF NOT EXISTS sb_answers (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, question text NOT NULL,
 answer jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES sb_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id)
);
CREATE TABLE IF NOT EXISTS sb_conversations (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, title text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,fund_id,id),
 FOREIGN KEY(org_id,fund_id) REFERENCES sb_funds(org_id,id)
);
ALTER TABLE sb_answers ADD COLUMN IF NOT EXISTS conversation_id uuid;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='sb_answer_conversation') THEN
  ALTER TABLE sb_answers ADD CONSTRAINT sb_answer_conversation FOREIGN KEY(org_id,fund_id,conversation_id) REFERENCES sb_conversations(org_id,fund_id,id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS sb_artifacts (
 id uuid PRIMARY KEY,org_id uuid NOT NULL,fund_id uuid NOT NULL,run_id uuid NOT NULL,
 filename text NOT NULL,mime text NOT NULL,content bytea NOT NULL,sha256 char(64) NOT NULL,
 FOREIGN KEY(org_id,fund_id,run_id) REFERENCES sb_runs(org_id,fund_id,id)
);
CREATE TABLE IF NOT EXISTS sb_jobs (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, fund_id uuid NOT NULL, document_id uuid NOT NULL,
 generation integer NOT NULL, status text NOT NULL DEFAULT 'QUEUED', attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, error text,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(org_id,fund_id,document_id) REFERENCES sb_documents(org_id,fund_id,id)
);
CREATE TABLE IF NOT EXISTS sb_events (
 id bigserial PRIMARY KEY, org_id uuid NOT NULL REFERENCES sb_organizations(id), fund_id uuid,
 actor_id uuid NOT NULL REFERENCES sb_users(id), action text NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sb_idempotency (
 org_id uuid NOT NULL REFERENCES sb_organizations(id), key text NOT NULL, request_hash char(64) NOT NULL,
 response jsonb NOT NULL, PRIMARY KEY(org_id,key)
);
CREATE INDEX IF NOT EXISTS sb_source_search ON sb_sources USING gin(to_tsvector('english',text));
CREATE INDEX IF NOT EXISTS sb_jobs_queue ON sb_jobs(status,available_at);
CREATE OR REPLACE FUNCTION sb_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'This record is append only'; END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sb_events','sb_approvals','sb_rulebooks','sb_answers','sb_sources'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname=t||'_immutable') THEN
   EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION sb_append_only()',t||'_immutable',t);
  END IF;
 END LOOP;
END $$;
DO $$ DECLARE t text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='angainor_sandbox') THEN
  CREATE ROLE angainor_sandbox NOLOGIN NOBYPASSRLS;
 END IF;
 FOREACH t IN ARRAY ARRAY['sb_funds','sb_records','sb_documents','sb_sources','sb_facts','sb_rulebooks','sb_calls','sb_runs','sb_approvals','sb_artifacts','sb_answers','sb_conversations','sb_jobs','sb_events','sb_idempotency'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='sandbox_tenant') THEN
   EXECUTE format('CREATE POLICY sandbox_tenant ON %I TO angainor_sandbox USING (org_id = nullif(current_setting(''angainor.org_id'',true),'''')::uuid) WITH CHECK (org_id = nullif(current_setting(''angainor.org_id'',true),'''')::uuid)',t);
  END IF;
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO angainor_sandbox',t);
 END LOOP;
END $$;
ALTER TABLE sb_organizations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='sb_organizations' AND policyname='sandbox_tenant') THEN
  CREATE POLICY sandbox_tenant ON sb_organizations TO angainor_sandbox USING(id=nullif(current_setting('angainor.org_id',true),'')::uuid);
 END IF;
END $$;
GRANT SELECT,UPDATE ON sb_organizations TO angainor_sandbox;
GRANT USAGE ON SEQUENCE sb_events_id_seq TO angainor_sandbox;
CREATE OR REPLACE FUNCTION sb_protect_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF TG_TABLE_NAME='sb_runs' AND (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') THEN
   RAISE EXCEPTION 'Calculation evidence is immutable';
  ELSIF TG_TABLE_NAME='sb_documents' AND (to_jsonb(NEW)-ARRAY['status','error','rendition']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','error','rendition']) THEN
   RAISE EXCEPTION 'Document version content is immutable';
  ELSIF TG_TABLE_NAME='sb_records' AND to_jsonb(OLD)->>'kind'='financial' THEN
   RAISE EXCEPTION 'Financial records are immutable; create a reversal';
  END IF;
  RETURN NEW;
 END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sb_runs','sb_documents','sb_records'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=t||'_evidence') THEN
   EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sb_protect_evidence()',t||'_evidence',t);
  END IF;
 END LOOP;
END $$;
`;
