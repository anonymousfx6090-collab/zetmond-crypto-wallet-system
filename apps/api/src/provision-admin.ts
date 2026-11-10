import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { z } from "zod";
import { Database } from "./db";
import { email, password } from "./auth/validation";
import { countries } from "./markets";
export async function provisionAdmin(url: string, input: unknown) {
  const v = z
    .object({ email, password, country: z.enum(countries) })
    .strict()
    .parse(input);
  const db = new Database(url);
  try {
    return await db.tx(async (c) => {
      const ph = await argon2.hash(v.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const r = await c.query(
        "INSERT INTO users(id,email,password_hash,country,role) VALUES($1,$2,$3,$4,'admin') RETURNING id",
        [randomUUID(), v.email, ph, v.country],
      );
      await c.query(
        "INSERT INTO audit_events(user_id,action,metadata) VALUES($1,'admin_provisioned',$2)",
        [r.rows[0].id, JSON.stringify({ method: "owner_cli" })],
      );
      return r.rows[0].id;
    });
  } finally {
    await db.close();
  }
}
if (require.main === module) {
  const input = {
    email: process.env.PROVISION_ADMIN_EMAIL,
    password: process.env.PROVISION_ADMIN_PASSWORD,
    country: process.env.PROVISION_ADMIN_COUNTRY,
  };
  delete process.env.PROVISION_ADMIN_PASSWORD;
  provisionAdmin(process.env.DATABASE_URL || "", input)
    .then(() =>
      console.log(
        "Named admin created. MFA enrollment is required at first login.",
      ),
    )
    .catch(() => {
      console.error(
        "Provisioning failed. Check validated inputs, uniqueness and database access.",
      );
      process.exitCode = 1;
    });
}
