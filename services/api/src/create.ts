import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { clientIp, GAS_300, NEAR, relayerCall } from "./calls";
import { ensureImplicitAccount } from "./bootstrap";
import { accountExists, nearBalance, view } from "./near";
import { recordActivity } from "./activity";
import { addInboxRule } from "./inboxrule";
import { tripCode } from "./schemas";
import { BOOKER_MESSAGE, type Nep413Proof, proofSchema, verifyNep413 } from "./nep413";
import { type Erc191Proof, erc191ProofSchema, verifyErc191 } from "./erc191";

export const createRoute = new Hono<{ Bindings: Env }>();

export const PER_IP_PER_DAY = 2;
export const PER_DAY = 20;
export const MIN_RELAYER = NEAR; // refuse below 1 NEAR
const MARGIN = 2n * 10n ** 22n; // 0.02 NEAR on top of create_cost; the contract refunds the excess
const BOOK_BY_MS = 3 * 24 * 3600 * 1000;
const DAY_TTL = 2 * 24 * 3600;

export interface TripMeta {
  code: string;
  place: string;
  stay: string;
  created_at: string;
  creator: string;
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "not a real date");

const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine((s) => !/[\u0000-\u001f<>]/.test(s), "no control characters or angle brackets");

const IMPLICIT = z.string().regex(/^[0-9a-f]{64}$/);
const NAMED = /^(?=.{2,64}$)([a-z\d]+[-_])*[a-z\d]+(\.([a-z\d]+[-_])*[a-z\d]+)*$/;
const ETH_IMPLICIT = z.string().regex(/^0x[0-9a-f]{40}$/);
const isImplicit = (a: string): boolean => /^[0-9a-f]{64}$/.test(a);
const isEth = (a: string): boolean => /^0x[0-9a-f]{40}$/.test(a);

export const createBody = z
  .object({
    place: text(2, 40),
    stay: text(2, 60),
    check_in: ymd,
    check_out: ymd,
    beds: z.number().int().min(2).max(6),
    price_usdc: z.number().int().min(1).max(50),
    booker: z.union([IMPLICIT, ETH_IMPLICIT, z.string().regex(NAMED, "booker must be a 64-hex implicit account or a NEAR account id")]),
    auth: z.union([proofSchema, erc191ProofSchema]).optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const now = Date.now();
    const limit = now + 2 * 366 * 86400_000;
    const a = Date.parse(`${b.check_in}T00:00:00Z`);
    const o = Date.parse(`${b.check_out}T00:00:00Z`);
    if (o <= a) ctx.addIssue({ code: "custom", path: ["check_out"], message: "check_out must be after check_in" });
    if (a < now - 86400_000 || a > limit) ctx.addIssue({ code: "custom", path: ["check_in"], message: "check_in must be within the next 2 years" });
    if (o > limit) ctx.addIssue({ code: "custom", path: ["check_out"], message: "check_out must be within the next 2 years" });
  });

/** First 3 letters of the place (accents folded) plus 5 random [a-z0-9]. */
export function makeCode(place: string): string {
  const letters = place.normalize("NFD").toLowerCase().replace(/[^a-z]/g, "").slice(0, 3).padEnd(3, "x");
  const al = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return letters + Array.from(bytes, (x) => al[x % 36]).join("");
}

async function bump(env: Env, key: string, max: number, code: string, msg: string): Promise<void> {
  const n = Number((await env.NAMES.get(key)) ?? 0);
  if (n >= max) throw new ApiError(429, code, msg);
  await env.NAMES.put(key, String(n + 1), { expirationTtl: DAY_TTL });
}

createRoute.post("/trips", async (c) => {
  const env = c.env;
  const b = parse(createBody, await readJson(c));
  const dao = env.TRIP_DAO;
  const eth = isEth(b.booker);
  const named = !isImplicit(b.booker) && !eth;
  if (!dao) throw new ApiError(503, "E_NOT_CONFIGURED", "trip creation is not enabled on this deployment");
  if (named && !b.auth) throw new ApiError(401, "E_AUTH_REQUIRED", "a named NEAR account needs a signed NEP-413 proof (auth)");
  if (eth && !b.auth) throw new ApiError(401, "E_AUTH_REQUIRED", "an Ethereum wallet account needs a signed ERC-191 proof (auth)");
  if (named && b.auth && !("accountId" in b.auth)) throw new ApiError(400, "E_BAD_INPUT", "a named NEAR account needs a NEP-413 proof, not an ERC-191 one");
  if (eth && b.auth && !("address" in b.auth)) throw new ApiError(400, "E_BAD_INPUT", "an Ethereum wallet account needs an ERC-191 proof, not a NEP-413 one");
  const day = new Date().toISOString().slice(0, 10);
  const ip = clientIp(c);
  // Check both counters before bumping either, so a refused request costs the caller nothing.
  const ipKey = `rl/trip/ip/${ip}/${day}`;
  const dayKey = `rl/trip/day/${day}`;
  if (Number((await env.NAMES.get(ipKey)) ?? 0) >= PER_IP_PER_DAY) throw new ApiError(429, "E_RATE_LIMIT", "2 trips per person per day");
  if (Number((await env.NAMES.get(dayKey)) ?? 0) >= PER_DAY) throw new ApiError(429, "E_DAILY_CAP", "the demo has reached today's trip limit, try tomorrow");
  if ((await nearBalance(env, env.RELAYER_ACCOUNT_ID)) < MIN_RELAYER) throw new ApiError(503, "E_RELAYER_LOW", "the demo relayer is low on testnet NEAR, try later");
  if (named) {
    // Verify only after the cheap quota and balance checks; the proof consumes its nonce.
    if ((await verifyNep413(env, b.auth as Nep413Proof, BOOKER_MESSAGE)) !== b.booker) throw new ApiError(401, "E_AUTH_ACCOUNT", "the proof is for a different account than booker");
    if (!(await accountExists(env, b.booker))) throw new ApiError(400, "E_ACCOUNT_NOT_FOUND", `account ${b.booker} does not exist`);
  }
  if (eth) {
    // eth-implicit accounts are created on first use, so no existence check and no bootstrap.
    if ((await verifyErc191(env, b.auth as Erc191Proof)) !== b.booker) throw new ApiError(401, "E_AUTH_ACCOUNT", "the proof is for a different account than booker");
  }
  let code = makeCode(b.place);
  for (let i = 0; i < 4 && (await view(env, env.DIBS_CONTRACT, "get_trip", { trip: code })); i++) code = makeCode(b.place);
  tripCode.parse(code);

  const cost = BigInt((await view<string>(env, env.DIBS_CONTRACT, "create_cost", { n_beds: b.beds, n_wait: 2 })) ?? "0");
  if (cost === 0n) throw new ApiError(502, "E_RPC", "could not read the trip cost");
  // Reads are done; only now spend the caller's quota, so an RPC hiccup before this line costs them nothing.
  await bump(env, ipKey, PER_IP_PER_DAY, "E_RATE_LIMIT", "2 trips per person per day");
  await bump(env, dayKey, PER_DAY, "E_DAILY_CAP", "the demo has reached today's trip limit, try tomorrow");

  const book_by = String((Date.now() + BOOK_BY_MS) * 1_000_000);
  const tx_hash = await relayerCall(
    env, env.DIBS_CONTRACT, "create_trip",
    { code, price: String(b.price_usdc * 1_000_000), n_beds: b.beds, n_wait: 2, book_by, booker: b.booker, dao, check_in: b.check_in, check_out: b.check_out, stay: b.stay },
    { deposit: cost + MARGIN, gas: GAS_300, failCode: "E_CREATE_FAILED", failMsg: "the contract refused the trip (dates, code or funds)" },
  );

  if (isImplicit(b.booker)) await ensureImplicitAccount(env, b.booker);
  const hold_tx = await relayerCall(env, env.DIBS_CONTRACT, "hold", { trip: code, n: 1, holder: b.booker }, { failCode: "E_HOLD_FAILED", failMsg: "trip created but bed 1 could not be held" });

  const meta: TripMeta = { code, place: b.place, stay: b.stay, created_at: new Date().toISOString(), creator: b.booker };
  await env.NAMES.put(`trip/${code}`, JSON.stringify(meta));
  await recordActivity(env, code, { kind: "created", text: `Trip created, bed 1 held`, tx: tx_hash });
  const inbox = await addInboxRule(env, code);
  return c.json({ code, url: `/t/${code}`, tx_hash, hold_tx, inbox });
});

export async function readMeta(env: Env, code: string): Promise<TripMeta | null> {
  try {
    return ((await env.NAMES.get(`trip/${code}`, "json")) as TripMeta | null) ?? null;
  } catch {
    return null;
  }
}

createRoute.get("/trips/:code/meta", async (c) => {
  const code = parse(tripCode, c.req.param("code"));
  const m = await readMeta(c.env, code);
  if (!m) throw new ApiError(404, "E_NOT_FOUND", `no details for trip ${code}`);
  c.header("cache-control", "public, max-age=30");
  return c.json({ place: m.place, stay: m.stay });
});
