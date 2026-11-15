import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import { receiptAccount, type Env } from "./env";
import { ftBalance, getTrip, relayerAccount } from "./near";
import { txHashOf } from "./sweep";
import { rateLimit } from "./ratelimit";
import { ensureImplicitAccount } from "./bootstrap";
import { recordActivity } from "./activity";
import { bedIndex, tripCode } from "./schemas";

export const holdRoute = new Hono<{ Bindings: Env }>();

/** hold / reserve_wait are not payable: the dibs contract pays the USDC registration from its own balance. */
const HOLD_DEPOSIT = 0n;
/* Mainnet reserves attached gas at about 10x the base price up front (0.1 NEAR for 100 Tgas), so the relayer attaches
   what a hold needs there: 60 Tgas, of which bed 2's hold on mainnet burned 27. */
const gasFor = (env: Env) => (env.NEAR_NETWORK === "mainnet" ? 60_000_000_000_000n : 100_000_000_000_000n);

const accountId = z.string().min(2).max(64).regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/);
const holdBody = z
  .object({ trip: tripCode, kind: z.enum(["bed", "wait"]), n: bedIndex, holder: accountId })
  .strict();

/**
 * The contract lets a new buyer take over an expired, unfunded waitlist reservation. A payment sent to the slot's receipt
 * account is credited to whoever holds the slot when it is swept, so while USDC sits there for the current reserver, refuse.
 */
async function guardPayingSlot(env: Env, trip: string, n: number, holder: string): Promise<void> {
  const t = await getTrip(env, trip);
  const current = (t?.wait_res as (string | null)[] | undefined)?.[n - 1];
  if (!current || current === holder) return;
  if ((await ftBalance(env, receiptAccount(env, "wait", trip, n))) > 0n) {
    throw new ApiError(409, "E_SLOT_PAYING", "a payment is landing for the current holder of that waitlist slot; try again in a few minutes");
  }
}

/** Sponsored hold: a keyless passkey account has no NEAR, so the relayer calls hold / reserve_wait and pays the deposit. */
holdRoute.post("/hold", async (c) => {
  const env = c.env;
  const b = parse(holdBody, await readJson(c));
  rateLimit(`hold:ip:${c.req.header("cf-connecting-ip") ?? "anon"}`, 12, 60_000);
  rateLimit(`hold:${b.holder}`, 6, 60_000);
  if (b.kind === "wait") await guardPayingSlot(env, b.trip, b.n, b.holder);
  const boot = await ensureImplicitAccount(env, b.holder);
  try {
    const res = await relayerAccount(env).callFunctionRaw({
      contractId: env.DIBS_CONTRACT,
      methodName: b.kind === "bed" ? "hold" : "reserve_wait",
      args: b.kind === "bed" ? { trip: b.trip, n: b.n, holder: b.holder } : { trip: b.trip, slot: b.n, buyer: b.holder },
      gas: gasFor(env),
      deposit: HOLD_DEPOSIT,
      waitUntil: "EXECUTED_OPTIMISTIC",
    });
    const tx_hash = txHashOf(res);
    await recordActivity(env, b.trip, { kind: "hold", text: `${b.kind === "bed" ? "Bed" : "Waitlist slot"} ${b.n} held`, tx: tx_hash });
    return c.json({ tx_hash, trip: b.trip, kind: b.kind, n: b.n, holder: b.holder, bootstrap_tx: boot.tx_hash });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_HOLD_FAILED", b.kind === "bed" ? "hold transaction was rejected (bed not open, or relayer not registered on the contract)" : "that waitlist slot is already taken, or the waitlist is closed");
  }
});
