-- Verification messages must not be delivered after their challenge expires.
ALTER TABLE delivery_outbox ADD COLUMN expires_at timestamptz;
