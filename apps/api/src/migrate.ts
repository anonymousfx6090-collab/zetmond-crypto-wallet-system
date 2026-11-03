import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "./db";
export async function migrate(url: string) {
  const db = new Database(url);
  try {
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(730020)");
      await c.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const dir = join(__dirname, "../migrations");
      for (const name of readdirSync(dir)
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        if (
          (
            await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
              name,
            ])
          ).rowCount
        )
          continue;
        await c.query(readFileSync(join(dir, name), "utf8"));
        await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      }
    });
  } finally {
    await db.close();
  }
}
if (require.main === module)
  migrate(process.env.DATABASE_URL || "")
    .then(() => console.log("Migrations applied"))
    .catch(() => {
      console.error("Migration failed; check database configuration");
      process.exitCode = 1;
    });
