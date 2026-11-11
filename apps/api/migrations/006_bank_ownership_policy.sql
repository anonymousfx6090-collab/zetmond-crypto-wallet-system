-- Null pins retain historical records but cannot establish current ownership.
ALTER TABLE bank_destinations
 ADD COLUMN provider_policy_version text CHECK (length(provider_policy_version) BETWEEN 1 AND 80),
 ADD COLUMN name_match_policy text CHECK (length(name_match_policy) BETWEEN 1 AND 80);
ALTER TABLE bank_destinations DROP CONSTRAINT bank_destinations_status_check;
ALTER TABLE bank_destinations ADD CONSTRAINT bank_destinations_status_check
 CHECK(status IN ('pending','under_review','verified','mismatch','unavailable','inactive'));
