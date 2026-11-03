CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, phone text UNIQUE,
 password_hash text NOT NULL, country text NOT NULL CHECK (country IN ('NG','GH','ZA','KE')),
 role text NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
 email_verified boolean NOT NULL DEFAULT false, phone_verified boolean NOT NULL DEFAULT false,
 kyc_status text NOT NULL DEFAULT 'not_started' CHECK(kyc_status IN ('not_started','pending','approved','restricted')),
 restricted boolean NOT NULL DEFAULT false, failed_logins integer NOT NULL DEFAULT 0,
 locked_until timestamptz, mfa_secret text, mfa_pending text, last_totp_step bigint NOT NULL DEFAULT -1,
 policy_version text, policy_accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL UNIQUE,
 mfa_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, user_agent text NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE challenges (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), purpose text NOT NULL,
 digest text NOT NULL, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_user ON challenges(user_id,purpose);
CREATE TABLE recovery_codes (
 user_id uuid NOT NULL REFERENCES users(id), digest text NOT NULL, used_at timestamptz,
 PRIMARY KEY(user_id,digest)
);
CREATE TABLE step_ups (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id), purpose text NOT NULL,
 operation_digest text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid REFERENCES users(id),
 action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (
 key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE TABLE delivery_outbox (
 id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), channel text NOT NULL,
 payload text NOT NULL, status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE INDEX delivery_pending ON delivery_outbox(status,next_attempt_at);
