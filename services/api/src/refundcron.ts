import type { Env } from "./env";
import { GAS_300, relayerCall } from "./calls";
import { getTrip } from "./near";
import { recordActivity } from "./activity";
import { planRefund, refundEligibility, usdc, type PlanTrip } from "./refundplan";

/* The trip rule "no verified booking by the deadline: everyone is refunded automatically", made true. A cron trigger
   sweeps testnet trips past book_by with no booking proof and calls the contract's refund_all (bed refunds go through
   DAO transfer proposals the contract approves in the same transaction tree, waitlist buyers are paid directly), then
   writes one receipt per refunded payer with that transaction. Mainnet is never touched here. */
const MAX_TRIPS_PER_RUN = 5;
const MAX_CALLS_PER_TRIP = 4;
/** Seeded examples have no app metadata; they join the sweep only when REFUND_SAMPLES is "1". */
export const SAMPLE_TRIPS = ["lis0312", "lis0314", "drw0001", "sin1025"];

const short = (a: string) => (/^[0-9a-f]{64}$|^0x[0-9a-f]{40}$/.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const owed = (t: PlanTrip) => t.beds.some((b) => b.status === "Paid" || b.status === "Listed") || t.waitlist.length > 0;

async function tripCodes(env: Env): Promise<string[]> {
  const codes: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await env.NAMES.list({ prefix: "trip/", limit: 1000, cursor });
    codes.push(...page.keys.map((k) => k.name.slice("trip/".length)));
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  if (env.REFUND_SAMPLES === "1") codes.push(...SAMPLE_TRIPS);
  return [...new Set(codes)];
}

export interface RefundRun {
  trip: string;
  calls: number;
  done: boolean;
}

export async function runRefunds(env: Env, nowMs = Date.now()): Promise<RefundRun[]> {
  if (env.NEAR_NETWORK === "mainnet") return [];
  const out: RefundRun[] = [];
  for (const code of await tripCodes(env)) {
    if (out.length >= MAX_TRIPS_PER_RUN) break;
    let t = (await getTrip(env, code)) as PlanTrip | undefined;
    if (!t || !refundEligibility(t, nowMs).ok || !owed(t)) continue;
    const run: RefundRun = { trip: code, calls: 0, done: false };
    out.push(run);
    while (t && run.calls < MAX_CALLS_PER_TRIP && refundEligibility(t, nowMs).ok) {
      const plan = planRefund(t, 3);
      const tx = await relayerCall(env, env.DIBS_CONTRACT, "refund_all", { trip: code, limit: 3 }, { gas: GAS_300, failCode: "E_REFUND_FAILED", failMsg: "refund_all was rejected" });
      run.calls += 1;
      const amount = usdc(t.price);
      for (const it of plan.items) {
        const who = it.kind === "bed" ? `Bed ${it.n}` : `Waitlist #${it.n}`;
        await recordActivity(env, code, { kind: "refund", text: `${who} refunded $${amount} to ${short(it.payer)}`, tx });
      }
      if (plan.done) {
        run.done = true;
        await recordActivity(env, code, { kind: "refund", text: "Deadline passed without a verified booking: every paid bed refunded", tx });
        break;
      }
      t = (await getTrip(env, code)) as PlanTrip | undefined;
    }
  }
  return out;
}
