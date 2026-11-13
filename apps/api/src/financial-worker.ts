import { createApp } from "./app";
async function main() {
  const runtime = await createApp();
  if (!runtime.financial.custody.ready()) {
    console.log(
      "Financial worker unavailable: a reviewed custody adapter is not configured. Financial access remains disabled.",
    );
    await runtime.close();
    return;
  }
  let work: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    if (!work)
      work = runtime.financial
        .dispatch()
        .catch(() => console.warn("Financial work remains saved for recovery."))
        .finally(() => {
          work = undefined;
        });
  }, 1000);
  const stop = async () => {
    clearInterval(timer);
    await work;
    await runtime.close();
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
main().catch(() => {
  console.error(
    "Financial worker startup failed; check configuration and migrations.",
  );
  process.exitCode = 1;
});
