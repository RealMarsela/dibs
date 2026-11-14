import { Account, FailoverRpcProvider, JsonRpcProvider, KeyPairSigner } from "near-api-js";
import type { Provider } from "near-api-js";
import { ApiError } from "./errors";
import { type Env, rpcUrls } from "./env";

let cached: { key: string; p: Provider } | undefined;

export function provider(env: Env): Provider {
  const urls = rpcUrls(env);
  const key = urls.join(",");
  if (cached?.key === key) return cached.p;
  const list = urls.map((url) => new JsonRpcProvider({ url }));
  const p: Provider = list.length === 1 ? list[0] : new FailoverRpcProvider(list);
  cached = { key, p };
  return p;
}

export function relayerAccount(env: Env): Account {
  if (!env.RELAYER_PRIVATE_KEY) throw new ApiError(503, "E_RELAYER_UNCONFIGURED", "relayer key not configured");
  const signer = KeyPairSigner.fromSecretKey(env.RELAYER_PRIVATE_KEY as `ed25519:${string}`);
  return new Account(env.RELAYER_ACCOUNT_ID, provider(env), signer);
}

/**
 * View call over raw JSON-RPC (so a contract panic is told apart from a dead RPC; the failover provider hides the cause).
 * Returns undefined when the contract returns null/empty or panics E_NO_TRIP (an unknown trip).
 */
export async function view<T>(env: Env, contractId: string, method: string, args: Record<string, unknown>): Promise<T | undefined> {
  const body = JSON.stringify({
    jsonrpc: "2.0", id: "dibs", method: "query",
    params: { request_type: "call_function", finality: "optimistic", account_id: contractId, method_name: method, args_base64: btoa(unescape(encodeURIComponent(JSON.stringify(args)))) },
  });
  for (const url of rpcUrls(env)) {
    let j: { result?: { result?: number[]; error?: string }; error?: { cause?: { name?: string }; data?: unknown } };
    try {
      j = (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })).json()) as typeof j;
    } catch {
      continue;
    }
    if (j.result?.error) {
      if (/E_NO_TRIP/.test(j.result.error)) return undefined;
      throw new ApiError(502, "E_RPC", "NEAR RPC view call failed");
    }
    if (j.result?.result) {
      const text = new TextDecoder().decode(Uint8Array.from(j.result.result));
      return text ? ((JSON.parse(text) as T | null) ?? undefined) : undefined;
    }
    if (j.error?.cause?.name === "UNKNOWN_ACCOUNT") throw new ApiError(404, "E_ACCOUNT_NOT_FOUND", `account ${contractId} does not exist`);
  }
  throw new ApiError(502, "E_RPC", "NEAR RPC view call failed");
}

export async function accountExists(env: Env, accountId: string): Promise<boolean> {
  for (const url of rpcUrls(env)) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "dibs", method: "query", params: { request_type: "view_account", finality: "optimistic", account_id: accountId } }),
      });
      const j = (await r.json()) as { result?: unknown; error?: { cause?: { name?: string } } };
      if (j.result) return true;
      if (j.error?.cause?.name === "UNKNOWN_ACCOUNT") return false;
    } catch {
      /* try the next RPC */
    }
  }
  throw new ApiError(502, "E_RPC", "NEAR RPC account lookup failed");
}

export interface TripView {
  price: string;
  n_beds: number;
  [k: string]: unknown;
}

export async function getTrip(env: Env, trip: string): Promise<TripView | undefined> {
  return view<TripView>(env, env.DIBS_CONTRACT, "get_trip", { trip });
}

export async function ftBalance(env: Env, accountId: string): Promise<bigint> {
  const r = await view<string>(env, env.USDC_CONTRACT, "ft_balance_of", { account_id: accountId });
  return BigInt(r ?? "0");
}

export async function isStorageRegistered(env: Env, accountId: string): Promise<boolean> {
  const r = await view<unknown>(env, env.USDC_CONTRACT, "storage_balance_of", { account_id: accountId });
  return r != null;
}

/** Spendable-ish balance of an account in yoctoNEAR (the `amount` field). */
export async function nearBalance(env: Env, accountId: string): Promise<bigint> {
  try {
    return (await provider(env).viewAccount({ accountId })).amount;
  } catch {
    throw new ApiError(502, "E_RPC", "NEAR RPC account lookup failed");
  }
}
