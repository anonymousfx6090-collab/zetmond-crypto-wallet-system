-- Link new verification/reset emails to their challenge so superseded codes stop sending.
-- Existing messages keep their original expiry and are not assigned an invented challenge.
ALTER TABLE delivery_outbox
 ADD COLUMN challenge_id uuid REFERENCES challenges(id),
 ADD COLUMN last_error_code text CHECK (length(last_error_code) <= 80);
CREATE INDEX delivery_challenge ON delivery_outbox(challenge_id)
 WHERE challenge_id IS NOT NULL;
