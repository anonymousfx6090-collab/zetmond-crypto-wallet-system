"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import AccountShell from "./AccountShell";
import FormField from "./FormField";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  LockKeyhole,
  Mail,
  Smartphone,
  ChevronLeft,
  ArrowUpRight,
  UserRound,
  Loader2,
  Globe2,
} from "lucide-react";

import { api } from "../lib/api";
function destination(u) {
  return (
    {
      mfa_required: "/mfa",
      mfa_setup_required: "/mfa-setup",
      admin: "/admin-access",
      verify_contacts: "/verify-contacts",
    }[u.state] || "/account"
  );
}
const titles = {
  login: ["Welcome back", "Good to see you again. Sign in to your account."],
  register: [
    "Your journey starts here",
    "Create your Zetmond account. We’ll take it one step at a time.",
  ],
  "forgot-password": [
    "Forgot your password?",
    "Enter your email and we’ll help you get back in.",
  ],
  "reset-password": [
    "Set a new password",
    "Choose a strong password you haven’t used before.",
  ],
  "verify-contacts": [
    "Let’s make it official",
    "Confirm your email so we know it’s really you.",
  ],
  mfa: [
    "A quick security check",
    "Enter a code from your authenticator app or an unused recovery code.",
  ],
  "mfa-setup": [
    "An extra layer of protection",
    "Connect your authenticator app to keep your account secure.",
  ],
  account: [
    "You’re in. Let’s get set up.",
    "A few simple steps to make your account yours.",
  ],
  security: [
    "Your security, your control",
    "Manage how you sign in and protect your account.",
  ],
  sessions: [
    "Keep track of your devices",
    "See where you’re signed in and manage access.",
  ],
  "admin-access": [
    "Administrator access",
    "Manage your secure access to Zetmond.",
  ],
};
const eyebrows = {
  login: "YOUR NEXT CHAPTER",
  register: "WELCOME TO ZETMOND",
  "forgot-password": "ACCOUNT RECOVERY",
  "reset-password": "ACCOUNT RECOVERY",
  "verify-contacts": "VERIFY YOUR EMAIL",
  mfa: "PROTECTED ACCESS",
  "mfa-setup": "ACCOUNT SECURITY",
  account: "LET’S GET STARTED",
  security: "PEACE OF MIND",
  sessions: "ACCOUNT ACCESS",
  "admin-access": "PROTECTED WORKSPACE",
};
function deviceLabel(agent) {
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "Browser";
  const platform = /iPhone|iPad/.test(agent)
    ? "iOS"
    : /Android/.test(agent)
      ? "Android"
      : /Windows/.test(agent)
        ? "Windows"
        : /Macintosh/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "Unknown device";
  return `${browser} on ${platform}`;
}

export default function AccountApp({ screen }) {
  const router = useRouter();
  const [user, setUser] = useState(null),
    [policy, setPolicy] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState({}),
    [message, setMessage] = useState(""),
    [mfa, setMfa] = useState(null),
    [qr, setQr] = useState(""),
    [codes, setCodes] = useState(null),
    [sessions, setSessions] = useState([]),
    [resetToken, setResetToken] = useState(""),
    [done, setDone] = useState(false);
  const errorRef = useRef(null);
  const publicScreen = [
    "login",
    "register",
    "forgot-password",
    "reset-password",
  ].includes(screen);
  useEffect(() => {
    let alive = true;
    if (screen === "reset-password") {
      const code =
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      if (code) {
        setResetToken(code);
        history.replaceState(null, "", window.location.pathname);
      }
    }
    (async () => {
      try {
        const p = await api("auth/policy");
        if (alive) setPolicy(p);
        if (!publicScreen) {
          const me = await api("auth/me");
          if (!alive) return;
          setUser(me.user);
          const dest = destination(me.user);
          if (
            (me.user.state.startsWith("mfa_") &&
              screen !== "mfa-setup" &&
              screen !== "mfa") ||
            (screen === "mfa" && me.user.state === "mfa_setup_required")
          ) {
            router.replace(dest);
            return;
          }
          if (screen === "admin-access") await api("admin/access");
          if (screen === "sessions") {
            const d = await api("auth/sessions");
            if (alive) setSessions(d.sessions);
          }
        }
      } catch (e) {
        if (!alive) return;
        if (e.status === 401) router.replace("/login");
        else setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [screen, publicScreen, router]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function action(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setFields(e.fields || {});
    } finally {
      setBusy(false);
    }
  }
  function field(name, label, options = {}) {
    return (
      <FormField name={name} label={label} error={fields[name]} {...options} />
    );
  }
  const submit = (label) => (
    <button className="primary" type="submit" disabled={busy || loading}>
      {busy ? "Please wait…" : label}
      {busy ? (
        <Loader2 size={18} className="spinner" aria-hidden="true" />
      ) : (
        <ArrowRight size={18} aria-hidden="true" />
      )}
    </button>
  );
  async function login(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const d = await api("auth/login", Object.fromEntries(f));
      router.replace(destination(d.user));
    });
  }
  async function register(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const d = await api("auth/register", {
        ...Object.fromEntries(f),
        acceptTerms: f.get("acceptTerms") === "on",
        policyVersion: policy.termsVersion,
      });
      if (d.user) router.replace(destination(d.user));
      else setMessage(d.message);
    });
  }
  async function verify(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const d = await api("auth/verify", {
        purpose: "email",
        code: f.get("code"),
      });
      setUser(d.user);
      setMessage("Email verified.");
    });
  }
  async function setup() {
    await action(async () => {
      const d = await api("auth/mfa/setup", {});
      setMfa(d);
      setQr(await QRCode.toDataURL(d.uri, { width: 220, margin: 1 }));
    });
  }
  async function factor(e, enroll) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const d = await api(enroll ? "auth/mfa/confirm" : "auth/mfa/verify", {
        code: f.get("code"),
      });
      setUser(d.user);
      if (enroll) {
        setCodes(d.recoveryCodes);
        setMfa(null);
        setQr("");
      } else router.replace(destination(d.user));
    });
  }
  async function logout() {
    await action(async () => {
      await api("auth/logout", {});
      router.replace("/login");
    });
  }
  const [title, subtitle] = titles[screen];
  return (
    <AccountShell
      screen={screen}
      publicScreen={publicScreen}
      user={user}
      busy={busy}
      logout={logout}
    >
      <header className="screen-heading">
        <p className="eyebrow">{eyebrows[screen]}</p>
        <h1>{title}</h1>
        <p className="intro">{subtitle}</p>
      </header>
      {policy?.deploymentStage === "staging" && (
        <aside className="notice" role="note" aria-label="Staging environment">
          Test environment. Use test accounts only. Wallet transfers and trading
          are unavailable.
        </aside>
      )}
      {loading && <p role="status">Loading your account…</p>}
      {error && (
        <div
          className="notice error"
          role="alert"
          aria-label="Account error"
          tabIndex={-1}
          ref={errorRef}
        >
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {!loading && screen === "login" && (
        <form onSubmit={login}>
          {field("email", "Email address", {
            type: "email",
            autoComplete: "username",
            placeholder: "Enter your email",
          })}
          {field("password", "Password", {
            type: "password",
            autoComplete: "current-password",
            maxLength: 128,
            placeholder: "Enter your password",
          })}
          <Link className="inline-link" href="/forgot-password">
            Forgot password?
          </Link>
          {submit("Sign in")}
          <div className="form-divider">
            <span>NEW TO ZETMOND?</span>
          </div>
          <Link className="secondary secondary-full" href="/register">
            Create an account
            <ArrowUpRight size={17} />
          </Link>
          <p className="auth-reassurance">
            <ShieldCheck size={16} aria-hidden="true" /> Your next move starts
            with secure access.
          </p>
        </form>
      )}
      {!loading && screen === "register" && (
        <form onSubmit={register}>
          {field("email", "Email address", {
            type: "email",
            autoComplete: "email",
            placeholder: "Enter your email",
          })}
          <div className="field">
            <label htmlFor="country">Country of residence</label>
            <div className="input-wrap">
              <Globe2 size={18} className="input-icon" aria-hidden="true" />
              <select
                id="country"
                aria-label="Country"
                name="country"
                autoComplete="country"
                required
                aria-invalid={!!fields.country}
                aria-describedby={fields.country ? "country-error" : undefined}
              >
                <option value="">Select your country</option>
                {policy?.countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} · {c.currency}
                  </option>
                ))}
              </select>
            </div>
            {fields.country && (
              <span className="field-error" id="country-error">
                {fields.country[0]}
              </span>
            )}
          </div>
          {field("phone", "Phone number", {
            type: "tel",
            autoComplete: "tel",
            placeholder: "+234…",
          })}
          <p className="hint">
            Use the international number for your registration country.
          </p>
          {field("password", "Password", {
            type: "password",
            autoComplete: "new-password",
            minLength: 12,
            maxLength: 128,
          })}
          <p className="hint">
            Use at least 12 characters for a stronger password.
          </p>
          <label className="checkbox">
            <input name="acceptTerms" type="checkbox" required />
            <span>
              I am at least 18 and accept the{" "}
              <a
                href={policy?.termsUrl || "/policies"}
                target="_blank"
                rel="noreferrer"
              >
                account terms
              </a>{" "}
              and{" "}
              <a
                href={policy?.privacyUrl || "/policies"}
                target="_blank"
                rel="noreferrer"
              >
                privacy notice
              </a>
              .
            </span>
          </label>
          {policy?.development && policy?.deploymentStage !== "staging" && (
            <p className="notice">
              Test environment. Please use test details. Financial services are
              not available yet.
            </p>
          )}
          {submit("Create account")}
          <p className="switch-form">
            Already part of Zetmond?{" "}
            <Link href="/login">
              Sign in
              <ArrowUpRight size={14} />
            </Link>
          </p>
        </form>
      )}
      {!loading && screen === "forgot-password" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action(async () => {
              const d = await api("auth/forgot-password", {
                email: f.get("email"),
              });
              setMessage(d.message);
            });
          }}
        >
          {field("email", "Email address", {
            type: "email",
            autoComplete: "email",
          })}
          {submit("Send reset link")}
          <Link className="back-link" href="/login">
            <ChevronLeft size={16} />
            Back to sign in
          </Link>
        </form>
      )}
      {!loading &&
        screen === "reset-password" &&
        (done ? (
          <Link className="primary" href="/login">
            Sign in with your new password
          </Link>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action(async () => {
                const d = await api("auth/reset-password", {
                  token: resetToken,
                  password: f.get("password"),
                });
                setMessage(d.message);
                setResetToken("");
                setDone(true);
              });
            }}
          >
            {!resetToken && (
              <p className="notice">
                Open the complete reset link from your email. If it has expired,{" "}
                <Link href="/forgot-password">request another</Link>.
              </p>
            )}
            {field("password", "New password", {
              type: "password",
              minLength: 12,
              maxLength: 128,
              autoComplete: "new-password",
            })}
            {submit("Update password")}
          </form>
        ))}
      {!loading && user && screen === "verify-contacts" && (
        <>
          <div className="contact-grid">
            <section className="panel">
              <div className="panel-title">
                <Mail size={20} />
                <h2>Email address</h2>
              </div>
              <p className="wrap">{user.email}</p>
              {user.emailVerified ? (
                <p className="verified">
                  <Check size={16} />
                  Verified
                </p>
              ) : (
                <>
                  <p className="small">
                    Check your inbox and Spam folder. If you request another
                    code, use the most recent email; earlier codes stop working.
                  </p>
                  <form onSubmit={verify}>
                    <label className="field" htmlFor="email-code">
                      Six-digit code
                      <input
                        id="email-code"
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                      />
                    </label>
                    {submit("Verify")}
                  </form>
                  <button
                    className="quiet resend"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        const d = await api("auth/resend", {
                          purpose: "email",
                        });
                        setMessage(d.message);
                      })
                    }
                  >
                    Send another code
                  </button>
                </>
              )}
            </section>
          </div>
          {user.emailVerified && (
            <Link className="primary" href="/account">
              Continue to your account
              <ArrowRight size={18} />
            </Link>
          )}
          <p className="small">
            Email verification is separate from identity verification. Wallet
            and trading access remain unavailable until KYC approval.
          </p>
        </>
      )}
      {!loading && screen === "mfa" && (
        <form onSubmit={(e) => factor(e, false)}>
          {field("code", "Authenticator or recovery code", {
            autoComplete: "one-time-code",
            maxLength: 80,
          })}
          {submit("Verify and continue")}
          <p className="small">
            Each recovery code works once. Support cannot bypass your security
            checks.
          </p>
        </form>
      )}
      {!loading && screen === "mfa-setup" && !codes && (
        <>
          {!mfa ? (
            <>
              <p className="small">
                Use an authenticator app such as Google Authenticator, Microsoft
                Authenticator, or 1Password. Never share the setup key.
              </p>
              <button className="primary" disabled={busy} onClick={setup}>
                Set up authenticator
                <ShieldCheck size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="setup-key">
                {qr && (
                  <img
                    src={qr}
                    alt="Scan this QR code with your authenticator app"
                    width="220"
                    height="220"
                  />
                )}
                <p>Or enter this key manually:</p>
                <code>{mfa.secret}</code>
              </div>
              <form onSubmit={(e) => factor(e, true)}>
                {field("code", "Six-digit authenticator code", {
                  inputMode: "numeric",
                  pattern: "[0-9]{6}",
                  maxLength: 6,
                  autoComplete: "one-time-code",
                })}
                {submit("Enable authenticator")}
              </form>
            </>
          )}
        </>
      )}
      {codes && (
        <section className="panel">
          <h2>Save your recovery codes</h2>
          <p>
            Store these somewhere private. They are shown only once and each
            works once.
          </p>
          <div className="recovery-codes">
            {codes.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => {
              setCodes(null);
              router.replace(destination(user));
            }}
          >
            I’ve stored my codes securely
            <ArrowRight size={18} />
          </button>
        </section>
      )}
      {!loading && user && screen === "account" && (
        <>
          {user.marketSupported === false && (
            <p className="notice" role="note">
              Zetmond currently supports Nigeria, Ghana and Kenya. Verification
              and financial features are unavailable for this account country.
            </p>
          )}
          <section className="profile-banner" aria-label="Your profile">
            <div className="profile-avatar" aria-hidden="true">
              {user.email[0].toUpperCase()}
            </div>
            <div className="profile-summary">
              <p className="profile-caption">PERSONAL ACCOUNT</p>
              <h2>{user.email}</h2>
              <p>
                <Globe2 size={14} aria-hidden="true" />
                {policy?.countries.find((c) => c.code === user.country)?.name ||
                  user.country}
                <span>·</span>
                {user.currency || "Unavailable"}
              </p>
            </div>
            <span
              className={`status-chip ${user.kycStatus === "approved" ? "complete" : "pending"}`}
            >
              {
                {
                  approved: "Identity verified",
                  pending: "Verification in review",
                  restricted: "Account restricted",
                  not_started: "Identity not verified",
                }[user.kycStatus]
              }
            </span>
          </section>
          <div className="account-grid">
            <section className="panel checklist-panel">
              <div className="panel-title">
                <h2>Make yourself at home</h2>
                <span className="step-count">
                  {
                    [user.emailVerified, user.kycStatus === "approved"].filter(
                      Boolean,
                    ).length
                  }{" "}
                  of 2 complete
                </span>
              </div>
              <p className="panel-description">
                Your next steps to a verified account.
              </p>
              <ol className="setup-checklist">
                {[
                  {
                    label: "Verify your email",
                    detail: user.emailVerified
                      ? "Your email address is confirmed."
                      : "Confirm the code sent to your inbox.",
                    done: user.emailVerified,
                    Icon: Mail,
                  },
                  {
                    label: "Verify your identity",
                    detail:
                      user.kycStatus === "approved"
                        ? "Your identity has been verified."
                        : "View your identity checks and next steps.",
                    done: user.kycStatus === "approved",
                    Icon: UserRound,
                  },
                ].map(({ label, detail, done, Icon }, index) => (
                  <li key={label} className={done ? "is-complete" : ""}>
                    <span className="checklist-icon">
                      {done ? <Check size={18} /> : <Icon size={18} />}
                    </span>
                    <div>
                      <h3>{label}</h3>
                      <p>{detail}</p>
                    </div>
                    {done ? (
                      <span className="checklist-status">Done</span>
                    ) : index === 0 ? (
                      <Link href="/verify-contacts" aria-label={label}>
                        <ArrowUpRight size={20} />
                      </Link>
                    ) : (
                      <Link href="/identity" aria-label={label}>
                        <ArrowUpRight size={20} />
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
              {!user.emailVerified && (
                <Link className="primary" href="/verify-contacts">
                  Verify your email
                  <ArrowRight size={18} />
                </Link>
              )}
            </section>
            <section className="security-summary">
              <div className="security-emblem">
                <ShieldCheck size={29} />
              </div>
              <h2>
                A little extra
                <br />
                peace of mind.
              </h2>
              <p>
                {user.mfaEnabled
                  ? "Your authenticator adds another layer of protection to sensitive actions."
                  : "Protect your account with an authenticator. It’s a small step that makes a difference."}
              </p>
              <Link href="/security">
                {user.mfaEnabled
                  ? "Review your security"
                  : "Secure your account"}
                <ArrowUpRight size={17} />
              </Link>
            </section>
          </div>
          {user.kycStatus !== "approved" && (
            <div className="next-step-note">
              <span className="next-step-icon">
                <LockKeyhole size={20} />
              </span>
              <div>
                <strong>Identity verification is next.</strong>
                <p>
                  Wallet and trading access will remain unavailable until
                  identity verification is enabled and approved.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {!loading && user && screen === "security" && (
        <>
          <section className="panel">
            <h2>Authenticator protection</h2>
            <p>
              {user.mfaEnabled
                ? "Your authenticator is enabled. A fresh code is required for sensitive changes."
                : "Add an authenticator before making sensitive account changes."}
            </p>
            {!user.mfaEnabled && (
              <Link className="primary" href="/mfa-setup">
                Set up authenticator
                <ShieldCheck size={18} />
              </Link>
            )}
          </section>
          {user.mfaEnabled && (
            <section className="panel">
              <h2>Change password</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  action(async () => {
                    const password = f.get("password");
                    const bytes = await crypto.subtle.digest(
                      "SHA-256",
                      new TextEncoder().encode(password),
                    );
                    const operationDigest = Array.from(new Uint8Array(bytes))
                      .map((b) => b.toString(16).padStart(2, "0"))
                      .join("");
                    const grant = await api("auth/step-up", {
                      purpose: "password_change",
                      operationDigest,
                      code: f.get("code"),
                    });
                    await api("auth/change-password", {
                      currentPassword: f.get("currentPassword"),
                      password,
                      stepUpId: grant.stepUpId,
                    });
                    router.replace("/login");
                  });
                }}
              >
                {field("currentPassword", "Current password", {
                  type: "password",
                  autoComplete: "current-password",
                  maxLength: 128,
                })}
                {field("password", "New password", {
                  type: "password",
                  autoComplete: "new-password",
                  minLength: 12,
                  maxLength: 128,
                })}
                {field("code", "Fresh authenticator or recovery code", {
                  autoComplete: "one-time-code",
                  maxLength: 80,
                })}
                {submit("Update password and sign out")}
              </form>
            </section>
          )}
          <Link className="inline-link" href="/sessions">
            Review signed-in devices
          </Link>
        </>
      )}
      {!loading && screen === "sessions" && (
        <div className="session-list">
          {sessions.length === 0 ? (
            <p>No active sessions to show.</p>
          ) : (
            sessions.map((s) => (
              <section key={s.id} className="panel">
                <div className="panel-title">
                  <Smartphone size={20} />
                  <h2>{s.current ? "This device" : "Signed-in device"}</h2>
                </div>
                <p className="device-label">{deviceLabel(s.user_agent)}</p>
                <p className="small">
                  Signed in {new Date(s.created_at).toLocaleString()}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api(`auth/sessions/${s.id}`, {}, "DELETE");
                      if (s.current) router.replace("/login");
                      else setSessions(sessions.filter((v) => v.id !== s.id));
                    })
                  }
                >
                  {s.current ? "Sign out this device" : "Revoke access"}
                </button>
              </section>
            ))
          )}
        </div>
      )}
      {!loading &&
        user?.role === "admin" &&
        user.state === "admin" &&
        screen === "admin-access" && (
          <section className="panel">
            <ShieldCheck size={28} />
            <h2>Admin authentication is ready.</h2>
            <p>
              You’re signed in securely. The operations workspace is not
              available yet.
            </p>
          </section>
        )}
      {!publicScreen && (
        <footer className="form-footer">
          <ShieldCheck size={15} aria-hidden="true" /> Keep your account yours.
          Never share verification codes.
        </footer>
      )}
    </AccountShell>
  );
}
