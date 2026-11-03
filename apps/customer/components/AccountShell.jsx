"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  UserRound,
  KeyRound,
  MonitorSmartphone,
  LogOut,
  LockKeyhole,
} from "lucide-react";
import Brand from "./Brand";
import AppearanceToggle from "./AppearanceToggle";

const navigation = [
  {
    href: "/account",
    label: "My account",
    Icon: UserRound,
    screens: ["account", "verify-contacts"],
  },
  {
    href: "/security",
    label: "Security",
    Icon: KeyRound,
    screens: ["security", "mfa-setup", "mfa"],
  },
  {
    href: "/sessions",
    label: "Devices",
    Icon: MonitorSmartphone,
    screens: ["sessions"],
  },
];

function AccountNavigation({ screen }) {
  return (
    <nav className="account-nav" aria-label="Account">
      {navigation.map(({ href, label, Icon, screens }) => (
        <Link
          key={href}
          href={href}
          aria-current={screens.includes(screen) ? "page" : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
          <ArrowUpRight size={16} className="nav-arrow" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

export default function AccountShell({
  screen,
  publicScreen,
  user,
  busy,
  logout,
  children,
}) {
  const accountView = !publicScreen && user && !user.state.startsWith("mfa_");
  return (
    <div className={accountView ? "account-layout" : "auth-layout"}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {accountView && (
        <aside className="account-sidebar">
          <Brand href="/account" />
          <p className="sidebar-label">YOUR ACCOUNT</p>
          <AccountNavigation screen={screen} />
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <ShieldCheck size={25} />
              <h2>
                Make security
                <br />
                second nature.
              </h2>
              <p>A little extra protection goes a long way.</p>
              <Link href="/security">
                Review security <ArrowRight size={16} />
              </Link>
            </div>
            <p className="sidebar-copyright">
              © {new Date().getFullYear()} Zetmond
            </p>
          </div>
        </aside>
      )}
      <div className={accountView ? "account-workspace" : "auth-workspace"}>
        <header className="site-header">
          <div className="header-brand">
            <Brand href={accountView ? "/account" : "/login"} />
          </div>
          {accountView && (
            <p className="header-breadcrumb">
              Account <span>/</span>{" "}
              {screen === "sessions"
                ? "Devices"
                : screen === "security"
                  ? "Security"
                  : screen === "verify-contacts"
                    ? "Verification"
                    : "Overview"}
            </p>
          )}
          <div className="header-actions">
            <AppearanceToggle />
            {publicScreen ? (
              <Link
                className="header-link"
                href={screen === "register" ? "/login" : "/register"}
              >
                {screen === "register" ? "Sign in" : "Create account"}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <button className="quiet" onClick={logout} disabled={busy}>
                <LogOut size={16} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </header>
        {accountView && (
          <div className="mobile-account-nav">
            <AccountNavigation screen={screen} />
          </div>
        )}
        <main id="main" className={accountView ? "account-main" : "auth-main"}>
          <div
            className={`content ${["account", "security", "sessions", "verify-contacts"].includes(screen) ? "wide" : ""}`}
          >
            {children}
          </div>
          {!accountView && (
            <aside className="brand-showcase" aria-label="About Zetmond">
              <div className="showcase-heading">
                <p className="eyebrow">
                  <span />
                  THE ZETMOND WAY
                </p>
                <h2>
                  Your USDT.
                  <br />
                  <span>Your next move.</span>
                </h2>
                <p>A clearer way to hold, send, and trade.</p>
              </div>
              <div className="showcase-art" aria-hidden="true">
                <img
                  src="/images/hero-vault.png"
                  alt=""
                  width="1254"
                  height="1254"
                  fetchPriority="low"
                />
              </div>
              <div className="showcase-footer">
                <span>
                  WALLET <i /> P2P <i /> VAULT
                </span>
                <ArrowUpRight size={24} aria-hidden="true" />
              </div>
            </aside>
          )}
        </main>
        {!accountView && (
          <footer className="site-footer">
            <span>© {new Date().getFullYear()} Zetmond</span>
            <span>
              <LockKeyhole size={13} aria-hidden="true" /> A secure place to
              begin.
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
