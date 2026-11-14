import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import { type Env, isTestnet, receiptAccount } from "./env";
import { getTrip } from "./near";
import { relayerCall, clientIp } from "./calls";
import { rateLimit } from "./ratelimit";
import { bedIndex, tripCode } from "./schemas";
import { sweepReceipt } from "./sweep";
import { recordActivity } from "./activity";

export const fundRoute = new Hono<{ Bindings: Env }>();

const fundBody = z.object({ trip: tripCode, kind: z.enum(["bed", "wait"]), n: bedIndex }).strict();

/** Testnet stand-in for "your deposit arrived": mint the trip price to the receipt account, then sweep it. */
fundRoute.post("/testnet/fund", async (c) => {
  const env = c.env;
  if (!isTestnet(env)) return c.json({ error: "not found", code: "E_NOT_FOUND" }, 404);
  const b = parse(fundBody, await readJson(c));
  rateLimit(`fund:ip:${clientIp(c)}`, 8, 10 * 60_000);
  rateLimit(`fund:${b.trip}:${b.kind}:${b.n}`, 3, 60_000);

  const trip = (await getTrip(env, b.trip)) as { price: string; n_beds: number; n_wait?: number; beds?: { status: string }[]; wait_res?: unknown[] } | undefined;
  if (!trip) throw new ApiError(404, "E_TRIP_NOT_FOUND", `trip ${b.trip} not found`);
  if (b.n > (b.kind === "bed" ? trip.n_beds : trip.n_wait ?? 0)) throw new ApiError(400, "E_BAD_INPUT", "n is out of range for this trip");
  const open = b.kind === "bed" ? trip.beds?.[b.n - 1]?.status === "Held" : trip.wait_res?.[b.n - 1] != null;
  if (!open) throw new ApiError(409, "E_NOT_HELD", `${b.kind} ${b.n} is not held, so there is nothing to pay`);

  const receipt = receiptAccount(env, b.kind, b.trip, b.n);
  const mint_tx = await relayerCall(env, env.USDC_CONTRACT, "mint", { account_id: receipt, amount: trip.price }, { failCode: "E_MINT_FAILED", failMsg: "test USDC mint failed" });
  const sw = await sweepReceipt(env, receipt, receipt, { reusable: true });
  const sweep_tx = sw.sweep === "done" ? sw.tx_hash : null;
  await recordActivity(env, b.trip, { kind: "deposit", text: `${b.kind === "bed" ? "Bed" : "Waitlist slot"} ${b.n} paid (testnet deposit)`, tx: sweep_tx ?? mint_tx });
  return c.json({ mint_tx, sweep_tx, status: sw.sweep });
});
