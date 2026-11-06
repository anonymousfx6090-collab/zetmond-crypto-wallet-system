import { createApp } from "./app";
import { ConfigurationError, deploymentStage, loadConfig } from "./config";
async function main() {
  const config = loadConfig();
  const runtime = await createApp(config);
  await runtime.app.listen(
    config.PORT,
    config.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  );
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runtime.delivery.dispatch();
    } catch {
      console.warn("Delivery worker unavailable");
    } finally {
      running = false;
    }
  }, 5000);
  const shutdown = async () => {
    clearInterval(timer);
    await runtime.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  console.log(
    `Zetmond API (${deploymentStage(config)}) listening on port ${config.PORT}`,
  );
  if (config.DEPLOYMENT_STAGE === "staging")
    console.warn(
      "Staging environment: test accounts only; financial access is disabled.",
    );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : "API startup failed; check required configuration and migrations.",
  );
  process.exitCode = 1;
});
