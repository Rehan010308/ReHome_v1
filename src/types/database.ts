import type { AccountType } from "@/lib/profile";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type ItemStatus =
  | "listed"
  | "matched"
  | "accepted"
  | "scheduled"
  | "handed_over"
  | "confirmed"
  | "withdrawn";
export type RequirementStatus = "open" | "partially_filled" | "filled" | "closed";
export type MatchStatus = "suggested" | "accepted" | "declined" | "expired" | "completed";
export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export interface ProfileRow {
  user_id: string;
  account_type: AccountType | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  owner_id: string | null;
  name: string;
  org_type: string;
  description: string | null;
  location: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website?: string | null;
  verification_status: VerificationStatus;
  is_directory: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemRow {
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
  quantity?: number;
  ai_source?: string | null;
  user_corrected?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequirementRow {
  id: string;
  organization_id: string;
  category: string;
  subcategory: string;
  item_type: string;
  quantity: number;
  required_condition: string;
  location: string | null;
  urgency: UrgencyLevel;
  status: RequirementStatus;
  notes: string | null;
  filled_quantity?: number;
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
  scored_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchWithContext = MatchRow & {
  item: ItemRow | null;
  requirement: (RequirementRow & { organization: OrganizationRow | null }) | null;
};
