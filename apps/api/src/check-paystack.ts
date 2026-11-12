import { ConfigurationError } from "./config";
import {
  PaystackBankLookupClient,
  PaystackLookupError,
  PaystackMode,
} from "./providers/paystack.client";

/** Owner-operated read-only preflight; never expose credentials or this check as an HTTP route. */
export async function checkPaystackBankAccess(
  env: { PAYSTACK_MODE?: string; PAYSTACK_SECRET_KEY?: string },
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
if (require.main === module) {
  checkPaystackBankAccess(process.env)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: unknown) => {
      console.error(
        error instanceof ConfigurationError ||
          error instanceof PaystackLookupError
          ? error.message
          : "Paystack preflight failed; check service configuration and provider health.",
      );
      process.exitCode = 1;
    });
}
