/** Log only locally defined categories. SMTP errors can contain addresses and credentials. */
export function deliveryFailureCode(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  switch (code) {
    case "EAUTH":
      return "smtp_authentication";
    case "ETIMEDOUT":
      return "smtp_timeout";
    case "ECONNECTION":
    case "ECONNREFUSED":
    case "ENOTFOUND":
    case "EAI_AGAIN":
    case "EDNS":
    case "ECONNRESET":
    case "EPIPE":
    case "ESOCKET":
      return "smtp_connection";
    case "ETLS":
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return "smtp_tls";
    case "EENVELOPE":
      return "smtp_envelope";
    case "EMESSAGE":
      return "smtp_message";
    default:
      return "delivery_unknown";
  }
}

const guidance = {
  smtp_authentication: "check SMTP_USER and the Google app password",
  smtp_timeout: "check hosting SMTP access and provider connectivity",
  smtp_connection: "check SMTP_HOST, SMTP_PORT and hosting network access",
  smtp_tls: "check provider TLS configuration",
  smtp_envelope: "check the sender configuration and recipient",
  smtp_message: "provider rejected the message",
  delivery_unknown:
    "inspect queue status and configuration; keep DATA_ENCRYPTION_KEY unchanged",
};

export function deliveryFailure(error: unknown) {
  const category = deliveryFailureCode(error);
  return `${category}: ${guidance[category]}`;
}
