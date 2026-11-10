-- Credentials/candidate evidence are encrypted. Browser hints never become decisions.
ALTER TABLE identity_attempts ADD COLUMN disclosure_version text;
ALTER TABLE identity_attempts ADD COLUMN disclosure_url text;
ALTER TABLE identity_attempts ADD COLUMN consented_at timestamptz;
CREATE TABLE smile_identity_sessions (
 attempt_id uuid PRIMARY KEY REFERENCES identity_attempts(id),
 provider_user_id text NOT NULL, mode text NOT NULL CHECK(mode IN ('sandbox','live')),
 credential_digest text NOT NULL, scope_digest text NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','minting','issued','uncertain','submitted')),
 token_payload text, token_expires_at timestamptz, mint_lease uuid, mint_until timestamptz,
 job_id text, hint_job_id text,
 revision bigint NOT NULL DEFAULT 0, checkpoint_payload text NOT NULL,
 checkpoint_digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE smile_identity_replays (
 attempt_id uuid NOT NULL REFERENCES smile_identity_sessions(attempt_id),
 job_id text NOT NULL, vendor_status text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','unknown','rejected')),
 lease_token uuid, lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(attempt_id,job_id,vendor_status)
);
CREATE UNIQUE INDEX smile_job_owner ON smile_identity_sessions(mode,job_id) WHERE job_id IS NOT NULL;
CREATE TABLE smile_identity_callbacks (
 attempt_id uuid NOT NULL REFERENCES smile_identity_sessions(attempt_id),
 job_id text NOT NULL, core_digest text NOT NULL, result_payload text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(attempt_id,core_digest)
);
