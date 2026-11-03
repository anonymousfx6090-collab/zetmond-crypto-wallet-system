import { loadConfig } from "./config";
import { Database } from "./db";
import { unseal } from "./crypto";
// Local owner-operated CLI only; never register this as an HTTP endpoint.
async function main() {
  const config = loadConfig();
  if (
    config.NODE_ENV !== "development" ||
    config.DELIVERY_MODE !== "development"
  )
    throw new Error("Local messages are only available in development");
  const db = new Database(config.DATABASE_URL);
  try {
    const r = await db.pool.query(
      "SELECT o.channel,o.payload FROM delivery_outbox o JOIN users u ON u.id=o.user_id WHERE u.email=$1 AND o.status='queued' ORDER BY o.created_at DESC LIMIT 5",
      [process.argv[2]?.trim().toLowerCase()],
    );
    for (const row of r.rows)
      console.log(row.channel, unseal(config.DATA_ENCRYPTION_KEY, row.payload));
  } finally {
    await db.close();
  }
}
main().catch(() => {
  console.error("Local message access unavailable");
  process.exitCode = 1;
});
