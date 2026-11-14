import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import { type Env, receiptRegex } from "./env";
import { getStatus, submitDeposit } from "./oneclick";
import { depositAddressParam } from "./schemas";
import { sweepReceipt } from "./sweep";
import { ftBalance, getTrip } from "./near";
import { rateLimit } from "./ratelimit";

export const statusRoute = new Hono<{ Bindings: Env }>();

statusRoute.get("/status/:depositAddress", async (c) => {
  const env = c.env;
  const addr = parse(depositAddressParam, c.req.param("depositAddress"));

  // Testnet / direct mode: the "deposit address" is the receipt account itself.
  if (receiptRegex(env).test(addr)) {
    const m = receiptRegex(env).exec(addr)!;
    const trip = await getTrip(env, m[3]);
    if (!trip) throw new ApiError(404, "E_TRIP_NOT_FOUND", `trip ${m[3]} not found`);
    const funded = (await ftBalance(env, addr)) >= BigInt(trip.price);
    const sweep = await sweepReceipt(env, addr, addr, { reusable: true });
    const paid = funded || sweep.sweep === "done" || sweep.sweep === "already_done";
    return c.json({ mode: "direct", status: paid ? "SUCCESS" : "PENDING_DEPOSIT", ...sweep });
  }

  const st = await getStatus(env, addr);
  if (st.status !== "SUCCESS") return c.json({ mode: "oneclick", status: st.status, sweep: "not_ready" });

  const recipient = st.quoteResponse?.quoteRequest?.recipient;
  if (!recipient) throw new ApiError(502, "E_ONECLICK", "1Click status had no recipient");
  const sweep = await sweepReceipt(env, addr, recipient);
  return c.json({ mode: "oneclick", status: st.status, recipient, ...sweep });
});

/* A wallet in the app paid the deposit: pass its transaction hash to 1Click (EVM 0x hash or a base58 signature). */
const submitBody = z
  .object({ depositAddress: depositAddressParam, txHash: z.string().regex(/^(0x[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{43,90})$/) })
  .strict();

statusRoute.post("/deposit/submit", async (c) => {
  const b = parse(submitBody, await readJson(c));
  rateLimit(`submit:${b.depositAddress}`, 6, 60_000);
  await submitDeposit(c.env, b.depositAddress, b.txHash);
  return c.json({ ok: true });
});
