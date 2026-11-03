import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(12).max(128);
export const registerSchema = z
  .object({
    email,
    password,
    phone: z
      .string()
      .max(24)
      .transform((v) => parsePhoneNumberFromString(v)?.number || v),
    country: z.enum(["NG", "GH", "ZA", "KE"]),
    acceptTerms: z.literal(true),
    policyVersion: z.string().max(80),
  })
  .strict()
  .superRefine((v, ctx) => {
    const phone = parsePhoneNumberFromString(v.phone);
    if (!phone?.isValid() || phone.country !== v.country)
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message:
          "Use a valid international phone number for your registration country.",
      });
  });
export const loginSchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
export const verifySchema = z
  .object({
    purpose: z.enum(["email", "phone"]),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export const mfaSchema = z.object({ code: z.string().min(6).max(80) }).strict();
export const resetSchema = z
  .object({ token: z.string().min(20).max(200), password })
  .strict();
export const changeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    password,
    stepUpId: z.string().uuid(),
  })
  .strict();
export const stepSchema = z
  .object({
    purpose: z.enum(["password_change", "contact_change", "withdrawal"]),
    operationDigest: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().min(6).max(80),
  })
  .strict();
