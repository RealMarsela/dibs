import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { rateLimit } from "./ratelimit";
import { tripCode } from "./schemas";
import { simulate, type SimResult } from "./cardsim";
import { runCardOp } from "./cardrun";

/* The trip's virtual card. The dibs-verifier TEE issues it (op `card`) and signs
   `dibs-card:v1:{trip,card_token,last4,spend_limit,mcc,sealed_hex}`. This API stores only what that signature covers,
   checked against the pinned verifier key, so a forged record is impossible. `sealed_hex` is sealed to the booker's
   key: the API cannot read the card number. */

export const cardRoute = new Hono<{ Bindings: Env }>();
export const CARD_PREFIX = "dibs-card:v1:";

export interface CardRecord {
  trip: string;
  card_token: string;
  last4: string;
  spend_limit: number;
  mcc: string;
  sealed_hex: string;
  issued_at: string;
  simulations: SimResult[];
}

const hex = (n: number) => new RegExp(`^[0-9a-f]{${n}}$`);
const signedBody = z.object({ message: z.string().min(20).max(4000), signature: z.string().regex(hex(128)) }).strict();
const facts = z
  .object({
    trip: tripCode,
    card_token: z.string().regex(/^[0-9a-f-]{36}$/),
    last4: z.string().regex(/^\d{4}$/),
    spend_limit: z.number().int().positive().max(50_000_000),
    mcc: z.string().regex(/^\d{4}$/),
    sealed_hex: z.string().regex(/^[0-9a-f]{160,2000}$/),
  })
  .strict();
const simBody = z.object({ merchant: z.enum(["carlton", "electronics"]) }).strict();

const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const recordKey = (trip: string) => `cards/${trip}.json`;

export async function verifyIssued(pubHex: string, message: string, sigHex: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", fromHex(pubHex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromHex(sigHex), new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

async function load(env: Env, trip: string): Promise<CardRecord | null> {
  const o = await env.BLOBS.get(recordKey(trip));
  return o ? ((await o.json()) as CardRecord) : null;
}

const publicView = (r: CardRecord) => ({ last4: r.last4, spend_limit: r.spend_limit, mcc: r.mcc, sealed_hex: r.sealed_hex, issued_at: r.issued_at, simulations: r.simulations });

/** Verify and store a signed `card` output; shared by /issued and /issue. */
async function storeIssued(env: Env, trip: string, message: string, signature: string) {
  if (!env.VERIFIER_PUBLIC_KEY || !hex(64).test(env.VERIFIER_PUBLIC_KEY)) throw new ApiError(503, "E_VERIFIER_UNCONFIGURED", "verifier key is not configured");
  if (!message.startsWith(CARD_PREFIX)) throw new ApiError(400, "E_BAD_PREFIX", "not a dibs-card message");
  if (!(await verifyIssued(env.VERIFIER_PUBLIC_KEY, message, signature))) throw new ApiError(403, "E_BAD_SIG", "signature does not verify against the verifier key");
  let f: z.infer<typeof facts>;
  try {
    f = parse(facts, JSON.parse(message.slice(CARD_PREFIX.length)));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "E_BAD_FACTS", "message body is not valid JSON");
  }
  if (f.trip !== trip) throw new ApiError(400, "E_TRIP_MISMATCH", "message is for another trip");
  const have = await load(env, trip);
  if (have) {
    if (have.card_token === f.card_token) return { ...publicView(have), stored: false };
    throw new ApiError(409, "E_CARD_EXISTS", "this trip already has a different card");
  }
  const rec: CardRecord = { ...f, issued_at: new Date().toISOString(), simulations: [] };
  const put = await env.BLOBS.put(recordKey(trip), JSON.stringify(rec), { onlyIf: { etagDoesNotMatch: "*" } });
  if (put === null) throw new ApiError(409, "E_CARD_EXISTS", "this trip already has a card");
  return { ...publicView(rec), stored: true };
}

/** Post the OutLayer `card` output ({message, signature}); stored once per trip. */
cardRoute.post("/card/:trip/issued", async (c) => {
  const trip = parse(tripCode, c.req.param("trip"));
  const b = parse(signedBody, await readJson(c));
  rateLimit(`card:issued:${c.req.header("cf-connecting-ip") ?? "anon"}`, 20, 60_000);
  return c.json(await storeIssued(c.env, trip, b.message, b.signature));
});

/** Trigger the TEE `card` op (relayer -> OutLayer request_execution), then store the result through the same verification. */
cardRoute.post("/card/:trip/issue", async (c) => {
  const env = c.env;
  const trip = parse(tripCode, c.req.param("trip"));
  rateLimit(`card:issue:ip:${c.req.header("cf-connecting-ip") ?? "anon"}`, 6, 60_000);
  rateLimit(`card:issue:${trip}`, 3, 60_000);
  const existing = await load(env, trip);
  if (existing) return c.json({ last4: existing.last4, spend_limit: existing.spend_limit, mcc: existing.mcc });
  const out = await runCardOp(env, trip);
  const r = await storeIssued(env, trip, out.message, out.signature);
  return c.json({ last4: r.last4, spend_limit: r.spend_limit, mcc: r.mcc });
});

cardRoute.get("/card/:trip", async (c) => {
  const r = await load(c.env, parse(tripCode, c.req.param("trip")));
  if (!r) throw new ApiError(404, "E_NO_CARD", "no card issued for this trip yet");
  c.header("cache-control", "no-store");
  return c.json(publicView(r));
});

/** Demo "card terminal": runs a merchant authorization against the Lithic sandbox with the trip's card. */
cardRoute.post("/card/:trip/simulate", async (c) => {
  const env = c.env;
  const trip = parse(tripCode, c.req.param("trip"));
  const b = parse(simBody, await readJson(c));
  rateLimit(`card:sim:${c.req.header("cf-connecting-ip") ?? "anon"}`, 12, 60_000);
  if (!env.LITHIC_SIM_KEY) throw new ApiError(503, "E_SIM_UNCONFIGURED", "card simulation is not configured");
  const rec = await load(env, trip);
  if (!rec) throw new ApiError(404, "E_NO_CARD", "no card issued for this trip yet");
  const res = await simulate(env, rec, b.merchant);
  rec.simulations = [...rec.simulations, res].slice(-20);
  await env.BLOBS.put(recordKey(trip), JSON.stringify(rec));
  return c.json(res);
});
