import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { relayerAccount } from "./near";
import { txHashOf } from "./sweep";
import { rateLimit } from "./ratelimit";
import { bedIndex, tripCode } from "./schemas";

export const holdRoute = new Hono<{ Bindings: Env }>();

/** hold / reserve_wait are not payable: the dibs contract pays the USDC registration from its own balance. */
const HOLD_DEPOSIT = 0n;
const GAS = 100_000_000_000_000n;

const accountId = z.string().min(2).max(64).regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/);
const holdBody = z
  .object({ trip: tripCode, kind: z.enum(["bed", "wait"]), n: bedIndex, holder: accountId })
  .strict();

/** Sponsored hold: a keyless passkey account has no NEAR, so the relayer calls hold / reserve_wait and pays the deposit. */
holdRoute.post("/hold", async (c) => {
  const env = c.env;
  const b = parse(holdBody, await readJson(c));
  rateLimit(`hold:ip:${c.req.header("cf-connecting-ip") ?? "anon"}`, 12, 60_000);
  rateLimit(`hold:${b.holder}`, 6, 60_000);
  try {
    const res = await relayerAccount(env).callFunctionRaw({
      contractId: env.DIBS_CONTRACT,
      methodName: b.kind === "bed" ? "hold" : "reserve_wait",
      args: b.kind === "bed" ? { trip: b.trip, n: b.n, holder: b.holder } : { trip: b.trip, slot: b.n, buyer: b.holder },
      gas: GAS,
      deposit: HOLD_DEPOSIT,
      waitUntil: "EXECUTED_OPTIMISTIC",
    });
    return c.json({ tx_hash: txHashOf(res), trip: b.trip, kind: b.kind, n: b.n, holder: b.holder });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_HOLD_FAILED", "hold transaction was rejected (bed not open, or relayer not registered on the contract)");
  }
});
