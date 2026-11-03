"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  LockKeyhole,
  Mail,
  Smartphone,
  LogOut,
  ChevronLeft,
} from "lucide-react";

async function api(path, data, method = data === undefined ? "GET" : "POST") {
  let r;
  try {
    r = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Zetmond-Request": "1" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
  } catch {
    throw new Error(
      "Cannot connect right now. Check your connection and try again.",
    );
  }
  const body = await r
    .json()
    .catch(() => ({ message: "Service unavailable. Please try again." }));
  if (!r.ok) {
    const e = new Error(body.message || "Unable to complete this request.");
    e.fields = body.fields;
    e.status = r.status;
    throw e;
  }
  return body;
}
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
  login: ["Welcome back.", "Sign in to continue to your Zetmond account."],
  register: [
    "Your next chapter.",
    "Create your account. Verify your identity before using financial services.",
  ],
  "forgot-password": [
    "Let’s get you back in.",
    "We’ll send a secure reset link if an account matches your email.",
  ],
  "reset-password": [
    "A fresh start.",
    "Choose a new password to secure your account.",
  ],
  "verify-contacts": [
    "Make it yours.",
    "Verify your email and phone before continuing.",
  ],
  mfa: [
    "One more check.",
    "Enter an authenticator code or an unused recovery code.",
  ],
  "mfa-setup": [
    "A stronger lock.",
    "Add an authenticator app to protect your account.",
  ],
  account: ["Your account.", "Your verification progress, all in one place."],
  security: ["Stay in control.", "Manage your authenticator and password."],
  sessions: [
    "Your signed-in devices.",
    "Review your sessions and revoke access you no longer recognise.",
  ],
  "admin-access": [
    "Administrator access.",
    "Your identity and administrator permissions have been verified.",
  ],
};

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
      <label className="field" htmlFor={name}>
        {label}
        <input
          id={name}
          name={name}
          required={!options.optional}
          aria-invalid={!!fields[name]}
          aria-describedby={fields[name] ? `${name}-error` : undefined}
          {...options}
        />
        {fields[name] && (
          <span className="field-error" id={`${name}-error`}>
            {fields[name][0]}
          </span>
        )}
      </label>
    );
  }
  const submit = (label) => (
    <button className="primary" type="submit" disabled={busy || loading}>
      {busy ? "Please wait…" : label}
      <ArrowRight size={18} aria-hidden="true" />
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
  async function verify(e, purpose) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const d = await api("auth/verify", { purpose, code: f.get("code") });
      setUser(d.user);
      setMessage(`${purpose === "email" ? "Email" : "Phone"} verified.`);
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
    <div className="auth-layout">
      <aside className="story">
        <Link className="brand" href="/login" aria-label="Zetmond sign in">
          <span className="brand-mark">Z</span>zetmond
          <span className="brand-dot">.</span>
        </Link>
        <div className="story-copy">
          <p className="eyebrow">YOUR WORLD. MORE CONNECTED.</p>
          <h2>
            A little closer
            <br />
            to what’s next.
          </h2>
          <p>One account. A clearer way to move forward.</p>
          <div className="orbit" aria-hidden="true">
            <div className="orbit-center">Z</div>
            <span className="orbit-pill pill-one">Built around you</span>
            <span className="orbit-pill pill-two">
              <ShieldCheck size={16} />
              Protected access
            </span>
          </div>
        </div>
        <p className="story-footer">Zetmond · Built for your everyday.</p>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <Link href="/login" className="mobile-brand">
            zetmond.
          </Link>
          {publicScreen ? (
            <span>
              {screen === "register"
                ? "Already have an account?"
                : "New to Zetmond?"}{" "}
              <Link href={screen === "register" ? "/login" : "/register"}>
                {screen === "register" ? "Sign in" : "Create account"}
              </Link>
            </span>
          ) : (
            <button className="quiet" onClick={logout} disabled={busy}>
              <LogOut size={16} /> Sign out
            </button>
          )}
        </header>
        <div
          className={`content ${["account", "security", "sessions", "verify-contacts"].includes(screen) ? "wide" : ""}`}
        >
          {!publicScreen && (
            <nav className="account-nav" aria-label="Account">
              <Link href="/account">Account</Link>
              <Link href="/security">Security</Link>
              <Link href="/sessions">Devices</Link>
            </nav>
          )}
          <div className="heading-icon">
            <LockKeyhole size={24} />
          </div>
          <h1>{title}</h1>
          <p className="intro">{subtitle}</p>
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
                placeholder: "you@example.com",
              })}
              {field("password", "Password", {
                type: "password",
                autoComplete: "current-password",
                maxLength: 128,
              })}
              <Link className="inline-link" href="/forgot-password">
                Forgot password?
              </Link>
              {submit("Sign in")}
              <p className="small">
                Administrators use this same sign-in page. Access is determined
                securely by your account.
              </p>
            </form>
          )}
          {!loading && screen === "register" && (
            <form onSubmit={register}>
              {field("email", "Email address", {
                type: "email",
                autoComplete: "email",
                placeholder: "you@example.com",
              })}
              <label className="field" htmlFor="country">
                Country
                <select
                  id="country"
                  aria-label="Country"
                  name="country"
                  autoComplete="country"
                  required
                >
                  <option value="">Select your country</option>
                  {policy?.countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} · {c.currency}
                    </option>
                  ))}
                </select>
              </label>
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
                At least 12 characters. Password managers and paste are
                supported.
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
              {policy?.development && (
                <p className="notice">
                  Development environment: legal policies and delivery providers
                  require approval before launch.
                </p>
              )}
              {submit("Create account")}
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
                    Open the complete reset link from your email. If it has
                    expired,{" "}
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
                {["email", "phone"].map((purpose) => (
                  <section className="panel" key={purpose}>
                    <div className="panel-title">
                      {purpose === "email" ? (
                        <Mail size={20} />
                      ) : (
                        <Smartphone size={20} />
                      )}
                      <h2>
                        {purpose === "email" ? "Email address" : "Phone number"}
                      </h2>
                    </div>
                    <p className="wrap">{user[purpose]}</p>
                    {user[
                      purpose === "email" ? "emailVerified" : "phoneVerified"
                    ] ? (
                      <p className="verified">
                        <Check size={16} />
                        Verified
                      </p>
                    ) : (
                      <>
                        <form onSubmit={(e) => verify(e, purpose)}>
                          <label className="field" htmlFor={`${purpose}-code`}>
                            Six-digit code
                            <input
                              id={`${purpose}-code`}
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
                              const d = await api("auth/resend", { purpose });
                              setMessage(d.message);
                            })
                          }
                        >
                          Send another code
                        </button>
                      </>
                    )}
                  </section>
                ))}
              </div>
              {user.emailVerified && user.phoneVerified && (
                <Link className="primary" href="/account">
                  Continue to your account
                  <ArrowRight size={18} />
                </Link>
              )}
              <p className="small">
                Contact verification is separate from identity verification.
                Wallet and trading access remain unavailable until KYC approval.
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
                Each recovery code works once. Support cannot bypass your
                security checks.
              </p>
            </form>
          )}
          {!loading && screen === "mfa-setup" && !codes && (
            <>
              {!mfa ? (
                <>
                  <p className="small">
                    Use an authenticator app such as Google Authenticator,
                    Microsoft Authenticator, or 1Password. Never share the setup
                    key.
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
              <section className="panel">
                <div className="panel-title">
                  <ShieldCheck size={20} />
                  <h2>Account readiness</h2>
                </div>
                <p className="wrap">{user.email}</p>
                <dl className="details">
                  <div>
                    <dt>Country</dt>
                    <dd>
                      {
                        policy?.countries.find((c) => c.code === user.country)
                          ?.name
                      }{" "}
                      · {user.currency}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      {user.emailVerified ? "Verified" : "Verification needed"}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      {user.phoneVerified ? "Verified" : "Verification needed"}
                    </dd>
                  </div>
                  <div>
                    <dt>Identity</dt>
                    <dd>
                      {user.kycStatus === "not_started"
                        ? "Not started"
                        : user.kycStatus}
                    </dd>
                  </div>
                </dl>
                {(!user.emailVerified || !user.phoneVerified) && (
                  <Link className="primary" href="/verify-contacts">
                    Verify your contacts
                    <ArrowRight size={18} />
                  </Link>
                )}
              </section>
              <div className="notice">
                <strong>Identity verification is next.</strong>
                <p>
                  KYC is not available yet. Wallet and trading actions remain
                  unavailable. No balance or financial activity is simulated
                  here.
                </p>
              </div>
              <Link className="inline-link" href="/security">
                Review your account security
              </Link>
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
                        const operationDigest = Array.from(
                          new Uint8Array(bytes),
                        )
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
                    <p className="wrap small">{s.user_agent}</p>
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
                          else
                            setSessions(sessions.filter((v) => v.id !== s.id));
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
                  The operations portal will be delivered in Task 10. No
                  financial administration actions are available here.
                </p>
              </section>
            )}
          <footer className="form-footer">
            <LockKeyhole size={14} /> Your credentials stay private. Never share
            verification codes.
          </footer>
        </div>
      </main>
    </div>
  );
}
