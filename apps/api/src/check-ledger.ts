import { Database } from "./db";
/** Operator-invoked read-only metadata. Never prints balances or connection errors. */
export async function checkLedgerReadiness(db: Database) {
  try {
    const result = (await db.pool.query("SELECT finance.readiness() AS result"))
      .rows[0].result;
    return {
      ...result,
      custodyConfigured: false,
      financialCapabilitiesEnabled: false,
    };
  } catch {
    return {
      runtimeRoleProtected: false,
      custodyConfigured: false,
      financialCapabilitiesEnabled: false,
      reason: "financial_runtime_role_not_verified",
    };
  }
}
if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Ledger check requires DATABASE_URL in the process environment.",
    );
    process.exitCode = 1;
  } else {
    const db = new Database(url);
    checkLedgerReadiness(db)
      .then((result) => {
        console.log(JSON.stringify(result));
        if (!result.runtimeRoleProtected) process.exitCode = 1;
      })
      .catch(() => {
        console.error("Ledger check unavailable.");
        process.exitCode = 1;
      })
      .finally(() => db.close());
  }
}
