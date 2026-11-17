import { actions, baseEncode, encodeTransaction, type Account } from "near-api-js";
import { sha256 } from "@noble/hashes/sha2";
import { type Env, rpcUrls } from "./env";

/* Send a relayer transaction without asking the RPC to hold the connection until it executes. Public testnet RPCs fail
   that long wait for multi-receipt calls (create_trip: 26 receipts done in 3 blocks, answered after 90 s of 500s and
   429 backoff). So: sign, broadcast with wait_until INCLUDED, then poll `tx` (wait_until NONE) once a second until the
   transaction has executed. Returns the same JSON the RPC returns for a waited send, so callers read it unchanged. */

/** OutLayer answers these through a yielded callback, which can take minutes when its queue is busy. */
const SLOW = new Set(["request_draw", "submit_proof", "request_execution"]);
const POLL_MS = 1000;

type Rpc = { result?: Record<string, unknown>; error?: { name?: string; cause?: { name?: string; info?: unknown }; data?: unknown; message?: string } };

async function rpc(url: string, method: string, params: unknown): Promise<Rpc> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "dibs", method, params }) });
  if (!r.ok) return { error: { message: `HTTP ${r.status}` } };
  return (await r.json()) as Rpc;
}
const nonceError = (e: Rpc["error"]) => /InvalidNonce/.test(JSON.stringify(e ?? {}));
const done = (res: Record<string, unknown>) => {
  const st = res.status as Record<string, unknown> | string | undefined;
  return !!st && typeof st === "object" && ("SuccessValue" in st || "SuccessReceiptId" in st || "Failure" in st) && !!res.receipts_outcome;
};

/** Broadcast once (failing over across RPCs); true when some RPC accepted it. Throws on an invalid nonce so the caller re-signs. */
async function broadcast(env: Env, b64: string): Promise<boolean> {
  for (const url of rpcUrls(env)) {
    const r = await rpc(url, "send_tx", { signed_tx_base64: b64, wait_until: "INCLUDED" }).catch(() => ({ error: { message: "network" } }) as Rpc);
    if (r.result) return true;
    if (nonceError(r.error)) throw new Error("InvalidNonce");
  }
  return false;
}

async function poll(env: Env, hash: string, sender: string, maxMs: number): Promise<Record<string, unknown>> {
  const urls = rpcUrls(env);
  const until = Date.now() + maxMs;
  for (let i = 0; Date.now() < until; i++) {
    const r = await rpc(urls[i % urls.length], "tx", { tx_hash: hash, sender_account_id: sender, wait_until: "NONE" }).catch(() => ({}) as Rpc);
    if (r.result && done(r.result)) return r.result;
    await new Promise((ok) => setTimeout(ok, POLL_MS));
  }
  throw new Error(`transaction ${hash} did not finish within ${Math.round(maxMs / 1000)} s`);
}

type Action = ReturnType<typeof actions.transfer>;

export async function signAndPoll(env: Env, acct: Account, receiverId: string, list: Action[], maxMs: number): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const signed = await acct.createSignedTransaction({ receiverId, actions: list });
    const hash = baseEncode(sha256(encodeTransaction(signed.transaction)));
    const bytes = signed.encode();
    let b64 = "";
    for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    try {
      if (!(await broadcast(env, btoa(b64)))) throw new Error("no RPC accepted the transaction");
    } catch (e) {
      if (e instanceof Error && e.message === "InvalidNonce") continue;
      throw e;
    }
    const res = await poll(env, hash, acct.accountId, maxMs);
    const st = res.status as Record<string, unknown>;
    if ("Failure" in st) throw Object.assign(new Error("transaction failed on chain"), { outcome: res });
    return res;
  }
  throw new Error("could not get a fresh nonce for the relayer");
}

/** Patch a relayer Account so callFunctionRaw and transfer go through signAndPoll. */
type Call = { contractId: string; methodName: string; args: object; gas?: bigint | string | number; deposit?: bigint | string | number };
export function fastSends(env: Env, acct: Account): Account {
  const a = acct as unknown as { callFunctionRaw: (p: Call) => Promise<unknown>; transfer: (p: { receiverId: string; amount: bigint | string | number }) => Promise<unknown> };
  a.callFunctionRaw = (p) =>
    signAndPoll(env, acct, p.contractId, [actions.functionCall(p.methodName, p.args, BigInt(p.gas ?? 30_000_000_000_000n), BigInt(p.deposit ?? 0n))], SLOW.has(p.methodName) ? 300_000 : 90_000);
  a.transfer = (p) => signAndPoll(env, acct, p.receiverId, [actions.transfer(BigInt(p.amount))], 90_000);
  // Gasless relays (list_for_resale, release, names) wrap the user's signed delegate in a relayer transaction.
  (acct as unknown as { relayMetaTransaction: (sd: Parameters<typeof actions.signedDelegate>[0]) => Promise<unknown> }).relayMetaTransaction = (sd) =>
    signAndPoll(env, acct, sd.delegateAction.senderId, [actions.signedDelegate(sd)], 90_000);
  return acct;
}
