import { hkdfSync } from "node:crypto";
import { Config, ConfigurationError, smileIdPartnerIdSchema } from "../config";

export function smileIdCallbackSettings(config: Config) {
  const partner = smileIdPartnerIdSchema.safeParse(config.SMILE_ID_PARTNER_ID);
  let origin: URL;
  try {
    origin = new URL(config.PUBLIC_API_ORIGIN || "");
    if (
      origin.protocol !== "https:" ||
      origin.origin !== config.PUBLIC_API_ORIGIN ||
      origin.username ||
      origin.password
    )
      throw new Error();
  } catch {
    throw new ConfigurationError(
      "Smile ID requires PUBLIC_API_ORIGIN to be an exact public HTTPS origin.",
    );
  }
  if (!partner.success)
    throw new ConfigurationError(
      "Configure a valid SMILE_ID_PARTNER_ID first.",
    );
  const mode = config.SMILE_ID_MODE;
  const secret = Buffer.from(
    config.SMILE_ID_WEBHOOK_SECRET || config.DATA_ENCRYPTION_KEY,
    "hex",
  );
  const capability = Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      `${partner.data}:${mode}`,
      "zetmond/smile-id/callback/v1",
      32,
    ),
  ).toString("base64url");
  const route = `/api/webhooks/smile-id/${mode}/${capability}`;
  return {
    mode,
    route,
    privateUrl: origin.origin + route,
    publicUrl: origin.origin + "/api/webhooks/smile-id",
  };
}
