"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Landmark,
  ScanFace,
  ArrowUpRight,
  RefreshCw,
  Check,
  LockKeyhole,
} from "lucide-react";
import AccountShell from "../AccountShell";
import { api } from "../../lib/api";
const identityLabels = {
  not_started: "Not started",
  submitting: "Preparing verification",
  incomplete: "Ready to continue",
  under_review: "Under review",
  approved: "Identity verified",
  correction_required: "Action needed",
  rejected: "Verification unsuccessful",
};
const bankLabels = {
  pending: "Checking ownership",
  under_review: "Ownership needs review",
  verified: "Ownership verified",
  mismatch: "Ownership did not match",
  unavailable: "Verification unavailable",
  inactive: "Inactive",
};
async function operationDigest(input) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      "bank_add",
      input.operationId,
      input.country,
      input.bankCode,
      input.accountNumber,
    ]),
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
export default function VerificationApp({ screen }) {
  const router = useRouter(),
    errorRef = useRef(null),
    pendingBank = useRef(null),
    pendingRenewals = useRef(new Map()),
    fetching = useRef(false);
  const [user, setUser] = useState(null),
    [policy, setPolicy] = useState(null),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const load = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const me = await api("auth/me");
      if (me.user.state.startsWith("mfa_")) {
        router.replace(
          me.user.state === "mfa_setup_required" ? "/mfa-setup" : "/mfa",
        );
        return;
      }
      if (me.user.role !== "customer") {
        router.replace("/admin-access");
        return;
      }
      setUser(me.user);
      const [p, result] = await Promise.all([api("auth/policy"), api(screen)]);
      setPolicy(p);
      setData(result);
      setError("");
    } catch (e) {
      if (e.status === 401) {
        setUser(null);
        setData(null);
        router.replace("/login");
      } else setError(e.message);
    } finally {
      fetching.current = false;
    }
  }, [screen, router]);
  useEffect(() => {
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function action(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      if (e.status === 401) router.replace("/login");
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addBank(event) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    const details = {
      country: data.country,
      bankCode: String(values.get("bankCode")).trim(),
      accountNumber: String(values.get("accountNumber")).trim(),
    };
    // Memory only. Keep the same operation for an uncertain network outcome; never persist bank data in browser storage.
    if (
      !pendingBank.current ||
      JSON.stringify(pendingBank.current.details) !== JSON.stringify(details)
    )
      pendingBank.current = { details, operationId: crypto.randomUUID() };
    const input = { operationId: pendingBank.current.operationId, ...details };
    const code = String(values.get("code")).trim();
    form.elements.code.value = "";
    await action(async () => {
      const grant = await api("auth/step-up", {
        purpose: "bank_add",
        operationDigest: await operationDigest(input),
        code,
      });
      await api("banks", { ...input, stepUpId: grant.stepUpId });
      pendingBank.current = null;
      form.reset();
      setMessage("Bank account added. We’re checking its ownership.");
    });
  }
  async function reverifyBank(event, bankId) {
    event.preventDefault();
    const form = event.currentTarget,
      code = String(new FormData(form).get("code")).trim();
    form.elements.code.value = "";
    if (!pendingRenewals.current.has(bankId))
      pendingRenewals.current.set(bankId, crypto.randomUUID());
    const operationId = pendingRenewals.current.get(bankId);
    await action(async () => {
      const prepared = await api(`banks/${bankId}/reverifications/prepare`, {
        operationId,
      });
      if (!prepared.alreadySubmitted) {
        const grant = await api("auth/step-up", {
          purpose: "bank_reverify",
          operationDigest: prepared.operationDigest,
          code,
        });
        await api(`banks/${bankId}/reverifications`, {
          operationId,
          stepUpId: grant.stepUpId,
        });
      }
      pendingRenewals.current.delete(bankId);
      form.reset();
      setMessage(
        "Bank verification restarted. We’re checking ownership again.",
      );
    });
  }
  return (
    <AccountShell
      screen={screen}
      user={user}
      busy={busy}
      logout={() =>
        action(async () => {
          await api("auth/logout", {});
          router.replace("/login");
        })
      }
    >
      {policy?.deploymentStage === "staging" && (
        <aside className="notice" role="note" aria-label="Staging environment">
          <strong>Test environment.</strong> Use test accounts only. Wallet
          transfers and trading are unavailable.
        </aside>
      )}
      <div className="page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>
          {screen === "identity"
            ? "Your identity, verified"
            : "Your bank accounts"}
        </h1>
        <p>
          {screen === "identity"
            ? "A few checks to help keep your account and community secure."
            : "Add an account in your name for supported payments when they become available."}
        </p>
      </div>
      {error && (
        <div className="notice error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
          <button className="quiet" onClick={load} disabled={busy}>
            Try again
          </button>
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {!data && !error && (
        <p role="status">Loading your verification details…</p>
      )}
      {data && (
        <div className="verification-grid">
          <section className="panel verification-panel">
            {screen === "identity" ? (
              <>
                <div className="verification-heading">
                  <span className="verification-symbol">
                    <ScanFace size={28} />
                  </span>
                  <span
                    className={`status-chip ${data.status === "approved" ? "complete" : "pending"}`}
                  >
                    {data.restricted
                      ? "Verification restricted"
                      : identityLabels[data.status]}
                  </span>
                </div>
                <h2>
                  {data.status === "approved"
                    ? "You’ve completed your identity checks."
                    : "Let’s get to know you."}
                </h2>
                {data.mode === "sandbox" && data.status === "approved" && (
                  <p>
                    These are test verification results. Wallet and trading
                    access remains unavailable.
                  </p>
                )}
                {data.reason && <p>{data.reason}</p>}
                {!data.available && (
                  <div className="verification-notice" role="note">
                    <LockKeyhole size={20} />
                    <p>{data.unavailableReason}</p>
                  </div>
                )}
                {data.restricted && (
                  <p>
                    Contact support about your verification before continuing.
                  </p>
                )}
                {!data.emailVerified && (
                  <p>
                    <Link href="/verify-contacts">Verify your email</Link>{" "}
                    before starting your identity checks.
                  </p>
                )}
                {data.temporaryIssue && (
                  <p role="status">
                    The verification service is taking longer than expected.
                    Your progress is saved. Try checking again.
                  </p>
                )}
                {data.status === "submitting" && (
                  <p role="status">
                    Your secure verification session is being prepared. This
                    page checks for updates automatically.
                  </p>
                )}
                {data.status === "under_review" && (
                  <p role="status">
                    Your details are being reviewed. You can leave this page and
                    return later.
                  </p>
                )}
                {data.status === "rejected" && (
                  <p>
                    Contact support if you believe this result is incorrect.
                    Creating another account will not resolve this verification.
                  </p>
                )}
                {(data.canStart || data.canResubmit) && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      action(async () => {
                        await api(
                          data.canResubmit
                            ? "identity/resubmissions"
                            : "identity/sessions",
                          { disclosureVersion: data.disclosure.version },
                        );
                        setAccepted(false);
                      });
                    }}
                  >
                    <label className="verification-consent">
                      <input
                        type="checkbox"
                        required
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        disabled={busy}
                      />
                      <span>
                        I have read the{" "}
                        <a
                          href={data.disclosure.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          verification disclosure
                        </a>{" "}
                        and agree to the described identity checks.
                      </span>
                    </label>
                    <button className="primary" disabled={busy || !accepted}>
                      {busy
                        ? "Preparing…"
                        : data.canResubmit
                          ? "Correct my verification"
                          : "Start verification"}
                      <ArrowUpRight size={18} />
                    </button>
                  </form>
                )}
                {data.capture && (
                  <a
                    className="primary"
                    href={data.capture.url}
                    rel="noreferrer"
                  >
                    Continue secure verification <ArrowUpRight size={18} />
                  </a>
                )}
                {data.status === "incomplete" &&
                  !data.capture &&
                  data.available && (
                    <p>
                      Your capture link is not ready or has expired. Check for
                      an updated session below.
                    </p>
                  )}
                {data.canRefresh && (
                  <button
                    className="quiet verification-refresh"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api("identity/refresh", {});
                        setMessage(
                          "Checking for your latest verification result.",
                        );
                      })
                    }
                  >
                    <RefreshCw size={16} />
                    Check verification status
                  </button>
                )}
                {data.status === "approved" && (
                  <Link className="primary" href="/banks">
                    View bank accounts <ArrowUpRight size={18} />
                  </Link>
                )}
              </>
            ) : (
              <>
                <div className="verification-heading">
                  <span className="verification-symbol">
                    <Landmark size={28} />
                  </span>
                  <span className="status-chip">{data.currency}</span>
                </div>
                <h2>Accounts in your name</h2>
                {!data.available && (
                  <div className="verification-notice" role="note">
                    <LockKeyhole size={20} />
                    <p>{data.unavailableReason}</p>
                  </div>
                )}
                {!data.identityVerified && (
                  <p>
                    <Link href="/identity">Complete identity verification</Link>{" "}
                    before adding a bank account.
                  </p>
                )}
                {data.identityVerified && !data.mfaEnabled && (
                  <p>
                    <Link href="/mfa-setup">Set up your authenticator</Link> to
                    protect bank account changes.
                  </p>
                )}
                {data.destinations.length === 0 && (
                  <div className="verification-empty">
                    <Landmark size={32} />
                    <h3>No bank accounts yet</h3>
                    <p>
                      Your verified bank destinations will appear here with
                      their account numbers masked.
                    </p>
                  </div>
                )}
                <ul className="bank-destinations">
                  {data.destinations.map((bank) => (
                    <li key={bank.id}>
                      <div>
                        <h3>{bank.bankName}</h3>
                        <p>
                          {bank.maskedAccount} · {bank.currency}
                        </p>
                        <span
                          role="status"
                          aria-label="Bank ownership status"
                          className={`status-chip ${bank.status === "verified" ? "complete" : "pending"}`}
                        >
                          {bankLabels[bank.status]}
                        </span>
                        {bank.reason && <p>{bank.reason}</p>}
                        {bank.needsReverification ? (
                          <p>
                            This destination needs a new verification before it
                            can be used.
                          </p>
                        ) : (
                          bank.status === "verified" &&
                          !bank.usable && (
                            <p>
                              Current identity and bank verification must be
                              available before using this destination.
                            </p>
                          )
                        )}
                        {bank.needsReverification && data.canAdd && (
                          <form
                            className="bank-form"
                            onSubmit={(event) => reverifyBank(event, bank.id)}
                            aria-label={`Verify ${bank.bankName} ${bank.maskedAccount} again`}
                            autoComplete="off"
                          >
                            <p>
                              Authorize a fresh ownership check for this saved
                              account.
                            </p>
                            <label htmlFor={`renew-${bank.id}`}>
                              Authenticator or recovery code
                            </label>
                            <input
                              id={`renew-${bank.id}`}
                              name="code"
                              required
                              minLength={6}
                              maxLength={80}
                              autoComplete="one-time-code"
                              disabled={busy}
                            />
                            <button className="quiet" disabled={busy}>
                              {busy ? "Starting verification…" : "Verify again"}
                            </button>
                          </form>
                        )}
                      </div>
                      {["pending", "under_review", "unavailable"].includes(
                        bank.status,
                      ) &&
                        !bank.needsReverification &&
                        data.available &&
                        data.identityVerified &&
                        data.mfaEnabled && (
                          <button
                            className="quiet"
                            disabled={busy}
                            onClick={() =>
                              action(() =>
                                api(`banks/${bank.id}/verifications`, {}),
                              )
                            }
                          >
                            Check status
                          </button>
                        )}
                    </li>
                  ))}
                </ul>
                {data.canAdd && (
                  <form
                    className="bank-form"
                    onSubmit={addBank}
                    autoComplete="off"
                  >
                    <h3>Add a bank account</h3>
                    <label htmlFor="bankCode">Bank</label>
                    <select
                      id="bankCode"
                      name="bankCode"
                      required
                      disabled={busy}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select your bank
                      </option>
                      {data.banks.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="accountNumber">{data.field.label}</label>
                    <input
                      id="accountNumber"
                      name="accountNumber"
                      required
                      inputMode={data.field.inputMode}
                      minLength={data.field.minLength}
                      maxLength={data.field.maxLength}
                      pattern={data.field.pattern}
                      disabled={busy}
                    />
                    <label htmlFor="bankCodeMfa">
                      Authenticator or recovery code
                    </label>
                    <input
                      id="bankCodeMfa"
                      name="code"
                      required
                      minLength={6}
                      maxLength={80}
                      autoComplete="one-time-code"
                      disabled={busy}
                    />
                    <p className="muted">
                      Authorize these exact account details. Account ownership
                      must match your verified identity.
                    </p>
                    <button className="primary" disabled={busy}>
                      {busy ? "Adding account…" : "Add and verify account"}
                      <ShieldCheck size={18} />
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
          <aside className="panel verification-guide">
            <p className="eyebrow">
              {screen === "identity" ? "BEFORE YOU START" : "GOOD TO KNOW"}
            </p>
            <h2>
              {screen === "identity"
                ? "A clear path to verification"
                : "Your details stay protected"}
            </h2>
            <ol>
              {(screen === "identity"
                ? [
                    [
                      "Government-issued ID",
                      "Use a current document supported by the verification service.",
                    ],
                    [
                      "Selfie and liveness",
                      "You’ll be guided through the supported capture steps.",
                    ],
                    [
                      "Your result",
                      "Return here to see progress or any corrections needed.",
                    ],
                  ]
                : [
                    [
                      "Your account, your name",
                      "Only destinations with verified ownership can be used.",
                    ],
                    [
                      "Protected changes",
                      "An authenticator check authorizes the exact bank details you enter.",
                    ],
                    [
                      "Private by default",
                      "Saved account numbers are encrypted and displayed masked.",
                    ],
                  ]
              ).map(([title, body], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="verification-footnote">
              <Check size={18} />
              <p>
                {screen === "identity"
                  ? "You must be at least 18. Your progress is saved so you can return later."
                  : "Adding a bank account does not transfer money or enable wallet access."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </AccountShell>
  );
}
