import { actions, baseEncode, encodeTransaction } from "near-api-js";
import { sha256 } from "@noble/hashes/sha2";
import { ApiError } from "./errors";
import { type Env, rpcUrls } from "./env";
import { NEAR, GAS_300 } from "./calls";
import { provider, relayerAccount } from "./near";

const OUTLAYER = "outlayer.testnet";
const PROJECT = "own-0eb9ae.testnet/dibs-verifier";
/* The card op runs on verifier v6, not the active version. v7 (active, it carries the booking-email fix) exits
   without a result on the card op inside OutLayer, while v6 issues the card (checked live 2026-11-15, tx
   5Rv4M1eveHdFBM64P5MiGa7sVSsHNb7wrGcJutzsSCmr). Both versions sign with the same project key. */
export const CARD_VERSION = "96040162706a7f31d72c688197cddee6adf37a7b637f5344f2d75a05a447e670";

const REFUSAL_STATUS: Record<string, 409 | 400 | 502> = { E_NOT_FULL: 409, E_PAYOUT_STARTED: 409, E_REFUNDED: 409, E_NO_TRIP: 400, E_BOOKER: 409, E_INPUT: 400 };

/** Decode the final SuccessValue of a yielded OutLayer execution (JSON, possibly string-wrapped). */
export function decodeResult(res: unknown): Record<string, unknown> {
  const st = (res as { status?: { SuccessValue?: string } }).status;
  if (!st || typeof st.SuccessValue !== "string") throw new ApiError(502, "E_OUTLAYER_FAILED", "OutLayer execution did not succeed");
  let v: unknown = JSON.parse(atob(st.SuccessValue) || "null");
  if (typeof v === "string") v = JSON.parse(v);
  if (!v || typeof v !== "object") throw new ApiError(502, "E_OUTLAYER_FAILED", "OutLayer returned no result");
  return v as Record<string, unknown>;
}

const cardArgs = (env: Env, trip: string) => ({
  source: { Project: { project_id: PROJECT, version_key: CARD_VERSION } },
  input_data: JSON.stringify({ op: "card", trip, network: "testnet", contract: env.DIBS_CONTRACT }),
  resource_limits: { max_instructions: 2_000_000_000, max_memory_mb: 128, max_execution_seconds: 60 },
  response_format: "Json",
});

/**
 * Start op `card` in the TEE and return the transaction hash at once. OutLayer answers through a yielded callback that,
 * when its worker queue is busy, can take minutes or time out (NEAR yield limit, 200 blocks), so nobody waits on it here:
 * the caller polls `checkCardRun`. The relayer pays the 0.02 NEAR execution deposit; the unused part is refunded.
 */
export async function submitCardOp(env: Env, trip: string): Promise<string> {
  try {
    const signed = await relayerAccount(env).createSignedTransaction({
      receiverId: OUTLAYER,
      actions: [actions.functionCall("request_execution", cardArgs(env, trip), GAS_300, (NEAR * 20n) / 1000n)],
    });
    const hash = baseEncode(sha256(encodeTransaction(signed.transaction)));
    await provider(env).sendTransactionUntil(signed, "INCLUDED");
    return hash;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_OUTLAYER_FAILED", "could not start the card op on OutLayer");
  }
}

export type RunState = { state: "pending" } | { state: "failed" } | { state: "done"; message: string; signature: string };

/** Read a card run's outcome. A TEE refusal (bed not Paid, payout started...) throws as {error, code}. */
export function interpretRun(res: unknown): RunState {
  const st = (res as { status?: unknown } | null)?.status;
  if (!st || typeof st !== "object" || !("SuccessValue" in st || "Failure" in st)) return { state: "pending" };
  if ("Failure" in st) return { state: "failed" };
  let out: Record<string, unknown>;
  try {
    out = decodeResult(res);
  } catch {
    return { state: "failed" }; // "null": the worker never answered before the yield timed out
  }
  if (typeof out.error === "string" || typeof out.code === "string") {
    const code = String(out.code ?? "E_ISSUER");
    throw new ApiError(REFUSAL_STATUS[code] ?? 502, code, String(out.error ?? "card issuance refused"));
  }
  if (typeof out.message !== "string" || typeof out.signature !== "string") throw new ApiError(502, "E_OUTLAYER_FAILED", "card op result is malformed");
  return { state: "done", message: out.message, signature: out.signature };
}

/** Current state of a submitted run (raw RPC `tx`, wait_until NONE). An unreachable RPC reads as still pending. */
export async function checkCardRun(env: Env, tx: string): Promise<RunState> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: "dibs", method: "tx", params: { tx_hash: tx, sender_account_id: env.RELAYER_ACCOUNT_ID, wait_until: "NONE" } });
  for (const url of rpcUrls(env)) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      if (!r.ok) continue;
      const j = (await r.json()) as { result?: unknown; error?: { cause?: { name?: string } } };
      if (j.error) {
        if (j.error.cause?.name === "UNKNOWN_TRANSACTION") return { state: "pending" };
        continue;
      }
      return interpretRun(j.result);
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
  }
  return { state: "pending" };
}
