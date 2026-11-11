import { createApp } from "./app";
import { ConfigurationError, deploymentStage, loadConfig } from "./config";
async function main() {
  const config = loadConfig();
  const runtime = await createApp(config);
  await runtime.app.listen(
    config.PORT,
    config.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  );
  let deliveryWork: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    if (deliveryWork) return;
    deliveryWork = runtime.delivery
      .dispatch()
      .catch(() => console.warn("Delivery worker unavailable"))
      .finally(() => {
        deliveryWork = undefined;
      });
  }, 1000);
  let verificationWork: Promise<unknown> | undefined;
  const verificationTimer = setInterval(() => {
    if (
      verificationWork ||
      !runtime.verification.providers.length ||
      config.VERIFICATION_INLINE_WORKER !== "true"
    )
      return;
    verificationWork = runtime.verificationWorker
      .dispatch()
      .catch(() =>
        console.warn("Verification worker unavailable; work remains saved."),
      )
      .finally(() => {
        verificationWork = undefined;
      });
  }, 1000);
  const shutdown = async () => {
    clearInterval(timer);
    clearInterval(verificationTimer);
    await deliveryWork;
    await verificationWork;
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
