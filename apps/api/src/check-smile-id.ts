import { Config, ConfigurationError, loadConfig } from "./config";
import {
  configuredSmileIdClient,
  SmileIdError,
} from "./providers/smile-id.client";

/** Owner-operated service check; never register this as a public HTTP route. */
export async function checkSmileIdCredentials(
  config: Config,
  transport?: typeof fetch,
) {
  const client = configuredSmileIdClient(config, transport);
  if (!client)
    throw new ConfigurationError(
      "Set SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY in the service environment settings.",
    );
  await client.getAccessToken();
  return { authenticated: true as const, mode: client.mode };
}

async function main() {
  const result = await checkSmileIdCredentials(loadConfig());
  console.log(
    `Smile ID ${result.mode} authentication succeeded. This check does not enable KYC capture.`,
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof ConfigurationError || error instanceof SmileIdError
        ? error.message
        : "Smile ID credential check failed; inspect service configuration and provider health.",
    );
    process.exitCode = 1;
  });
}
