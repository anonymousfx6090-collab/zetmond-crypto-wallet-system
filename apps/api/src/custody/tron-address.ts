import { createHash } from "node:crypto";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function validTronAddress(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length !== 34 ||
    !value.startsWith("T")
  )
    return false;
  let number = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return false;
    number = number * 58n + BigInt(digit);
  }
  const hex = number.toString(16).padStart(50, "0");
  if (hex.length !== 50) return false;
  const bytes = Buffer.from(hex, "hex");
  const checksum = createHash("sha256")
    .update(createHash("sha256").update(bytes.subarray(0, 21)).digest())
    .digest()
    .subarray(0, 4);
  return bytes[0] === 0x41 && checksum.equals(bytes.subarray(21));
}
