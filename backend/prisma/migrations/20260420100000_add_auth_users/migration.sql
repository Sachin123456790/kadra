-- Local email/password identity store. Replaces Supabase Auth.
-- Passwords are bcrypt hashes. JWTs are signed locally with JWT_SECRET.

CREATE TABLE "auth_users" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"           TEXT NOT NULL UNIQUE,
  "password_hash"   TEXT NOT NULL,
  "role"            TEXT NOT NULL DEFAULT 'investor',
  "full_name"       TEXT,
  "email_verified"  BOOLEAN NOT NULL DEFAULT TRUE,
  "last_login_at"   TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"      TIMESTAMPTZ
);

CREATE INDEX "auth_users_email_idx" ON "auth_users" ("email");
CREATE INDEX "auth_users_role_idx"  ON "auth_users" ("role");
