import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "node:crypto";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const digest = (key: string, value: string) =>
  createHmac("sha256", Buffer.from(key, "hex")).update(value).digest("hex");
export function seal(key: string, value: unknown) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  return Buffer.concat([
    iv,
    c.update(JSON.stringify(value)),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64");
}
export function unseal<T = any>(key: string, value: string): T {
  const b = Buffer.from(value, "base64"),
    d = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      b.subarray(0, 12),
    );
  d.setAuthTag(b.subarray(-16));
  return JSON.parse(
    Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString(),
  );
}
