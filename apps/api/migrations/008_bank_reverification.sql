-- Renewal creates a new immutable bank intent; preserve the earlier details/evidence.
ALTER TABLE bank_destinations
 ADD COLUMN replaces_destination_id uuid UNIQUE REFERENCES bank_destinations(id),
 ADD COLUMN identity_revision bigint CHECK (identity_revision BETWEEN 0 AND 9007199254740991),
 ADD CONSTRAINT bank_reverification_not_self CHECK (replaces_destination_id IS NULL OR replaces_destination_id<>id);
ALTER TABLE bank_destinations DROP CONSTRAINT bank_destinations_user_id_account_fingerprint_key;
CREATE UNIQUE INDEX bank_destination_current_account
 ON bank_destinations(user_id,account_fingerprint) WHERE status<>'inactive';
