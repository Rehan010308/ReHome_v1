import type { ImpactRecordRow } from "@/types/database";

/**
 * Recognition, derived from confirmed outcomes.
 *
 * Every number here is computed from impact_records, which only
 * confirm_second_life() can write. There are no counters to drift out of sync
 * and nothing that can be inflated by activity that did not actually happen —
 * accepting a match earns nothing until the recipient confirms.
 *
 * The deliberate shape of this system: ReHome recognises people, it does not
 * pay them. Points describe what an item did next, levels describe a habit, and
 * rewards are framed as partner offers that only appear once partners exist.
 * Anything that would read as "we will pay you to donate" is out of scope.
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  /** 0–1 toward earning it; 1 once earned. */
  progress: number;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  /** Real progress toward the goal, from confirmed records. */
  current: number;
  target: number;
  window: "month" | "all-time";
}

export interface LevelInfo {
  name: string;
  index: number;
  /** Points at which the next level starts, or null at the top. */
  nextAt: number | null;
  nextName: string | null;
  /** 0–1 through the current band. */
  progress: number;
}

export interface IncentiveProfile {
  points: number;
  /** Consecutive ISO weeks, ending this week or last, with a confirmed handoff. */
  streakWeeks: number;
  badges: Badge[];
  level: LevelInfo;
  challenges: Challenge[];
  /** Units confirmed in the current calendar month. */
  unitsThisMonth: number;
  certificateEarned: boolean;
}

/**
 * How points are awarded. These describe what confirm_second_life() writes, so
 * the interface can explain the scheme without recomputing it — the database
 * remains the only thing that can award a point.
 */
export const POINT_RULES = [
  { points: 10, label: "Successful rehoming", detail: "Per unit confirmed received." },
  { points: 15, label: "Urgent requirement", detail: "Per unit against a high or critical need." },
  {
    points: 25,
    label: "Electronics diverted",
    detail: "Per unit routed to refurbishment or certified recycling instead of waste.",
  },
  { points: 20, label: "Verified handoff bonus", detail: "Once per confirmed handoff." },
] as const;

const LEVELS = [
  { name: "Newcomer", at: 0 },
  { name: "ReHomer", at: 60 },
  { name: "Resource Hero", at: 250 },
  { name: "Circular Champion", at: 750 },
  { name: "ReHome Legend", at: 2000 },
];

/** A certificate is a claim about someone, so it needs a real threshold. */
const CERTIFICATE_AT_UNITS = 10;

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

function levelFor(points: number): LevelInfo {
  const index = LEVELS.reduce((acc, l, i) => (points >= l.at ? i : acc), 0);
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  const span = next ? next.at - current.at : 0;
  return {
    name: current.name,
    index,
    nextAt: next?.at ?? null,
    nextName: next?.name ?? null,
    progress: next && span > 0 ? Math.min(1, (points - current.at) / span) : 1,
  };
}

function inThisMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function computeIncentives(records: ImpactRecordRow[], now = new Date()): IncentiveProfile {
  const units = records.reduce((s, r) => s + r.quantity, 0);
  const points = records.reduce((s, r) => s + r.points, 0);
  const orgs = new Set(records.map((r) => r.organization_id).filter(Boolean)).size;
  const categories = new Set(records.map((r) => String(r.metrics?.category ?? "Other"))).size;
  const reused = records
    .filter((r) => (r.destination_tier ?? "").toLowerCase().includes("reuse"))
    .reduce((s, r) => s + r.quantity, 0);
  const recovered = records
    .filter((r) => /recycl|refurbish/i.test(r.destination_tier ?? ""))
    .reduce((s, r) => s + r.quantity, 0);
  const streakWeeks = computeStreak(records, now);

  const monthRecords = records.filter((r) => inThisMonth(r.created_at, now));
  const unitsThisMonth = monthRecords.reduce((s, r) => s + r.quantity, 0);
  const orgsThisMonth = new Set(monthRecords.map((r) => r.organization_id).filter(Boolean)).size;
  const booksThisMonth = monthRecords
    .filter((r) => /book|textbook/i.test(String(r.metrics?.item_type ?? "")))
    .reduce((s, r) => s + r.quantity, 0);

  return {
    points,
    streakWeeks,
    unitsThisMonth,
    certificateEarned: units >= CERTIFICATE_AT_UNITS,
    level: levelFor(points),
    challenges: [
      {
        id: "five-this-month",
        name: "Rehome five items this month",
        description: "Counted when each handoff is confirmed received.",
        current: unitsThisMonth,
        target: 5,
        window: "month",
      },
      {
        id: "three-books",
        name: "Give three books a second life",
        description: "Books and textbooks confirmed this month.",
        current: booksThisMonth,
        target: 3,
        window: "month",
      },
      {
        id: "two-orgs",
        name: "Help two organizations this month",
        description: "Distinct organizations that confirmed receipt from you.",
        current: orgsThisMonth,
        target: 2,
        window: "month",
      },
    ],
    badges: [
      badge("first", "First second life", "One item confirmed in its next home", units, 1),
      badge("ten", "Ten rehomed", "Ten items confirmed", units, 10),
      badge("fifty", "Fifty rehomed", "Fifty items confirmed", units, 50),
      badge("network", "Network builder", "Supported five organizations", orgs, 5),
      badge("range", "Broad range", "Contributed across four categories", categories, 4),
      badge("reuse", "Reuse first", "Twenty items kept in direct reuse", reused, 20),
      badge("recovery", "Diverted from waste", "Ten items routed to repair or recycling", recovered, 10),
      badge("streak", "Four-week streak", "Contributed four weeks running", streakWeeks, 4),
    ],
  };
}

/**
 * Reward *categories*, not brands.
 *
 * Naming a company ReHome has no agreement with would be inventing a
 * partnership, so these describe the kinds of offer a partner programme would
 * carry and are shown as not-yet-live until real partners exist.
 */
export const REWARD_CONCEPTS = [
  { id: "campus-food", name: "Campus café credit", note: "Food and coffee partners" },
  { id: "bookstore", name: "Bookstore discount", note: "Independent and campus bookstores" },
  { id: "transit", name: "Transit credit", note: "Public transport and ride partners" },
  { id: "eco", name: "Eco-product discount", note: "Refill, repair and low-waste brands" },
  { id: "events", name: "Event access", note: "Community and campus events" },
] as const;

/**
 * Campus programmes.
 *
 * A challenge with a leaderboard needs cross-user aggregates, which RLS
 * correctly prevents the browser from reading. These are therefore described as
 * programmes that can be opened, with no standings shown — inventing a rank
 * would be worse than admitting the aggregate does not exist yet.
 */
export const CAMPUS_PROGRAMMES = [
  {
    id: "vit-circularity",
    name: "VIT Circularity Challenge",
    description: "Hostel and campus-wide rehoming drive at the end of each semester.",
  },
  {
    id: "campus-league",
    name: "Campus ReHome League",
    description: "Departments and hostels compared on items rehomed and organizations supported.",
  },
  {
    id: "back-to-school",
    name: "Back-to-School Rehome Drive",
    description: "Textbooks, bags and stationery routed to schools before term starts.",
  },
] as const;

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
