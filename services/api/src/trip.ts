import { Hono } from "hono";
import { ApiError, parse } from "./errors";
import { type Env, receiptAccount } from "./env";
import { view } from "./near";
import { tripCode } from "./schemas";
import { readMeta } from "./create";

export const tripRoute = new Hono<{ Bindings: Env }>();

const CACHE_MS = 2000;
const cache = new Map<string, { at: number; body: unknown }>();
export const clearTripCache = (): void => cache.clear();

tripRoute.get("/trip/:code", async (c) => {
  const env = c.env;
  const code = parse(tripCode, c.req.param("code"));
  const key = `${env.DIBS_CONTRACT}:${code}`;
  const hit = cache.get(key);
  c.header("cache-control", "public, max-age=2");
  if (hit && Date.now() - hit.at < CACHE_MS) return c.json(hit.body);

  const [trip, waitlist, meta] = await Promise.all([
    view<{ n_beds: number; [k: string]: unknown }>(env, env.DIBS_CONTRACT, "get_trip", { trip: code }),
    view<unknown[]>(env, env.DIBS_CONTRACT, "get_waitlist", { trip: code }),
    readMeta(env, code),
  ]);
  if (!trip) throw new ApiError(404, "E_TRIP_NOT_FOUND", `trip ${code} not found`);

  const body = {
    code,
    network: env.NEAR_NETWORK,
    contract: env.DIBS_CONTRACT,
    usdc: env.USDC_CONTRACT,
    trip,
    ...(meta ? { meta: { place: meta.place, stay: meta.stay } } : {}),
    proof_pending: trip.proof_pending ?? false,
    proof: trip.proof ?? null,
    payout: trip.payout ?? "None",
    last_error: trip.last_error ?? null,
    waitlist: waitlist ?? [],
    bed_accounts: Array.from({ length: Number(trip.n_beds) }, (_, i) => receiptAccount(env, "bed", code, i + 1)),
    fetched_at: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), body });
  return c.json(body);
});
