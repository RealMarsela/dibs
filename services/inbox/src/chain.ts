import { Account, FailoverRpcProvider, JsonRpcProvider, KeyPairSigner } from "near-api-js";
import type { Provider } from "near-api-js";
import type { Env } from "./env";

export interface TripView {
  book_by: string;
  beds: { status: string }[];
  proof: unknown | null;
  proof_pending?: unknown;
  [k: string]: unknown;
}

function provider(env: Env): Provider {
  const list = env.NEAR_RPC_URLS.split(",").map((s) => new JsonRpcProvider({ url: s.trim() }));
  return list.length === 1 ? list[0] : new FailoverRpcProvider(list);
}

/** undefined = no such trip; throws only when the RPC itself failed. */
export async function getTrip(env: Env, trip: string): Promise<TripView | undefined> {
  const r = (await provider(env).callFunction<any>({ contractId: env.DIBS_CONTRACT, method: "get_trip", args: { trip } })) as TripView | null;
  return r ?? undefined;
}

/** Why the proof cannot be submitted yet, or undefined when it can. */
export function notReady(t: TripView, nowMs: number): string | undefined {
  if (t.proof) return "proof already accepted";
  if (t.proof_pending) return "proof already pending";
  if (!t.beds.length || t.beds.some((b) => b.status !== "Paid")) return "not every bed is paid yet";
  if (BigInt(nowMs) * 1_000_000n >= BigInt(t.book_by)) return "booking deadline passed";
  return undefined;
}

const GAS = 300_000_000_000_000n;
const DEPOSIT = 25_000_000_000_000_000_000_000n; // 0.025 NEAR; the contract needs >= 0.02, the rest comes back

export async function submitProof(env: Env, trip: string, blobUrl: string, blobSha256: string): Promise<string> {
  if (!env.RELAYER_PRIVATE_KEY) throw new Error("relayer key not configured");
  const signer = KeyPairSigner.fromSecretKey(env.RELAYER_PRIVATE_KEY as `ed25519:${string}`);
  const acct = new Account(env.RELAYER_ACCOUNT_ID, provider(env), signer);
  const res = await acct.callFunctionRaw({
    contractId: env.DIBS_CONTRACT,
    methodName: "submit_proof",
    args: { trip, blob_url: blobUrl, blob_sha256: blobSha256 },
    gas: GAS,
    deposit: DEPOSIT,
    waitUntil: "EXECUTED_OPTIMISTIC",
  });
  return (res as { transaction?: { hash?: string } }).transaction?.hash ?? "";
}
