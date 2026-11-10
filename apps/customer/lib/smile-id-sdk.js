export const smileSdkUrl =
  "https://cdn.usesmileid.com/inline/v12/js/script.min.js";
let loading;
export function loadSmileSdk() {
  if (typeof window.SmileIdentity === "function")
    return Promise.resolve(window.SmileIdentity);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = smileSdkUrl;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      reject(
        new Error("The verification window could not load. Please try again."),
      );
    };
    const timer = setTimeout(fail, 20000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (typeof window.SmileIdentity !== "function") return fail();
      resolve(window.SmileIdentity);
    };
    document.head.appendChild(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
const messages = {
  CONFIG_INVALID:
    "The verification service is not ready. Please check your status and try later.",
  SESSION_INIT_FAILED:
    "The verification window could not start. Check camera access and your connection.",
  CONSENT_DENIED:
    "You declined consent. Your identity check has not been completed.",
  SUBMISSION_FAILED:
    "We could not confirm submission. Check your saved status before trying again.",
  NOT_PERMITTED:
    "This check is not available for your account. Please contact support.",
  DOCUMENTS_REJECTED:
    "The document capture was not accepted. Please check your capture and try again if offered.",
};
/** Browser results are UX/submission hints only. No verdict or raw message is trusted. */
export function smileSdkOutcome(result, expectedUserId) {
  if (result?.status === "cancelled")
    return {
      kind: "cancelled",
      message: "Verification closed. You can return to your identity page.",
    };
  if (result?.product !== "doc_verification")
    return {
      kind: "uncertain",
      message:
        "We could not confirm this submission. Check your saved verification status.",
    };
  if (result.status === "success") {
    const value = result.value;
    const validJob =
      typeof value?.job_id === "string" &&
      value.job_id.length === 30 &&
      /^job_[0-9a-hjkmnp-tv-z]{26}$/.test(value.job_id);
    return {
      kind: "submitted",
      message:
        "Your verification was submitted. Zetmond is checking the result.",
      ...(validJob && value.user_id === expectedUserId
        ? { jobId: value.job_id, userId: value.user_id }
        : {}),
    };
  }
  if (result.status === "failure") {
    const code = result.error?.error_code;
    return {
      kind: code === "SUBMISSION_FAILED" ? "uncertain" : "failure",
      message:
        messages[code] ||
        "Verification could not continue. Please check your status.",
      retryable:
        result.error?.retryable === true &&
        ["SESSION_INIT_FAILED", "DOCUMENTS_REJECTED"].includes(code),
    };
  }
  return {
    kind: "uncertain",
    message:
      "We could not confirm this submission. Check your saved verification status.",
  };
}
