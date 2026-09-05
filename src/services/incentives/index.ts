import type { ImpactRecordRow } from "@/types/database";

/**
 * Incentives derived from confirmed outcomes.
 *
 * Every number here is computed from impact_records, which only
 * confirm_second_life() can write. There are no counters to drift out of sync
 * and nothing that can be inflated by activity that did not actually happen —
 * accepting a match earns nothing until the recipient confirms.
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  /** 0–1 toward earning it; 1 once earned. */
  progress: number;
}

export interface IncentiveProfile {
  points: number;
  /** Consecutive ISO weeks, ending this week or last, with a confirmed handoff. */
  streakWeeks: number;
  badges: Badge[];
  level: { name: string; index: number; nextAt: number | null };
}

const LEVELS = [
  { name: "First steps", at: 0 },
  { name: "Contributor", at: 50 },
  { name: "Regular", at: 200 },
  { name: "Steward", at: 500 },
  { name: "Circular", at: 1500 },
];

/** ISO-week key, so a streak means calendar weeks and not rolling 7-day windows. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day);
  return target.toISOString().slice(0, 10);
}

export function computeStreak(records: ImpactRecordRow[], now = new Date()): number {
  if (records.length === 0) return 0;
  const weeks = new Set(records.map((r) => weekKey(r.created_at)));
  const thisWeek = weekKey(now.toISOString());

  // A streak stays alive during the current week even before this week's first
  // contribution, so someone is never told their streak broke on a Monday.
  let cursor = weeks.has(thisWeek) ? thisWeek : null;
  if (!cursor) {
    const last = new Date(Date.parse(thisWeek) - 7 * 86_400_000).toISOString().slice(0, 10);
    if (!weeks.has(last)) return 0;
    cursor = last;
  }

  let streak = 0;
  for (;;) {
    if (!weeks.has(cursor)) break;
    streak += 1;
    cursor = new Date(Date.parse(cursor) - 7 * 86_400_000).toISOString().slice(0, 10);
  }
  return streak;
}

function badge(
  id: string,
  name: string,
  description: string,
  value: number,
  threshold: number
): Badge {
  return {
    id,
    name,
    description,
    earned: value >= threshold,
    progress: Math.min(1, threshold === 0 ? 1 : value / threshold),
  };
}

export function computeIncentives(records: ImpactRecordRow[], now = new Date()): IncentiveProfile {
  const units = records.reduce((s, r) => s + r.quantity, 0);
  const points = records.reduce((s, r) => s + r.points, 0);
  const orgs = new Set(records.map((r) => r.organization_id).filter(Boolean)).size;
  const categories = new Set(records.map((r) => String(r.metrics?.category ?? "Other"))).size;
  const reused = records.filter((r) => (r.destination_tier ?? "").toLowerCase().includes("reuse"))
    .reduce((s, r) => s + r.quantity, 0);
  const streakWeeks = computeStreak(records, now);

  const levelIndex = LEVELS.reduce((acc, l, i) => (points >= l.at ? i : acc), 0);
  const next = LEVELS[levelIndex + 1] ?? null;

  return {
    points,
    streakWeeks,
    level: { name: LEVELS[levelIndex].name, index: levelIndex, nextAt: next?.at ?? null },
    badges: [
      badge("first", "First second life", "One item confirmed in its next home", units, 1),
      badge("ten", "Ten rehomed", "Ten items confirmed", units, 10),
      badge("fifty", "Fifty rehomed", "Fifty items confirmed", units, 50),
      badge("network", "Network builder", "Supported five organizations", orgs, 5),
      badge("range", "Broad range", "Contributed across four categories", categories, 4),
      badge("reuse", "Reuse first", "Twenty items kept in direct reuse", reused, 20),
      badge("streak", "Four-week streak", "Contributed four weeks running", streakWeeks, 4),
    ],
  };
}

/**
 * Leaderboards need cross-user aggregates, which RLS correctly prevents the
 * browser from reading — one user cannot see another's impact records. Doing
 * this properly means a server-side aggregate (a security-definer view or a
 * scheduled rollup table) that exposes ranks without exposing rows.
 *
 * Until that exists this returns null, and the UI says so rather than
 * inventing standings.
 */
export async function fetchLeaderboard(): Promise<null> {
  return null;
}
