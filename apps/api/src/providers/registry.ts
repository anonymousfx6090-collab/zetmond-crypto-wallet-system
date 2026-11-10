import { Config, ConfigurationError } from "../config";
import { Database } from "../db";
import { VerificationProvider } from "./verification";
import { SmileIdProvider } from "./smile-id.provider";

/** Opt-in real adapter only. Test fixtures cannot be selected by HTTP or env. */
export function configuredVerificationProviders(
  config?: Config,
  db?: Database,
): VerificationProvider[] {
  if (!config || !db || config.SMILE_ID_ENABLED !== "true") return [];
  if (!config.SMILE_ID_PARTNER_ID || !config.SMILE_ID_API_KEY)
    throw new ConfigurationError(
      "Smile ID enablement requires both partner credentials.",
    );
  return [new SmileIdProvider(config, db)];
}
