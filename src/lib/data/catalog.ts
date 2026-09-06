import { requireSupabase } from "@/lib/supabase";
import type { ItemRow, RequirementRow, UrgencyLevel } from "@/types/database";

export async function listOwnItems(userId: string): Promise<ItemRow[]> {
  const { data, error } = await requireSupabase()
    .from("items")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ItemRow[];
}

export interface CreateItemInput {
  owner_id: string;
  category: string;
  subcategory: string;
  item_type: string;
  condition: string;
  reusability: string;
  reusability_score: number;
  potential_use?: string;
  destination_path?: string;
  image_path?: string | null;
  location?: string;
  /** Stored blurred, never at exact precision — see services/geo. */
  latitude?: number | null;
  longitude?: number | null;
  confidence?: number;
  notes?: string;
  quantity?: number;
  ai_source?: string;
  user_corrected?: boolean;
}

export async function createItem(input: CreateItemInput): Promise<ItemRow> {
  const { data, error } = await requireSupabase()
    .from("items")
    .insert({ ...input, status: "listed" as const })
    .select("*")
    .single();
  if (error) throw error;
  return data as ItemRow;
}

export async function updateItemStatus(id: string, status: ItemRow["status"]): Promise<void> {
  const { error } = await requireSupabase().from("items").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function uploadItemImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await requireSupabase().storage.from("item-images").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export function itemImageUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = requireSupabase().storage.from("item-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function signedItemImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await requireSupabase().storage.from("item-images").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/** Demand that can still receive contributions — partially fulfilled included. */
export async function listOpenRequirements(): Promise<RequirementRow[]> {
  const { data, error } = await requireSupabase()
    .from("requirements")
    .select("*")
    .in("status", ["open", "partially_fulfilled"])
    .gt("quantity_remaining", 0)
    .order("urgency", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RequirementRow[];
}

export async function listOrgRequirements(organizationId: string): Promise<RequirementRow[]> {
  const { data, error } = await requireSupabase()
    .from("requirements")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RequirementRow[];
}

export async function createRequirement(input: {
  organization_id: string;
  category: string;
  subcategory: string;
  item_type: string;
  quantity_requested: number;
  required_condition: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  urgency: UrgencyLevel;
  needed_by?: string | null;
  notes?: string;
}): Promise<RequirementRow> {
  // quantity_received starts at 0 and only ever moves through the allocation
  // RPC; quantity_remaining and fulfillment_percentage are generated columns
  // and must never be written from the client.
  const { data, error } = await requireSupabase()
    .from("requirements")
    .insert({ ...input, status: "open", quantity_received: 0 })
    .select("*")
    .single();
  if (error) throw error;
  return data as RequirementRow;
}

export async function closeRequirement(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("requirements")
    .update({ status: "closed" })
    .eq("id", id);
  if (error) throw error;
}

/**
 * A single item, for the lifecycle view behind an item QR. Returns null when
 * the reader is not entitled to it — RLS, not this function, is the gate.
 */
export async function fetchItemById(id: string): Promise<ItemRow | null> {
  const { data, error } = await requireSupabase()
    .from("items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ItemRow | null) ?? null;
}
