import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/live/api";
import { toTrip } from "@/live/adapt";
import type { Activity, Trip } from "@/data/types";

/* Polls the live trip (contract state through the API) every few seconds, plus names and on-chain activity.
   `refresh()` re-reads at once, used right after an action so the UI follows the chain without waiting. */
const POLL_MS = 3500;

function toActivity(rows: api.ActivityRow[]): Activity[] {
  return rows.map((r, i) => ({
    id: r.tx ?? `${r.at}-${i}`,
    at: relative(r.at),
    kind: (["paid", "listed", "resold", "refused", "proof", "draw", "draw-out", "created"].includes(r.kind) ? r.kind : "created") as Activity["kind"],
    text: r.text,
    chain: r.chain as Activity["chain"],
    tx: r.tx,
  }));
}

function relative(at: string): string {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return at;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

export function useLiveTrip(code: string, enabled: boolean) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string>("");
  const [proofPending, setProofPending] = useState(false);
  const names = useRef<Record<string, string>>({});
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    try {
      const view = await api.getTrip(code);
      const t = view.trip;
      const accounts = [t.booker, ...t.beds.map((b) => b.holder).filter(Boolean), ...t.waitlist.map((w) => w.buyer)] as string[];
      const missing = accounts.filter((a) => !(a in names.current));
      if (missing.length) names.current = { ...names.current, ...(await api.names(missing).catch(() => ({}))) };
      const rows = await api.activity(code);
      setTrip(toTrip(view, names.current, toActivity(rows)));
      setLastError(t.last_error ?? "");
      setProofPending(!!(t as unknown as { proof_pending?: boolean }).proof_pending);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the trip");
    } finally {
      busy.current = false;
    }
  }, [code, enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { trip, error, lastError, proofPending, refresh };
}
