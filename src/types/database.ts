import type { AccountType } from "@/lib/profile";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

/** Supply lifecycle. Distinct from match and requirement state — never merge them. */
export type ItemStatus =
  | "listed"
  | "analyzing"
  | "confirmed"
  | "matched"
  | "allocated"
  | "handoff_scheduled"
  | "handed_over"
  | "second_life_confirmed"
  | "withdrawn";

/** Demand lifecycle. */
export type RequirementStatus =
  | "open"
  | "partially_fulfilled"
  | "fulfilled"
  | "expired"
  | "closed";

/** A recommendation's lifecycle — a match is never an outcome. */
export type MatchStatus =
  | "suggested"
  | "accepted"
  | "declined"
  | "allocated"
  | "cancelled"
  | "completed";

/** A committed contribution's lifecycle. */
export type AllocationStatus =
  | "allocated"
  | "handoff_scheduled"
  | "handed_over"
  | "confirmed"
  | "cancelled";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

/** How precise a stored coordinate is. Donor points are never 'exact' by default. */
export type LocationPrecision = "exact" | "area" | "city";

export interface GeoFields {
  latitude: number | null;
  longitude: number | null;
}

export interface ProfileRow extends GeoFields {
  user_id: string;
  account_type: AccountType | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_precision: LocationPrecision;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow extends GeoFields {
  id: string;
  owner_id: string | null;
  name: string;
  org_type: string;
  description: string | null;
  location: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  verification_status: VerificationStatus;
  /** Seeded demo directory row — must be labelled as such in the UI. */
  is_directory: boolean;
  service_radius_km: number;
  created_at: string;
  updated_at: string;
}

export interface ItemRow extends GeoFields {
  id: string;
  owner_id: string;
  category: string;
  subcategory: string;
  item_type: string;
  condition: string;
  reusability: string;
  reusability_score: number;
  potential_use: string | null;
  destination_path: string | null;
  image_path: string | null;
  location: string | null;
  status: ItemStatus;
  confidence: number | null;
  notes: string | null;
  quantity: number;
  /** Generated: quantity - quantity_allocated. */
  quantity_available: number;
  quantity_allocated: number;
  quantity_handed_over: number;
  ai_source: string | null;
  user_corrected: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequirementRow extends GeoFields {
  id: string;
  organization_id: string;
  category: string;
  subcategory: string;
  item_type: string;
  quantity_requested: number;
  quantity_received: number;
  /** Generated columns — read-only, never write these. */
  quantity_remaining: number;
  fulfillment_percentage: number | null;
  required_condition: string;
  location: string | null;
  urgency: UrgencyLevel;
  status: RequirementStatus;
  notes: string | null;
  needed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchRow {
  id: string;
  item_id: string;
  requirement_id: string;
  match_score: number;
  matching_factors: string[];
  status: MatchStatus;
  quantity_offered: number;
  quantity_allocated: number;
  confidence: number | null;
  distance_km: number | null;
  /** True when the item type came from an unconfirmed detection. */
  needs_type_confirmation: boolean;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchAllocationRow {
  id: string;
  match_id: string | null;
  item_id: string;
  requirement_id: string;
  donor_id: string;
  organization_id: string;
  quantity_allocated: number;
  status: AllocationStatus;
  handoff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImpactRecordRow {
  id: string;
  user_id: string;
  item_id: string | null;
  organization_id: string | null;
  allocation_id: string | null;
  outcome: string;
  destination: string | null;
  destination_tier: string | null;
  quantity: number;
  points: number;
  metrics: Record<string, unknown>;
  created_at: string;
}

export type RequirementWithOrg = RequirementRow & { organization: OrganizationRow | null };

export type MatchWithContext = MatchRow & {
  item: ItemRow | null;
  requirement: RequirementWithOrg | null;
};

export type AllocationWithContext = MatchAllocationRow & {
  item: ItemRow | null;
  requirement: RequirementWithOrg | null;
};
