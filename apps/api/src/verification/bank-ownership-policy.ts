// This comparison can only hold a provider result for review. It never proves
// ownership or replaces independently authenticated bank evidence.
export const bankNamePolicyVersion = "zetmond-exact-name-v1";

export function bankIdentityCurrent(
  bank: {
    identity_attempt_id: string;
    identity_revision: number | string | null;
  },
  identity: { id: string; revision: number | string } | undefined,
): boolean {
  return (
    !!identity &&
    bank.identity_revision !== null &&
    bank.identity_revision !== undefined &&
    bank.identity_attempt_id === identity.id &&
    Number.isSafeInteger(Number(bank.identity_revision)) &&
    Number(bank.identity_revision) >= 0 &&
    Number(bank.identity_revision) === Number(identity.revision)
  );
}

function comparableName(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    /[\p{Cc}\p{Cf}]/u.test(value)
  )
    return null;
  const name = value
    .normalize("NFC")
    .replace(/\p{White_Space}+/gu, " ")
    .trim();
  if (!name || !/\p{L}/u.test(name)) return null;
  return name.toLowerCase();
}

export function compareBankOwnerNames(
  identityName: unknown,
  ownerName: unknown,
): "match" | "review" {
  const identity = comparableName(identityName),
    owner = comparableName(ownerName);
  return identity !== null && owner !== null && identity === owner
    ? "match"
    : "review";
}

export function bankPoliciesCurrent(
  destination: {
    provider_policy_version: string | null;
    name_match_policy: string | null;
  },
  providerVersion: string | undefined,
): boolean {
  return (
    !!providerVersion &&
    destination.provider_policy_version === providerVersion &&
    destination.name_match_policy === bankNamePolicyVersion
  );
}
