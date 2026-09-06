export const ACCOUNT_TYPES = ["individual", "organization"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface ReHomeProfile {
  userId: string;
  email: string;
  name: string;
  accountType: AccountType | null;
  phone?: string | null;
  /** Human-readable place name, e.g. "Vellore, Tamil Nadu". */
  location?: string | null;
  bio?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  /** Already blurred to the stored precision — never an exact address. */
  latitude?: number | null;
  longitude?: number | null;
}

export function isAccountType(value: unknown): value is AccountType {
  return value === "individual" || value === "organization";
}

/**
 * Phase 2 profile is derived from Auth user + user_metadata.
 * Phase 3 will persist this into a profiles table. Do not use user_metadata
 * for RLS or other authorization decisions.
 */
export function profileFromUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): ReHomeProfile {
  const meta = user.user_metadata ?? {};
  const rawType = meta.account_type;
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (user.email ? user.email.split("@")[0] : "Member");

  return {
    userId: user.id,
    email: user.email ?? "",
    name,
    accountType: isAccountType(rawType) ? rawType : null,
  };
}

export function commandPath(accountType: AccountType): string {
  return accountType === "organization" ? "/app/organization" : "/app/individual";
}
