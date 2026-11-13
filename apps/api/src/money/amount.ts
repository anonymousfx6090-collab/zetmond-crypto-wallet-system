export const maximumAtomicUnits = 10n ** 78n - 1n;
export class MoneyError extends Error {
  constructor() {
    super("Invalid exact monetary amount.");
  }
}
export function atomic(value: unknown, positive = false): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,77})$/.test(value))
    throw new MoneyError();
  const amount = BigInt(value);
  if (amount > maximumAtomicUnits || (positive && amount === 0n))
    throw new MoneyError();
  return amount;
}
function precision(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 18)
    throw new MoneyError();
}
export function parseAmount(value: unknown, decimals: number): bigint {
  precision(decimals);
  if (
    typeof value !== "string" ||
    value.length > 100 ||
    !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)
  )
    throw new MoneyError();
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new MoneyError();
  return atomic(
    (whole + fraction.padEnd(decimals, "0")).replace(/^0+(?=\d)/, ""),
  );
}
export function formatAmount(value: bigint, decimals: number): string {
  precision(decimals);
  atomic(value.toString());
  const text = value.toString().padStart(decimals + 1, "0");
  return decimals
    ? `${text.slice(0, -decimals)}.${text.slice(-decimals)}`
    : text;
}
/** Positive exact rationals only; reversal journals reuse original units. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new MoneyError();
  return atomic(((numerator + denominator / 2n) / denominator).toString());
}
export function calculatePrincipal(
  quantityUsdt: string,
  ngnRate: string,
): string {
  return roundHalfUp(
    parseAmount(quantityUsdt, 6) * parseAmount(ngnRate, 8),
    10n ** 12n,
  ).toString();
}
