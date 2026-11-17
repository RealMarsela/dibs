import { Hono } from "hono";
import { z } from "zod";
import { type AcctEntry, listAccount, type RoleRef } from "./acctindex";
import { clientIp } from "./calls";
import { readMeta } from "./create";
import type { Env } from "./env";
import { ApiError, parse } from "./errors";
import { mainnetEnv, type MainnetVars } from "./mainnet";
import { getTrip } from "./near";
import { rateLimit } from "./ratelimit";
import { accountId } from "./schemas";

export const myTripsRoute = new Hono<{ Bindings: Env }>();

const MAX_TRIPS = 30;
const accounts = z.array(accountId).min(1).max(3);

export type TripStatus = "refunded" | "booked" | "all_paid" | "filling";

export interface MyTrip {
  code: string;
  network: "testnet" | "mainnet";
  place: string;
  stay: string;
  check_in: string;
  check_out: string;
  n_beds: number;
  paid: number;
  price_usdc: number;
  status: TripStatus;
  roles: RoleRef[];
  created_at: string;
  book_by: string;
}

interface ChainTrip {
  price: string;
  n_beds: number;
  book_by: string;
  check_in: string;
  check_out: string;
  stay?: string;
  payout?: unknown;
  refunded?: boolean;
  booker?: string;
  beds: { status: string; holder?: string | null }[];
  waitlist?: { buyer: string; slot: number }[];
  wait_res?: (string | null)[];
}

/** Roles read from the chain now (the index is history: a sold bed or a filled waitlist spot moves on). */
export function currentRoles(t: ChainTrip, accounts: string[]): RoleRef[] {
  const mine = (a?: string | null) => !!a && accounts.includes(a);
  const out: RoleRef[] = [];
  if (mine(t.booker)) out.push({ role: "booker" });
  t.beds.forEach((b, i) => mine(b.holder) && out.push({ role: "bed", n: i + 1 }));
  for (const w of t.waitlist ?? []) if (mine(w.buyer)) out.push({ role: "waitlist", n: w.slot });
  (t.wait_res ?? []).forEach((r, i) => mine(r) && !out.some((o) => o.role === "waitlist" && o.n === i + 1) && out.push({ role: "waitlist", n: i + 1 }));
  return out.length ? out : [{ role: "left" }];
}

export function tripStatus(t: Pick<ChainTrip, "refunded" | "payout" | "beds">): TripStatus {
  if (t.refunded) return "refunded";
  if (t.payout === "Done") return "booked";
  if (t.beds.length > 0 && t.beds.every((b) => b.status === "Paid")) return "all_paid";
  return "filling";
}

/** The env a trip's network lives on: this one, or (from the testnet worker) the mainnet twin. Null when unreachable. */
function envFor(env: Env, network: AcctEntry["network"]): Env | null {
  if (network === (env.NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet")) return env;
  return network === "mainnet" && env.NEAR_NETWORK !== "mainnet" ? mainnetEnv(env as Env & MainnetVars) : null;
}

const rolesOf = (e: AcctEntry): RoleRef[] => e.roles ?? [{ role: e.role, ...(e.n ? { n: e.n } : {}) }];

async function build(env: Env, code: string, entry: { network: AcctEntry["network"]; at: string; roles: RoleRef[] }, accounts: string[]): Promise<MyTrip | null> {
  const e = envFor(env, entry.network);
  if (!e) return null;
  const [t, meta] = await Promise.all([getTrip(e, code) as Promise<ChainTrip | undefined>, readMeta(e, code)]);
  if (!t) return null;
  return {
    code,
    network: entry.network,
    place: meta?.place ?? code,
    stay: meta?.stay ?? t.stay ?? "",
    check_in: t.check_in,
    check_out: t.check_out,
    n_beds: t.n_beds,
    paid: t.beds.filter((b) => b.status === "Paid").length,
    price_usdc: Number(BigInt(t.price)) / 1_000_000,
    status: tripStatus(t),
    roles: currentRoles(t, accounts),
    created_at: meta?.created_at ?? entry.at,
    book_by: new Date(Number(BigInt(t.book_by) / 1_000_000n)).toISOString(),
  };
}

/** Trips this device's accounts created, hold a bed in, or wait for. Reads the NAMES index, then the chain. */
myTripsRoute.get("/my-trips", async (c) => {
  const env = c.env;
  rateLimit(`mytrips:ip:${clientIp(c)}`, 30, 60_000);
  const raw = (c.req.query("accounts") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const list = parse(accounts, [...new Set(raw)]);

  let found: { code: string; entry: AcctEntry }[][];
  try {
    found = await Promise.all(list.map((a) => listAccount(env, a)));
  } catch {
    throw new ApiError(503, "E_INDEX_UNAVAILABLE", "the trip index is unavailable, try again");
  }
  const merged = new Map<string, { network: AcctEntry["network"]; at: string; roles: RoleRef[] }>();
  for (const { code, entry } of found.flat()) {
    const cur = merged.get(code) ?? { network: entry.network, at: entry.at, roles: [] };
    for (const r of rolesOf(entry)) if (!cur.roles.some((x) => x.role === r.role && (x.n ?? 0) === (r.n ?? 0))) cur.roles.push(r);
    if (entry.at > cur.at) cur.at = entry.at;
    merged.set(code, cur);
  }
  const picked = [...merged.entries()].sort((a, b) => (a[1].at < b[1].at ? 1 : a[1].at > b[1].at ? -1 : 0)).slice(0, MAX_TRIPS);
  const settled = await Promise.allSettled(picked.map(([code, entry]) => build(env, code, entry, list)));
  const trips = settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  // A trip dropped by a flaky RPC is skipped, but an answer made only of failures is an error, not an empty list.
  if (trips.length === 0 && settled.some((r) => r.status === "rejected")) throw new ApiError(502, "E_RPC", "could not read the trips from NEAR, try again");
  trips.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  c.header("cache-control", "no-store");
  return c.json({ trips });
});
