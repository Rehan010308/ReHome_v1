import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { IntelligenceStage, IntelligenceTelemetry } from "@/services/intelligence/stages";

/**
 * A rehoming session.
 *
 * Someone clearing a room does not scan one object and stop, so the scan flow
 * keeps a running list rather than resetting to zero each time. The session
 * lives in memory for the length of the visit: it is a view of work in
 * progress, never a second copy of the record — anything durable is already in
 * the database, and the session only remembers what is still in flight.
 */

export interface SessionEntry {
  /** Client-side id for this pass through the flow. */
  id: string;
  label: string;
  stage: IntelligenceStage;
  telemetry: IntelligenceTelemetry;
  /** Set once the item has been written to the catalogue. */
  itemId: string | null;
  quantity: number;
  startedAt: number;
}

interface SessionValue {
  entries: SessionEntry[];
  /** The entry currently moving through analysis, if any. */
  active: SessionEntry | null;
  begin: () => string;
  update: (id: string, patch: Partial<Omit<SessionEntry, "id">>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export const RehomingSessionProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<SessionEntry[]>([]);

  const begin = useCallback(() => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setEntries((prev) => [
      ...prev,
      {
        id,
        label: "New item",
        stage: "image_received",
        telemetry: {},
        itemId: null,
        quantity: 1,
        startedAt: Date.now(),
      },
    ]);
    return id;
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<SessionEntry, "id">>) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              telemetry: patch.telemetry
                ? { ...entry.telemetry, ...patch.telemetry }
                : entry.telemetry,
            }
          : entry
      )
    );
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo<SessionValue>(() => {
    // The last entry that has not settled is the one the surface reflects.
    const active =
      [...entries].reverse().find((e) => e.stage !== "destination_found" && e.stage !== "failed") ??
      null;
    return { entries, active, begin, update, remove, clear };
  }, [entries, begin, update, remove, clear]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useRehomingSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useRehomingSession must be used within RehomingSessionProvider");
  return ctx;
}
