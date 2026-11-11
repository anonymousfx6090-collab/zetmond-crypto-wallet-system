import { Queue, Worker, ConnectionOptions } from "bullmq";
import { VerificationWorker } from "../verification/verification.worker";
export function redisConnection(value: string): ConnectionOptions {
  const url = new URL(value);
  if (
    !["redis:", "rediss:"].includes(url.protocol) ||
    url.search ||
    url.hash ||
    !/^\/?\d*$/.test(url.pathname)
  )
    throw new Error("Invalid REDIS_URL");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
export async function startVerificationQueue(
  pump: VerificationWorker,
  redisUrl: string,
  queueName = "zetmond-verification",
) {
  const connection = redisConnection(redisUrl);
  const queue = new Queue(queueName, { connection });
  const worker = new Worker(
    queueName,
    async () => {
      // Payload contains no identity/bank evidence; PostgreSQL leases recover lost wakeups.
      for (let i = 0; i < 20; i++) if (!(await pump.dispatch())) break;
    },
    { connection, concurrency: 1 },
  );
  const report = () =>
    console.warn(
      "Verification queue unavailable; check Redis and worker connectivity.",
    );
  queue.on("error", report);
  worker.on("error", report);
  worker.on("failed", report);
  // Both worker connections must finish initialization before the caller can
  // stop/restart it; closing a still-initializing connection can reject pending commands.
  await worker.waitUntilReady();
  await queue.upsertJobScheduler(
    "verification-pump",
    { every: 5000 },
    {
      name: "scan-durable-work",
      data: {},
      opts: { removeOnComplete: 20, removeOnFail: 20 },
    },
  );
  await queue.add(
    "startup-scan",
    {},
    { removeOnComplete: true, removeOnFail: 20 },
  );
  return {
    queue,
    worker,
    async close() {
      await worker.close();
      await queue.close();
    },
  };
}
