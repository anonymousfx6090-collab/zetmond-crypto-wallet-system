export const countries = ["NG", "GH", "KE"] as const;
export type Country = (typeof countries)[number];

export const currency: Record<Country, string> = {
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
};
const names: Record<Country, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
};
export const markets = countries.map((code) => ({
  code,
  name: names[code],
  currency: currency[code],
}));

export function isSupportedCountry(value: unknown): value is Country {
  return countries.some((country) => country === value);
}
