# Verification email delivery

Signup and resend queue an encrypted message in PostgreSQL. The `delivered`
status means the SMTP server accepted the recipient; it does not prove inbox
delivery. Spam filtering and later bounces can still prevent receipt.

## Diagnose the deployment

1. In Render's API logs, search for `Contact delivery failed`,
   `Delivery worker unavailable`, and `Email delivery:` near the signup time.
   These messages contain fixed categories/counts without recipients, codes,
   credentials, or provider response text. Successful-send counts require the
   reliability update below.
2. Ask the recipient to check Spam and All Mail for Zetmond and compare the email
   address shown on their verification screen with their intended address.
   Request another code once and use the most recent email.
3. Use Neon's SQL Editor if Render Shell is unavailable. These read-only queries
   inspect aggregate queue metadata without opening message bodies:

```sql
SELECT status, count(*) AS messages, max(attempts) AS highest_attempts,
       min(created_at) AS oldest_created_at
FROM delivery_outbox
WHERE channel='email' AND created_at>=now()-interval '24 hours'
GROUP BY status ORDER BY status;

SELECT count(*) AS due_unexpired_messages, min(created_at) AS oldest_created_at
FROM delivery_outbox
WHERE channel='email' AND status='queued' AND next_attempt_at<=now()
  AND (expires_at IS NULL OR expires_at>now());
```

After migration `007_email_delivery_reliability.sql` has applied, inspect fixed
failure categories rather than raw SMTP errors:

```sql
SELECT status, last_error_code, count(*) AS messages
FROM delivery_outbox
WHERE channel='email' AND created_at>=now()-interval '24 hours'
GROUP BY status,last_error_code ORDER BY status,last_error_code;
```

| Evidence                                               | Next check                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `smtp_authentication`                                  | Confirm the Gmail address and its Google App Password are configured on the Render service.                             |
| `smtp_timeout` or `smtp_connection`                    | Check the SMTP host/port, provider connectivity and whether the Render service plan permits outgoing SMTP on that port. |
| `smtp_tls`                                             | Check provider TLS configuration; keep certificate verification enabled.                                                |
| `smtp_envelope`                                        | Check the sender and recipient; SMTP did not accept the recipient.                                                      |
| `smtp_message`                                         | Check the sender account's provider alerts, sending limits and rejections.                                              |
| `delivery_unknown`                                     | Check configuration and database health. Keep the existing encryption key unchanged.                                    |
| `Delivery worker unavailable` plus due queued messages | Check database connectivity and confirm migrations applied to the API's database.                                       |
| `delivered` with no email in the inbox                 | Check Spam, sender-account bounce notices, sending limits and filtering.                                                |
| `expired` or `failed`                                  | Resolve the failure and request a fresh code. Never revive expired message bodies.                                      |

Local checks do not establish the live Gmail/Render delivery cause. Share only
aggregate results or fixed log categories when diagnosing the deployment.

A repeated signup can return the generic registration message without queuing a
new email when the account/details already exist. Sign in and use **Send another
code** for an existing unverified account; use password recovery if needed.

## Reliability update

- Five independent message transactions use `SKIP LOCKED`. A slow send does not
  delay committing another recipient's success; overlapping workers skip messages
  already in flight.
- Connection, greeting and DNS timeouts are 10 seconds. Socket inactivity times
  out after 15 seconds. The pump checks every second, waits for all active sends
  before another pass and finishes active delivery work during graceful shutdown.
- Failed sends retry after 15, 30, 60 and 120 seconds, with at most five attempts.
  Expired messages are excluded and their encrypted bodies cleared.
- New code/reset emails reference their challenge. Resending cancels unsent older
  emails for the same purpose. Consumed or exhausted challenges are also excluded.
  Password recovery and security notices stay separate. An email already handed
  to SMTP cannot be recalled; use the latest code.
- Existing messages without a challenge reference retain their original expiry;
  the migration does not infer links or reset retry state.
- SMTP rejection records a fixed `last_error_code`. Acceptance clears it and the
  message body. A failure saving acceptance to the database is reported separately.
  SMTP is an at-least-once external operation: a crash or uncertain acknowledgement
  can still cause a duplicate.

Deploy the API and customer app from this change. The existing Render start command
`node apps/api/dist/migrate.js && node apps/api/dist/main.js` applies migration 007
automatically. No Render Shell session or private `.env` edit is required.
