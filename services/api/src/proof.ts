import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import { type Env } from "./env";
import { NEAR, GAS_300, relayerCall, clientIp } from "./calls";
import { rateLimit } from "./ratelimit";
import { tripCode, bedIndex } from "./schemas";
import { recordActivity } from "./activity";
import { relayerAccount } from "./near";

export const proofRoute = new Hono<{ Bindings: Env }>();

const DEPOSIT = (NEAR * 25n) / 1000n; // 0.025 NEAR

const proofBody = z
  .object({ trip: tripCode, blob_url: z.string().url().max(300), blob_sha256: z.string().regex(/^[0-9a-f]{64}$/) })
  .strict();
const tripBody = z.object({ trip: tripCode }).strict();
const refundBody = z.object({ trip: tripCode, n: bedIndex }).strict();

/** Relayer-paid submit_proof (allowed for relayers since contract v1.2). Payout still goes only to the booker. */
proofRoute.post("/proof/submit", async (c) => {
  const env = c.env;
  const b = parse(proofBody, await readJson(c));
  const base = (env.PUBLIC_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  if (!b.blob_url.startsWith(`${base}/blob/`)) throw new ApiError(400, "E_BAD_BLOB_URL", "blob_url must be one returned by /proof-blob");
  rateLimit(`proof:ip:${clientIp(c)}`, 6, 60_000);
  rateLimit(`proof:${b.trip}`, 4, 60_000);
  const tx_hash = await relayerCall(env, env.DIBS_CONTRACT, "submit_proof", { trip: b.trip, blob_url: b.blob_url, blob_sha256: b.blob_sha256 }, { deposit: DEPOSIT, gas: GAS_300, failCode: "E_PROOF_SUBMIT_FAILED", failMsg: "submit_proof was rejected (not all beds Paid, past book_by, or a proof is pending)" });
  await recordActivity(env, b.trip, { kind: "proof_submitted", text: "Booking confirmation submitted for verification", tx: tx_hash });
  return c.json({ tx_hash });
});

/** Anyone may trigger the draw; the relayer attaches the deposit a 0.01 NEAR user account cannot. */
proofRoute.post("/draw", async (c) => {
  const env = c.env;
  const b = parse(tripBody, await readJson(c));
  rateLimit(`draw:ip:${clientIp(c)}`, 10, 60_000);
  rateLimit(`draw:${b.trip}`, 3, 60_000);
  const tx_hash = await relayerCall(env, env.DIBS_CONTRACT, "request_draw", { trip: b.trip }, { deposit: DEPOSIT, gas: GAS_300, failCode: "E_DRAW_FAILED", failMsg: "request_draw was rejected (all beds must be Paid)" });
  await recordActivity(env, b.trip, { kind: "draw", text: "Random draw requested", tx: tx_hash });
  return c.json({ tx_hash });
});

/** Surfaces the contract's real refusal (always E_NO_REFUND) with the failed tx hash. */
proofRoute.post("/refund-check", async (c) => {
  const env = c.env;
  const b = parse(refundBody, await readJson(c));
  rateLimit(`refund:ip:${clientIp(c)}`, 10, 60_000);
  rateLimit(`refund:${b.trip}`, 5, 60_000);
  let res: unknown;
  try {
    res = await relayerAccount(env).callFunctionRaw({ contractId: env.DIBS_CONTRACT, methodName: "request_refund", args: { trip: b.trip, n: b.n }, gas: 50_000_000_000_000n, deposit: 0n, waitUntil: "EXECUTED_OPTIMISTIC" });
  } catch (e) {
    res = e;
  }
  const text = (() => { try { return JSON.stringify(res, (_k, v) => (typeof v === "bigint" ? v.toString() : v)); } catch { return ""; } })();
  const code = /E_[A-Z_]+/.exec(text)?.[0];
  const r = res as { transaction?: { hash?: string }; transaction_outcome?: { id?: string }; tx_hash?: string };
  const tx_hash = r?.transaction?.hash ?? r?.transaction_outcome?.id ?? r?.tx_hash ?? /"(?:tx_hash|transaction_hash|hash)":"([1-9A-HJ-NP-Za-km-z]{43,44})"/.exec(text)?.[1] ?? null;
  if (!code) {
    if (!tx_hash) throw new ApiError(502, "E_REFUND_CHECK_FAILED", "could not read the contract's answer");
    return c.json({ code: null, error: null, tx_hash, refused: false });
  }
  await recordActivity(env, b.trip, { kind: "refund_refused", text: `Refund for bed ${b.n} refused on chain: ${code}`, tx: tx_hash });
  return c.json({ code, error: "the contract refused the refund", tx_hash, refused: true });
});
