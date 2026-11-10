"use client";
import { useEffect, useRef, useState } from "react";
import { ScanFace, ArrowLeft, ShieldCheck } from "lucide-react";
import AppearanceToggle from "../AppearanceToggle";
import { api } from "../../lib/api";
import { loadSmileSdk, smileSdkOutcome } from "../../lib/smile-id-sdk";

export default function SmileCapture({ attemptId }) {
  const epoch = useRef(0),
    opening = useRef(false),
    errorRef = useRef(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [stage, setStage] = useState(""),
    [retry, setRetry] = useState(true);
  useEffect(() => {
    let active = true;
    api("identity")
      .then((data) => {
        if (!active) return;
        setStage(data.mode);
        if (
          data.attemptId !== attemptId ||
          !data.available ||
          data.status !== "incomplete" ||
          !data.emailVerified ||
          data.restricted
        ) {
          setError(
            "This capture link is no longer ready. Return to your identity page to check your status.",
          );
          return;
        }
        setReady(true);
      })
      .catch((e) => {
        if (e.status === 401) {
          window.location.replace("/login");
          return;
        }
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      epoch.current++;
    };
  }, [attemptId]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function open() {
    if (!ready || opening.current || !retry) return;
    opening.current = true;
    const current = ++epoch.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const sdk = await loadSmileSdk();
      if (epoch.current !== current) return;
      const session = await api("identity/capture", { attemptId });
      if (epoch.current !== current) return;
      let handled = false;
      const onResult = async (result) => {
        if (handled || epoch.current !== current) return;
        handled = true;
        const outcome = smileSdkOutcome(result, session.partner_params.user_id);
        setRetry(outcome.kind === "cancelled" || outcome.retryable === true);
        try {
          if (["submitted", "uncertain"].includes(outcome.kind)) {
            await api("identity/capture/submission", {
              attemptId,
              ...(outcome.jobId
                ? { jobId: outcome.jobId, userId: outcome.userId }
                : {}),
            });
          }
          if (epoch.current !== current) return;
          if (["failure", "uncertain"].includes(outcome.kind))
            setError(outcome.message);
          else setMessage(outcome.message);
        } catch (e) {
          if (epoch.current !== current) return;
          if (e.status === 401) {
            window.location.replace("/login");
            return;
          }
          setError(
            "Your check may still be processing. Check your saved status before trying again.",
          );
          setRetry(false);
        } finally {
          if (epoch.current === current) {
            opening.current = false;
            setBusy(false);
          }
        }
      };
      const { attemptId: ignored, ...config } = session;
      try {
        const started = sdk.call(window, { ...config, onResult });
        Promise.resolve(started).catch(() =>
          onResult({
            status: "failure",
            product: "doc_verification",
            error: { error_code: "SUBMISSION_FAILED", retryable: false },
          }),
        );
      } catch {
        await onResult({
          status: "failure",
          product: "doc_verification",
          error: { error_code: "SESSION_INIT_FAILED", retryable: true },
        });
      }
    } catch (e) {
      if (epoch.current !== current) return;
      setBusy(false);
      opening.current = false;
      if (e.status === 401) {
        window.location.replace("/login");
        return;
      }
      setError(
        e.status
          ? e.message
          : "The verification window could not start. Check your connection and try again.",
      );
    }
  }
  return (
    <main className="standalone capture-page">
      <header className="capture-top">
        <a href="/identity" className="brand" aria-label="Zetmond identity">
          <span className="brand-symbol" aria-hidden="true">
            <img src="/zetmond-logo.png" alt="" width="2200" height="800" />
          </span>
          <span className="brand-name">Zetmond</span>
        </a>
        <AppearanceToggle />
      </header>
      <div className="capture-card panel">
        <span className="verification-symbol">
          <ScanFace size={30} />
        </span>
        <p className="eyebrow">IDENTITY VERIFICATION</p>
        <h1>Let’s complete your identity check.</h1>
        <p>
          Smile ID will guide you through your document, selfie and liveness
          check. Have your government-issued ID ready and use a well-lit space.
        </p>
        {stage === "sandbox" && (
          <aside className="notice" role="note">
            <strong>Test verification.</strong> Use only Smile ID’s approved
            sandbox test data. Wallet and trading access stays unavailable.
          </aside>
        )}
        <div className="capture-assurance">
          <ShieldCheck size={20} />
          <span>
            Your camera opens in the verification window. Submission is followed
            by a separate result check.
          </span>
        </div>
        {error && (
          <p className="notice error" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
        {message && (
          <p className="notice success" role="status">
            {message}
          </p>
        )}
        {!ready && !error && (
          <p role="status">Checking your saved verification session…</p>
        )}
        {ready && retry && (
          <button className="primary" disabled={busy} onClick={open}>
            {busy ? "Verification window open…" : "Open secure verification"}
          </button>
        )}
        <a href="/identity" className="quiet capture-back">
          <ArrowLeft size={17} /> Check identity status
        </a>
      </div>
    </main>
  );
}
