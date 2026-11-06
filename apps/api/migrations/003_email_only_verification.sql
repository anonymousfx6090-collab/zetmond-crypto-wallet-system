-- Retire pending phone verification without changing any user's verification flags.
UPDATE challenges SET consumed_at=now()
WHERE purpose='phone' AND consumed_at IS NULL;

-- Do not deliver SMS queued by an older application version.
UPDATE delivery_outbox SET status='cancelled',payload=''
WHERE channel='sms' AND status IN ('queued','failed','held');
