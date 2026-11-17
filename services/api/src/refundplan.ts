/* Pure refund rules, no imports: the cron and the dry-run script (node --experimental-strip-types) both load this file. */

export interface PlanTrip {
  price: string;
  n_beds: number;
  book_by: string;
  refunded: boolean;
  refund_cursor: number;
  proof: unknown;
  proof_pending: boolean;
  payout?: unknown;
  beds: { holder: string | null; status: string }[];
  waitlist: { buyer: string; slot: number }[];
}

export interface RefundItem {
  kind: "bed" | "wait";
  n: number;
  payer: string;
}

export type Eligibility = { ok: true } | { ok: false; reason: "refunded" | "proof_exists" | "proof_pending" | "before_deadline" };

/** refund_all's own preconditions, in the order refund.rs checks them. */
export function refundEligibility(t: PlanTrip, nowMs: number): Eligibility {
  if (t.refunded) return { ok: false, reason: "refunded" };
  if (BigInt(nowMs) * 1_000_000n <= BigInt(t.book_by)) return { ok: false, reason: "before_deadline" };
  if (t.proof) return { ok: false, reason: "proof_exists" };
  if (t.proof_pending) return { ok: false, reason: "proof_pending" };
  return { ok: true };
}

/** Mirrors refund_all's loops for one call: who it pays (bed holders first, then waitlist buyers) and whether it finishes the trip. */
export function planRefund(t: PlanTrip, limit: number): { items: RefundItem[]; done: boolean } {
  const items: RefundItem[] = [];
  let left = Math.min(3, Math.max(1, limit));
  let cursor = t.refund_cursor;
  while (left > 0 && cursor < t.n_beds) {
    const b = t.beds[cursor];
    cursor += 1;
    if ((b.status === "Paid" || b.status === "Listed") && b.holder) {
      items.push({ kind: "bed", n: cursor, payer: b.holder });
      left -= 1;
    }
  }
  let w = 0;
  while (left > 0 && cursor >= t.n_beds && w < t.waitlist.length) {
    items.push({ kind: "wait", n: t.waitlist[w].slot, payer: t.waitlist[w].buyer });
    w += 1;
    left -= 1;
  }
  return { items, done: cursor >= t.n_beds && w >= t.waitlist.length };
}

export const usdc = (price: string): string => {
  const v = BigInt(price);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
};
