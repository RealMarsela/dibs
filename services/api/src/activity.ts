import { Hono } from "hono";
import { parse } from "./errors";
import type { Env } from "./env";
import { view } from "./near";
import { tripCode } from "./schemas";

export const activityRoute = new Hono<{ Bindings: Env }>();

export interface Activity {
  at: string;
  kind: string;
  text: string;
  tx: string | null;
  chain?: string;
}

const MAX = 20;
const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; body: Activity[] }>();
export const clearActivityCache = (): void => cache.clear();

const key = (trip: string) => `act/${trip}`;

/** Append an API-side event (hold, deposit, sweep, proof, draw, refund check). Best effort: never fails the caller. */
export async function recordActivity(env: Env, trip: string, a: Omit<Activity, "at"> & { at?: string }): Promise<void> {
  try {
    const cur = ((await env.NAMES.get(key(trip), "json")) as Activity[] | null) ?? [];
    cur.unshift({ at: a.at ?? new Date().toISOString(), kind: a.kind, text: a.text, tx: a.tx, ...(a.chain ? { chain: a.chain } : {}) });
    await env.NAMES.put(key(trip), JSON.stringify(cur.slice(0, 40)));
    cache.delete(`${env.DIBS_CONTRACT}:${trip}`);
  } catch {
    /* activity is decoration */
  }
}

interface TripState {
  proof?: { stay?: string } | null;
  payout?: string;
  last_error?: string | null;
  refunded?: boolean;
  drawn_out?: boolean;
}

/** State the contract itself reports (proof accepted, payout, refusals) that has no tx in our log. */
function fromState(t: TripState): Activity[] {
  const out: Activity[] = [];
  const at = new Date().toISOString();
  if (t.last_error) out.push({ at, kind: "refused", text: `On-chain refusal ${t.last_error}`, tx: null });
  if (t.proof) out.push({ at, kind: "proof", text: `Booking proof accepted${t.proof.stay ? ` for ${t.proof.stay}` : ""}`, tx: null });
  if (t.payout === "Done") out.push({ at, kind: "payout", text: "Payout sent to the booker", tx: null });
  return out;
}

activityRoute.get("/trip/:code/activity", async (c) => {
  const env = c.env;
  const code = parse(tripCode, c.req.param("code"));
  const ck = `${env.DIBS_CONTRACT}:${code}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return c.json(hit.body);
  let body: Activity[] = [];
  try {
    const logged = ((await env.NAMES.get(key(code), "json")) as Activity[] | null) ?? [];
    const trip = await view<TripState>(env, env.DIBS_CONTRACT, "get_trip", { trip: code });
    const state = trip ? fromState(trip).filter((s) => !logged.some((l) => l.kind === s.kind)) : [];
    body = [...logged, ...state].sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1)).slice(0, MAX);
  } catch {
    body = [];
  }
  cache.set(ck, { at: Date.now(), body });
  c.header("cache-control", "public, max-age=15");
  return c.json(body);
});
