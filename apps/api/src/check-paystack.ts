import { ConfigurationError } from "./config";
import {
  PaystackBankLookupClient,
  PaystackLookupError,
  PaystackMode,
} from "./providers/paystack.client";

type PaystackEnvironment = {
  PAYSTACK_MODE?: string;
  PAYSTACK_SECRET_KEY?: string;
};

const safeFailure = (error: unknown) =>
  error instanceof ConfigurationError || error instanceof PaystackLookupError
    ? error.message
    : "Paystack preflight failed; check service configuration and provider health.";

/** Owner-operated read-only preflight; never expose credentials or this check as an HTTP route. */
export async function checkPaystackBankAccess(
  env: PaystackEnvironment,
  transport?: typeof fetch,
) {
  const client = new PaystackBankLookupClient(
    {
      mode: (env.PAYSTACK_MODE || "sandbox") as PaystackMode,
      secretKey: env.PAYSTACK_SECRET_KEY || "",
    },
    transport,
  );
  const banks = await client.listNigerianBanks();
  if (!banks.length) throw new PaystackLookupError("invalid_response");
  return {
    catalogueAvailable: true as const,
    mode: client.mode,
    country: "NG",
    currency: "NGN",
    bankCount: banks.length,
    ownershipVerificationEnabled: false as const,
  };
}

/** One background catalogue check per staging API start, with no raw provider output. */
export async function reportConfiguredPaystackBankAccess(
  env: PaystackEnvironment,
  log: Pick<Console, "info" | "warn"> = console,
  transport?: typeof fetch,
): Promise<void> {
  if (!env.PAYSTACK_MODE && !env.PAYSTACK_SECRET_KEY) return;
  try {
    const result = await checkPaystackBankAccess(env, transport);
    log.info(`Paystack bank catalogue check: ${JSON.stringify(result)}`);
  } catch (error: unknown) {
    log.warn(`Paystack bank catalogue check: ${safeFailure(error)}`);
  }
}

if (require.main === module) {
  checkPaystackBankAccess(process.env)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: unknown) => {
      console.error(safeFailure(error));
      process.exitCode = 1;
    });
}
