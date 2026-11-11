import { randomUUID, randomInt } from "node:crypto";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { PoolClient } from "pg";
import { Config } from "../config";
import { Database } from "../db";
import { digest, hash, seal, token, unseal } from "../crypto";
import { Delivery } from "../delivery/delivery.service";
import {
  Country,
  currency,
  isSupportedCountry,
  unavailableCountryMessage,
} from "../markets";

const rejected = (message = "Authentication required.", status = 401) => ({
  error: message,
  status,
});
export class AuthService {
  private dummy = argon2.hash(token(), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  constructor(
    readonly db: Database,
    readonly config: Config,
    readonly delivery: Delivery,
  ) {}
  async audit(
    c: PoolClient,
    userId: string | null,
    action: string,
    metadata: object = {},
  ) {
    await c.query(
      "INSERT INTO audit_events(user_id,action,metadata) VALUES($1,$2,$3)",
      [userId, action, JSON.stringify(metadata)],
    );
  }
  async rate(
    key: string,
    connection: Pick<PoolClient, "query"> = this.db.pool,
  ) {
    const r = await connection.query(
      `INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+make_interval(secs=>$2))
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=now() THEN 1 ELSE rate_limits.count+1 END,
   reset_at=CASE WHEN rate_limits.reset_at<=now() THEN excluded.reset_at ELSE rate_limits.reset_at END RETURNING count`,
      [hash(key), this.config.RATE_WINDOW_SECONDS],
    );
    return r.rows[0].count <= this.config.RATE_LIMIT;
  }
  async current(c: PoolClient, value: string | undefined, pending = false) {
    if (!value) return null;
    const session = (
      await c.query("SELECT user_id FROM sessions WHERE token_hash=$1", [
        hash(value),
      ])
    ).rows[0];
    if (!session) return null;
    // All account operations acquire the user lock before any session/challenge locks.
    const account = (
      await c.query(
        "SELECT u.*, (SELECT a.mode FROM identity_cases k JOIN identity_attempts a ON a.id=k.current_attempt_id WHERE k.user_id=u.id AND a.status='approved') AS identity_mode FROM users u WHERE u.id=$1 FOR UPDATE",
        [session.user_id],
      )
    ).rows[0];
    const active = (
      await c.query(
        `SELECT id AS session_id,mfa_verified,created_at AS session_created_at FROM sessions
      WHERE user_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`,
        [session.user_id, hash(value)],
      )
    ).rows[0];
    const u = account && active ? { ...account, ...active } : null;
    if (!u || u.restricted || (!pending && !u.mfa_verified)) return null;
    return u;
  }
  view(u: any) {
    const marketSupported = isSupportedCountry(u.country);
    const state = !u.mfa_verified
      ? u.mfa_secret
        ? "mfa_required"
        : "mfa_setup_required"
      : u.role === "admin"
        ? "admin"
        : !u.email_verified
          ? "verify_contacts"
          : u.kyc_status !== "approved"
            ? "kyc_required"
            : "customer";
    return {
      id: u.id,
      email: u.email,
      phone: u.phone,
      country: u.country,
      currency: marketSupported ? currency[u.country as Country] : null,
      marketSupported,
      availabilityMessage: marketSupported
        ? undefined
        : unavailableCountryMessage,
      role: u.role,
      emailVerified: u.email_verified,
      phoneVerified: u.phone_verified,
      kycStatus: u.kyc_status,
      mfaEnabled: !!u.mfa_secret,
      state,
      financialAccess:
        marketSupported &&
        this.config.DEPLOYMENT_STAGE !== "staging" &&
        (this.config.NODE_ENV !== "production" || u.identity_mode === "live") &&
        u.role === "customer" &&
        u.mfa_verified &&
        u.email_verified &&
        u.kyc_status === "approved" &&
        !u.restricted,
    };
  }
  async session(c: PoolClient, u: any, agent: string) {
    if (this.config.NODE_ENV === "production") {
      u.identity_mode = (
        await c.query(
          "SELECT a.mode FROM identity_cases k JOIN identity_attempts a ON a.id=k.current_attempt_id WHERE k.user_id=$1 AND a.status='approved'",
          [u.id],
        )
      ).rows[0]?.mode;
    }
    const value = token(),
      id = randomUUID(),
      mfaVerified = u.role !== "admin" && !u.mfa_secret;
    const minutes =
      u.role === "admin"
        ? this.config.ADMIN_SESSION_MINUTES
        : this.config.SESSION_MINUTES;
    await c.query(
      "INSERT INTO sessions(id,user_id,token_hash,mfa_verified,expires_at,user_agent) VALUES($1,$2,$3,$4,now()+make_interval(mins=>$5),$6)",
      [id, u.id, hash(value), mfaVerified, minutes, agent.slice(0, 300)],
    );
    return {
      sessionToken: value,
      user: this.view({ ...u, mfa_verified: mfaVerified }),
      maxAge: minutes * 60000,
    };
  }
  async challenge(c: PoolClient, u: any, purpose: "email" | "reset") {
    const recent = await c.query(
      "SELECT 1 FROM challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-make_interval(secs=>$3)",
      [u.id, purpose, this.config.RESEND_SECONDS],
    );
    if (recent.rowCount) return false;
    const code =
      purpose === "reset" ? token() : String(randomInt(100000, 1000000));
    await c.query(
      "UPDATE challenges SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL",
      [u.id, purpose],
    );
    await c.query(
      `UPDATE delivery_outbox SET status='cancelled',payload='' WHERE id IN (
         SELECT o.id FROM delivery_outbox o JOIN challenges ch ON ch.id=o.challenge_id
         WHERE ch.user_id=$1 AND ch.purpose=$2 AND o.status IN ('queued','failed')
         FOR UPDATE OF o SKIP LOCKED)`,
      [u.id, purpose],
    );
    const challengeId = randomUUID();
    await c.query(
      "INSERT INTO challenges(id,user_id,purpose,digest,expires_at) VALUES($1,$2,$3,$4,now()+make_interval(mins=>$5))",
      [
        challengeId,
        u.id,
        purpose,
        digest(this.config.DATA_ENCRYPTION_KEY, code),
        this.config.CHALLENGE_MINUTES,
      ],
    );
    const text =
      purpose === "reset"
        ? `Reset your Zetmond password: ${this.config.APP_ORIGIN}/reset-password#token=${code}\nThis link expires in ${this.config.CHALLENGE_MINUTES} minutes. If you did not request this, ignore it.`
        : `Your Zetmond email verification code is ${code}. It expires in ${this.config.CHALLENGE_MINUTES} minutes.`;
    await this.delivery.enqueue(
      c,
      u.id,
      "email",
      {
        to: u.email,
        subject: "Zetmond account verification",
        text,
      },
      new Date(Date.now() + this.config.CHALLENGE_MINUTES * 60000),
      challengeId,
    );
    return true;
  }
  async register(input: any, agent: string) {
    if (!isSupportedCountry(input.country))
      return rejected(unavailableCountryMessage, 403);
    if (input.policyVersion !== this.config.TERMS_VERSION)
      return rejected("Please review the current policy version.", 400);
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    return this.db.tx(async (c) => {
      const r = await c.query(
        `INSERT INTO users(id,email,phone,password_hash,country,policy_version,policy_accepted_at)
    VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT DO NOTHING RETURNING *`,
        [
          randomUUID(),
          input.email,
          input.phone,
          passwordHash,
          input.country,
          input.policyVersion,
        ],
      );
      if (!r.rowCount)
        return {
          message:
            "If these details can be registered, verification instructions will be sent. Otherwise, sign in or recover access.",
        };
      const u = r.rows[0];
      await this.challenge(c, u, "email");
      await this.audit(c, u.id, "registered");
      return this.session(c, u, agent);
    });
  }
  async login(input: any, agent: string) {
    return this.db.tx(async (c) => {
      const u = (
        await c.query("SELECT * FROM users WHERE email=$1 FOR UPDATE", [
          input.email,
        ])
      ).rows[0];
      const valid = await argon2.verify(
        u?.password_hash || (await this.dummy),
        input.password,
      );
      if (!u) return rejected("Email or password is incorrect.");
      if (u.locked_until && new Date(u.locked_until) > new Date())
        return rejected("Email or password is incorrect.");
      if (!valid || u.restricted) {
        await c.query(
          "UPDATE users SET failed_logins=failed_logins+1,locked_until=CASE WHEN failed_logins+1 >= $2 THEN now()+make_interval(mins=>$3) ELSE locked_until END WHERE id=$1",
          [u.id, this.config.LOGIN_ATTEMPTS, this.config.LOCKOUT_MINUTES],
        );
        await this.audit(c, u.id, "login_failed");
        return rejected("Email or password is incorrect.");
      }
      await c.query(
        "UPDATE users SET failed_logins=0,locked_until=NULL WHERE id=$1",
        [u.id],
      );
      await this.audit(c, u.id, "login");
      return this.session(c, u, agent);
    });
  }
  async me(value?: string) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value, true);
      return u ? { user: this.view(u) } : rejected();
    });
  }
  async resend(value: string | undefined, purpose: "email") {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      if (!u) return rejected();
      if (u[`${purpose}_verified`])
        return { message: "Contact already verified." };
      const sent = await this.challenge(c, u, purpose);
      return sent
        ? { message: "Verification queued for delivery." }
        : rejected("Please wait before requesting another code.", 429);
    });
  }
  async verify(value: string | undefined, purpose: "email", code: string) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      if (!u) return rejected();
      const row = (
        await c.query(
          "SELECT * FROM challenges WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
          [u.id, purpose],
        )
      ).rows[0];
      if (
        !row ||
        new Date(row.expires_at) <= new Date() ||
        row.attempts >= this.config.CHALLENGE_ATTEMPTS
      )
        return rejected("Code invalid or expired. Request another code.", 400);
      await c.query("UPDATE challenges SET attempts=attempts+1 WHERE id=$1", [
        row.id,
      ]);
      if (row.digest !== digest(this.config.DATA_ENCRYPTION_KEY, code))
        return rejected("Code invalid or expired.", 400);
      await c.query("UPDATE challenges SET consumed_at=now() WHERE id=$1", [
        row.id,
      ]);
      await c.query("UPDATE users SET email_verified=true WHERE id=$1", [u.id]);
      u[`${purpose}_verified`] = true;
      await this.audit(c, u.id, `${purpose}_verified`);
      return { user: this.view(u) };
    });
  }
  async forgot(email: string) {
    return this.db.tx(async (c) => {
      const u = (
        await c.query("SELECT * FROM users WHERE email=$1 FOR UPDATE", [email])
      ).rows[0];
      if (u) await this.challenge(c, u, "reset");
      return {
        message:
          "If an account matches, password reset instructions will be sent.",
      };
    });
  }
  async reset(code: string, password: string) {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    return this.db.tx(async (c) => {
      // Lock user first, consistently with all other account operations.
      const u = (
        await c.query(
          `SELECT u.* FROM users u JOIN challenges ch ON ch.user_id=u.id WHERE ch.purpose='reset' AND ch.digest=$1 AND ch.consumed_at IS NULL AND ch.expires_at>now() FOR UPDATE OF u`,
          [digest(this.config.DATA_ENCRYPTION_KEY, code)],
        )
      ).rows[0];
      if (!u) return rejected("Reset link invalid or expired.", 400);
      const used = await c.query(
        "UPDATE challenges SET consumed_at=now() WHERE user_id=$1 AND purpose='reset' AND digest=$2 AND consumed_at IS NULL AND expires_at>now() RETURNING id",
        [u.id, digest(this.config.DATA_ENCRYPTION_KEY, code)],
      );
      if (!used.rowCount)
        return rejected("Reset link invalid or expired.", 400);
      await c.query(
        "UPDATE users SET password_hash=$2,failed_logins=0,locked_until=NULL WHERE id=$1",
        [u.id, passwordHash],
      );
      await c.query(
        "UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
        [u.id],
      );
      await c.query(
        "UPDATE challenges SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
        [u.id],
      );
      await this.audit(c, u.id, "password_recovered");
      await this.notice(
        c,
        u,
        "Your password was reset. All previous sessions were revoked.",
      );
      return { message: "Password updated. Sign in again." };
    });
  }
  async notice(c: PoolClient, u: any, text: string) {
    await this.delivery.enqueue(c, u.id, "email", {
      to: u.email,
      subject: "Zetmond security notice",
      text,
    });
  }
  async setupMfa(value: string | undefined) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value, true);
      if (!u) return rejected();
      if (u.mfa_secret)
        return rejected("Authenticator is already enabled.", 409);
      if (new Date(u.session_created_at).getTime() < Date.now() - 10 * 60000)
        return rejected(
          "Sign in again before enrolling an authenticator.",
          403,
        );
      const secret = authenticator.generateSecret();
      await c.query("UPDATE users SET mfa_pending=$2 WHERE id=$1", [
        u.id,
        seal(this.config.DATA_ENCRYPTION_KEY, secret),
      ]);
      return { secret, uri: authenticator.keyuri(u.email, "Zetmond", secret) };
    });
  }
  private async totp(c: PoolClient, u: any, code: string, secret: string) {
    if (!/^\d{6}$/.test(code)) return false;
    const delta = authenticator.checkDelta(code, secret);
    if (delta === null) return false;
    const step = Math.floor(Date.now() / 30000) + delta;
    if (step <= Number(u.last_totp_step)) return false;
    await c.query("UPDATE users SET last_totp_step=$2 WHERE id=$1", [
      u.id,
      step,
    ]);
    return true;
  }
  private async factor(c: PoolClient, u: any, code: string) {
    if (!(await this.rate(`mfa:${u.id}`, c))) return false;
    if (!u.mfa_secret) return false;
    if (/^\d{6}$/.test(code))
      return this.totp(
        c,
        u,
        code,
        unseal<string>(this.config.DATA_ENCRYPTION_KEY, u.mfa_secret),
      );
    const r = await c.query(
      "UPDATE recovery_codes SET used_at=now() WHERE user_id=$1 AND digest=$2 AND used_at IS NULL RETURNING digest",
      [u.id, digest(this.config.DATA_ENCRYPTION_KEY, code)],
    );
    if (r.rowCount) await this.audit(c, u.id, "recovery_code_used");
    return !!r.rowCount;
  }
  async confirmMfa(value: string | undefined, code: string) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value, true);
      if (!u) return rejected();
      if (!u.mfa_pending || u.mfa_secret)
        return rejected("Start authenticator enrollment first.", 400);
      if (!(await this.rate(`mfa:${u.id}`, c)))
        return rejected(
          "Too many authenticator attempts. Try again later.",
          429,
        );
      if (
        !(await this.totp(
          c,
          u,
          code,
          unseal<string>(this.config.DATA_ENCRYPTION_KEY, u.mfa_pending),
        ))
      )
        return rejected("Authenticator code invalid or already used.", 400);
      await c.query(
        "UPDATE users SET mfa_secret=mfa_pending,mfa_pending=NULL WHERE id=$1",
        [u.id],
      );
      const codes = Array.from({ length: 8 }, () => token().slice(0, 16));
      for (const code of codes)
        await c.query(
          "INSERT INTO recovery_codes(user_id,digest) VALUES($1,$2)",
          [u.id, digest(this.config.DATA_ENCRYPTION_KEY, code)],
        );
      await c.query(
        "UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL",
        [u.id, u.session_id],
      );
      u.mfa_secret = u.mfa_pending;
      await this.audit(c, u.id, "mfa_enrolled");
      await this.notice(
        c,
        u,
        "An authenticator was enrolled. Other sessions were revoked.",
      );
      return { ...(await this.elevate(c, u)), recoveryCodes: codes };
    });
  }
  private async elevate(c: PoolClient, u: any) {
    const value = token();
    await c.query(
      "UPDATE sessions SET mfa_verified=true,token_hash=$2 WHERE id=$1",
      [u.session_id, hash(value)],
    );
    const minutes =
      u.role === "admin"
        ? this.config.ADMIN_SESSION_MINUTES
        : this.config.SESSION_MINUTES;
    return {
      sessionToken: value,
      maxAge: minutes * 60000,
      user: this.view({ ...u, mfa_verified: true }),
    };
  }
  async verifyMfa(value: string | undefined, code: string) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value, true);
      if (!u) return rejected();
      if (u.mfa_verified)
        return rejected("This session is already authenticated.", 409);
      if (!(await this.factor(c, u, code)))
        return rejected(
          "Authenticator or recovery code invalid or already used.",
          400,
        );
      await this.audit(c, u.id, "mfa_login");
      return this.elevate(c, u);
    });
  }
  async stepUp(value: string | undefined, input: any) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      if (!u) return rejected();
      if (!(await this.factor(c, u, input.code)))
        return rejected(
          "A fresh authenticator or recovery code is required.",
          403,
        );
      const id = randomUUID();
      await c.query(
        "INSERT INTO step_ups(id,session_id,purpose,operation_digest,expires_at) VALUES($1,$2,$3,$4,now()+interval '5 minutes')",
        [
          id,
          u.session_id,
          input.purpose,
          digest(this.config.DATA_ENCRYPTION_KEY, input.operationDigest),
        ],
      );
      await this.audit(c, u.id, "step_up", { purpose: input.purpose });
      return { stepUpId: id };
    });
  }
  async changePassword(value: string | undefined, input: any) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      if (!u) return rejected();
      if (!(await argon2.verify(u.password_hash, input.currentPassword)))
        return rejected("Current password is incorrect.", 400);
      const grant = await c.query(
        "UPDATE step_ups SET consumed_at=now() WHERE id=$1 AND session_id=$2 AND purpose='password_change' AND operation_digest=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING id",
        [
          input.stepUpId,
          u.session_id,
          digest(this.config.DATA_ENCRYPTION_KEY, hash(input.password)),
        ],
      );
      if (!grant.rowCount)
        return rejected(
          "Fresh authorization for this exact change is required.",
          403,
        );
      const ph = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      await c.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
        u.id,
        ph,
      ]);
      await c.query(
        "UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
        [u.id],
      );
      await this.audit(c, u.id, "password_changed");
      await this.notice(
        c,
        u,
        "Your password changed. Sign in again on all devices.",
      );
      return { message: "Password updated. Sign in again." };
    });
  }
  async sessions(value: string | undefined) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      if (!u) return rejected();
      const rows = await c.query(
        "SELECT id,created_at,expires_at,user_agent FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC",
        [u.id],
      );
      return {
        sessions: rows.rows.map((s) => ({
          ...s,
          current: s.id === u.session_id,
        })),
      };
    });
  }
  async revoke(value: string | undefined, id?: string) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value, true);
      if (!u) return rejected();
      const target = id || u.session_id;
      const r = await c.query(
        "UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id",
        [target, u.id],
      );
      if (!r.rowCount) return rejected("Session not found.", 404);
      await this.audit(c, u.id, "session_revoked");
      return { message: "Session revoked." };
    });
  }
  async admin(value: string | undefined) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      return u?.role === "admin"
        ? { authorized: true, portalAvailable: false }
        : rejected("Administrator access required.", 403);
    });
  }
  async financial(value: string | undefined) {
    return this.db.tx(async (c) => {
      const u = await this.current(c, value);
      if (!u) return rejected();
      if (this.config.DEPLOYMENT_STAGE === "staging")
        return rejected(
          "Wallet and trading access are disabled in the test environment.",
          403,
        );
      if (!this.view(u).financialAccess)
        return rejected(
          "Verified contacts and approved KYC are required.",
          403,
        );
      return { eligible: true, capabilitiesEnabled: false };
    });
  }
}
