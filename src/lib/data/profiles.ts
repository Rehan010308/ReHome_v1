import { requireSupabase } from "@/lib/supabase";
import { isAccountType, type AccountType, type ReHomeProfile } from "@/lib/profile";
import type { OrganizationRow, ProfileRow } from "@/types/database";

export function profileRowToApp(row: ProfileRow, fallbackEmail = ""): ReHomeProfile {
  return {
    userId: row.user_id,
    email: row.email ?? fallbackEmail,
    name: row.display_name,
    accountType: isAccountType(row.account_type) ? row.account_type : null,
    phone: row.phone,
    location: row.location,
    bio: row.bio,
    city: row.city,
    region: row.region,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function ensureProfile(input: {
  userId: string;
  email: string;
  name: string;
  accountType: AccountType | null;
}): Promise<ProfileRow> {
  const existing = await fetchProfile(input.userId);
  if (existing) return existing;

  const { data, error } = await requireSupabase()
    .from("profiles")
    .insert({
      user_id: input.userId,
      email: input.email,
      display_name: input.name,
      account_type: input.accountType,
    })
    .select("*")
    .single();
  if (error) {
    const raced = await fetchProfile(input.userId);
    if (raced) return raced;
    throw error;
  }
  return data as ProfileRow;
}

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<
      ProfileRow,
      | "display_name" | "phone" | "location" | "bio" | "account_type" | "email"
      | "city" | "region" | "country" | "latitude" | "longitude" | "location_precision"
    >
  >
): Promise<ProfileRow> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  const { data, error } = await requireSupabase()
    .from("profiles")
    .update(clean)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function fetchOwnOrganization(userId: string): Promise<OrganizationRow | null> {
  const { data, error } = await requireSupabase()
    .from("organizations")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as OrganizationRow | null;
}

export async function ensureOrganization(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<OrganizationRow> {
  const existing = await fetchOwnOrganization(input.userId);
  if (existing) return existing;
  const { data, error } = await requireSupabase()
    .from("organizations")
    .insert({
      owner_id: input.userId,
      name: input.name,
      contact_email: input.email,
      org_type: "community",
      is_directory: false,
      verification_status: "unverified",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as OrganizationRow;
}

export async function updateOrganization(
  id: string,
  patch: Partial<
    Pick<
      OrganizationRow,
      "name" | "org_type" | "description" | "location" | "contact_email" | "contact_phone" | "website"
    >
  >
): Promise<OrganizationRow> {
  const { data, error } = await requireSupabase()
    .from("organizations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as OrganizationRow;
}

export async function listVisibleOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await requireSupabase()
    .from("organizations")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as OrganizationRow[];
}

export async function fetchOrganizationById(id: string): Promise<OrganizationRow | null> {
  const { data, error } = await requireSupabase()
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as OrganizationRow | null) ?? null;
}
