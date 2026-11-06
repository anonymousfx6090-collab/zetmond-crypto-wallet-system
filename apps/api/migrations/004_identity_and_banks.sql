-- Provider-neutral records. No provider or approval is enabled by this migration.
CREATE TABLE identity_cases (
 id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 current_attempt_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity_attempts (
 id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES identity_cases(id),
 provider text NOT NULL, mode text NOT NULL CHECK(mode IN ('sandbox','live')),
 country text NOT NULL CHECK(country IN ('NG','GH','ZA','KE')),
 status text NOT NULL CHECK(status IN ('submitting','incomplete','under_review','approved','correction_required','rejected')),
 revision bigint NOT NULL DEFAULT -1, capture_payload text, evidence_payload text,
 reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,id)
);
ALTER TABLE identity_cases ADD CONSTRAINT current_identity_attempt
 FOREIGN KEY(id,current_attempt_id) REFERENCES identity_attempts(case_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE bank_destinations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 identity_attempt_id uuid NOT NULL REFERENCES identity_attempts(id),
 provider text NOT NULL, mode text NOT NULL CHECK(mode IN ('sandbox','live')),
 country text NOT NULL CHECK(country IN ('NG','GH','ZA','KE')), currency text NOT NULL,
 details_payload text NOT NULL, account_fingerprint text NOT NULL, last_four text NOT NULL,
 bank_label text NOT NULL, operation_digest text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','verified','mismatch','unavailable','inactive')),
 revision bigint NOT NULL DEFAULT -1, evidence_payload text, reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,account_fingerprint)
);
CREATE TABLE verification_decisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id), target_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('identity','bank')), revision bigint NOT NULL,
 status text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(target_id,revision)
);
CREATE TABLE verification_events (
 provider text NOT NULL, mode text NOT NULL, event_id text NOT NULL,
 target_id uuid NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,mode,event_id)
);
CREATE TABLE verification_jobs (
 id uuid PRIMARY KEY, target_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('identity_start','identity_sync','bank_start','bank_sync')),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','failed')),
 generation integer NOT NULL DEFAULT 0, attempts integer NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, run_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(target_id,kind)
);
CREATE INDEX verification_jobs_due ON verification_jobs(state,run_at);
CREATE INDEX identity_attempts_case ON identity_attempts(case_id,created_at);
CREATE INDEX bank_destinations_owner ON bank_destinations(user_id,created_at);
