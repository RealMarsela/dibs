import { ApiError } from "./errors";
import { type Env, receiptRegex } from "./env";
import { ftBalance, getTrip, relayerAccount } from "./near";

const SWEEP_GAS = 300_000_000_000_000n;
const CLAIM_STALE_MS = 90_000;
const DONE_DEBOUNCE_MS = 120_000;

export type SweepResult =
  | { sweep: "done"; tx_hash: string | null }
  | { sweep: "already_done" }
  | { sweep: "in_progress" }
  | { sweep: "no_funds" };

interface Marker {
  state: "claimed" | "done";
  at: number;
  tx_hash?: string;
}

export function txHashOf(res: unknown): string | null {
  const r = res as { transaction?: { hash?: string }; transaction_outcome?: { id?: string }; status?: unknown };
  if (r.status && typeof r.status === "object" && "Failure" in r.status) throw new ApiError(502, "E_TX_FAILED", "transaction failed on chain");
  return r.transaction?.hash ?? r.transaction_outcome?.id ?? null;
}

const markerKey = (deposit: string) => `sweeps/${deposit}`;

async function readMarker(env: Env, key: string): Promise<Marker | undefined> {
  const o = await env.BLOBS.get(key);
  return o ? ((await o.json()) as Marker) : undefined;
}

/**
 * Sweep a receipt account into the trip. Idempotent: an R2 marker per deposit address is claimed
 * with a create-only put, and the on-chain USDC balance is re-checked before every call, so a
 * repeated or concurrent GET /status can never sweep twice.
 */
export async function sweepReceipt(env: Env, depositAddress: string, receipt: string, opts: { reusable?: boolean; now?: number } = {}): Promise<SweepResult> {
  const now = opts.now ?? Date.now();
  const m = receiptRegex(env).exec(receipt);
  if (!m) throw new ApiError(403, "E_NOT_OUR_RECEIPT", "recipient is not a Dibs receipt account");
  const trip = await getTrip(env, m[3]);
  if (!trip) throw new ApiError(404, "E_TRIP_NOT_FOUND", `trip ${m[3]} not found`);
  const price = BigInt(trip.price);

  const key = markerKey(depositAddress);
  const existing = await readMarker(env, key);
  // A 1Click deposit address is single-use, so its marker is permanent. A direct-mode receipt
  // account can be paid again after a resale, so there the marker only debounces and the
  // on-chain balance is the real guard.
  if (existing?.state === "done" && (!opts.reusable || now - existing.at < DONE_DEBOUNCE_MS)) return { sweep: "already_done" };
  if (existing?.state === "claimed" && now - existing.at < CLAIM_STALE_MS) return { sweep: "in_progress" };

  if ((await ftBalance(env, receipt)) < price) return { sweep: "no_funds" };

  const claim: Marker = { state: "claimed", at: now };
  if (!existing) {
    const put = await env.BLOBS.put(key, JSON.stringify(claim), { onlyIf: { etagDoesNotMatch: "*" } });
    if (put === null) return { sweep: "in_progress" }; // lost the race
  } else {
    await env.BLOBS.put(key, JSON.stringify(claim)); // stale claim, take over
  }

  let txHash: string | null = null;
  try {
    const res = await relayerAccount(env).callFunctionRaw({
      contractId: receipt,
      methodName: "sweep",
      args: { amount: price.toString() },
      gas: SWEEP_GAS,
      deposit: 0n,
      waitUntil: "EXECUTED_OPTIMISTIC",
    });
    txHash = txHashOf(res);
  } catch (e) {
    await env.BLOBS.delete(key); // release so a later poll can retry
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_SWEEP_FAILED", "sweep transaction failed; it will be retried on the next poll");
  }
  const done: Marker = { state: "done", at: now, tx_hash: txHash ?? undefined };
  await env.BLOBS.put(key, JSON.stringify(done));
  return { sweep: "done", tx_hash: txHash };
}
