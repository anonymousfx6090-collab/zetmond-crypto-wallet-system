import { loadConfig, ConfigurationError } from "./config";
import { Database } from "./db";
import { AuthService } from "./auth/auth.service";
import { Delivery } from "./delivery/delivery.service";
import { configuredVerificationProviders } from "./providers/verification";
import { VerificationService } from "./verification/verification.service";
import { VerificationWorker } from "./verification/verification.worker";
import { startVerificationQueue } from "./jobs/verification-queue";
async function main() {
  const config = loadConfig(),
    providers = configuredVerificationProviders();
  if (!providers.length) {
    console.log(
      "Verification worker disabled: select and configure a verification provider first.",
    );
    return;
  }
  if (!config.REDIS_URL)
    throw new ConfigurationError("Verification worker requires REDIS_URL.");
  const db = new Database(config.DATABASE_URL);
  const service = new VerificationService(
    new AuthService(db, config, new Delivery(db, config)),
    providers,
  );
  const queue = await startVerificationQueue(
    new VerificationWorker(service),
    config.REDIS_URL,
  );
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await queue.close();
    await db.close();
  };
  process.once("SIGTERM", () => void close());
  process.once("SIGINT", () => void close());
  console.log(
    "Verification worker ready. PostgreSQL retains verification operations and outcomes.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : "Verification worker startup failed; check configuration and service connectivity.",
  );
  process.exitCode = 1;
});
