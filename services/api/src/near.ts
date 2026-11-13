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

/** View call. Returns undefined when the contract returns null/empty. */
export async function view<T>(env: Env, contractId: string, method: string, args: Record<string, unknown>): Promise<T | undefined> {
  try {
    const r = (await provider(env).callFunction<any>({ contractId, method, args })) as T | null | undefined;
    return r ?? undefined;
  } catch (e) {
    if (isMissingAccount(e)) throw new ApiError(404, "E_ACCOUNT_NOT_FOUND", `account ${contractId} does not exist`);
    throw new ApiError(502, "E_RPC", "NEAR RPC view call failed");
  }
}

function isMissingAccount(e: unknown): boolean {
  const s = String((e as { type?: string; message?: string })?.type ?? "") + String((e as Error)?.message ?? "");
  return /AccountDoesNotExist|does not exist while viewing/i.test(s);
}

export async function accountExists(env: Env, accountId: string): Promise<boolean> {
  try {
    await provider(env).viewAccount({ accountId });
    return true;
  } catch (e) {
    if (isMissingAccount(e)) return false;
    throw new ApiError(502, "E_RPC", "NEAR RPC account lookup failed");
  }
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
