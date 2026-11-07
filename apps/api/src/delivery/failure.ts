/** Log only locally defined categories. SMTP errors can contain addresses and credentials. */
export function deliveryFailure(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  switch (code) {
    case "EAUTH":
      return "smtp_authentication: check SMTP_USER and the Google app password";
    case "ETIMEDOUT":
      return "smtp_timeout: check hosting SMTP access and provider connectivity";
    case "ECONNECTION":
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "smtp_connection: check SMTP_HOST, SMTP_PORT and hosting network access";
    case "ETLS":
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return "smtp_tls: check provider TLS configuration";
    case "EENVELOPE":
      return "smtp_envelope: check the sender configuration and recipient";
    case "EMESSAGE":
      return "smtp_message: provider rejected the message";
    default:
      return "delivery_unknown: inspect queue status and configuration; keep DATA_ENCRYPTION_KEY unchanged";
  }
}
