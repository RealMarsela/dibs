import { ApiError } from "./errors";
import type { Env } from "./env";
import { NEAR, GAS_300 } from "./calls";
import { relayerAccount } from "./near";

const OUTLAYER = "outlayer.testnet";
const PROJECT = "own-0eb9ae.testnet/dibs-verifier";

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

/** Run op `card` in the TEE. The relayer pays the 0.02 NEAR execution deposit; the unused part is refunded. */
export async function runCardOp(env: Env, trip: string): Promise<{ message: string; signature: string }> {
  const args = {
    source: { Project: { project_id: PROJECT, version_key: null } },
    input_data: JSON.stringify({ op: "card", trip, network: "testnet", contract: env.DIBS_CONTRACT }),
    resource_limits: { max_instructions: 2_000_000_000, max_memory_mb: 128, max_execution_seconds: 60 },
    response_format: "Json",
  };
  let res: unknown;
  try {
    res = await relayerAccount(env).callFunctionRaw({ contractId: OUTLAYER, methodName: "request_execution", args, gas: GAS_300, deposit: (NEAR * 20n) / 1000n, waitUntil: "FINAL" });
  } catch {
    throw new ApiError(502, "E_OUTLAYER_FAILED", "could not run the card op on OutLayer");
  }
  const out = decodeResult(res);
  if (typeof out.error === "string" || typeof out.code === "string") {
    const code = String(out.code ?? "E_ISSUER");
    throw new ApiError(REFUSAL_STATUS[code] ?? 502, code, String(out.error ?? "card issuance refused"));
  }
  if (typeof out.message !== "string" || typeof out.signature !== "string") throw new ApiError(502, "E_OUTLAYER_FAILED", "card op result is malformed");
  return { message: out.message, signature: out.signature };
}
