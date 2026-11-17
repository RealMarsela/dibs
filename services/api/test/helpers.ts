import { vi } from "vitest";
import { KeyPair, KeyPairSigner, actions, buildDelegateAction } from "near-api-js";
import { encodeSignedDelegate } from "near-api-js";
import type { Env } from "../src/env";

export const DIBS = "dibs-x.testnet";
export const USDC = "usdc-x.testnet";

export class FakeR2 {
  store = new Map<string, Uint8Array | string>();
  puts: string[] = [];
  async get(key: string) {
    const v = this.store.get(key);
    if (v === undefined) return null;
    const bytes = typeof v === "string" ? new TextEncoder().encode(v) : v;
    return { json: async () => JSON.parse(new TextDecoder().decode(bytes)), body: new Response(bytes).body, arrayBuffer: async () => bytes.buffer };
  }
  async put(key: string, value: string | Uint8Array, opts?: { onlyIf?: { etagDoesNotMatch?: string } }) {
    if (opts?.onlyIf?.etagDoesNotMatch === "*" && this.store.has(key)) return null;
    this.store.set(key, value);
    this.puts.push(key);
    return {};
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

export class FakeKV {
  store = new Map<string, string>();
  meta = new Map<string, unknown>();
  async get(key: string, type?: string) {
    const v = this.store.get(key);
    if (v === undefined) return null;
    return type === "json" ? JSON.parse(v) : v;
  }
  async put(key: string, value: string, opts?: { metadata?: unknown }) {
    this.store.set(key, value);
    if (opts?.metadata !== undefined) this.meta.set(key, opts.metadata);
  }
  async list(o: { prefix?: string } = {}) {
    const keys = [...this.store.keys()].filter((k) => k.startsWith(o.prefix ?? "")).sort().map((name) => ({ name, metadata: this.meta.get(name) }));
    return { keys, list_complete: true, cursor: undefined };
  }
}

export function makeEnv(over: Partial<Env> = {}): Env {
  return {
    NEAR_NETWORK: "testnet",
    NEAR_RPC_URLS: "https://rpc.invalid",
    ONECLICK_URL: "https://1click.test",
    DIBS_CONTRACT: DIBS,
    USDC_CONTRACT: USDC,
    RELAYER_ACCOUNT_ID: "relayer-x.testnet",
    RELAYER_PRIVATE_KEY: KeyPair.fromRandom("ed25519").toString(),
    DIBS_BLOB_KEY: "00".repeat(31) + "2a",
    BLOBS: new FakeR2() as unknown as R2Bucket,
    NAMES: new FakeKV() as unknown as KVNamespace,
    ...over,
  };
}

export const mainnetEnv = (): Env => makeEnv({ NEAR_NETWORK: "mainnet", DIBS_CONTRACT: "dibs-x.near", USDC_CONTRACT: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1" });

export const json = (path: string, body: unknown, method = "POST") =>
  new Request("http://api.test" + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export async function signedDelegateB64(opts: {
  receiverId: string;
  method: string;
  senderId?: string;
  deposit?: bigint;
  gas?: bigint;
  maxBlockHeight?: bigint;
  tamper?: boolean;
  actionList?: ReturnType<typeof actions.functionCall>[];
}): Promise<string> {
  const kp = KeyPair.fromRandom("ed25519");
  const signer = new KeyPairSigner(kp);
  const da = buildDelegateAction({
    senderId: opts.senderId ?? "06588294c1621ab36859f5dc677612c9e8894ddf82c63305324e948c268f5706",
    receiverId: opts.receiverId,
    actions: opts.actionList ?? [actions.functionCall(opts.method, {}, opts.gas ?? 30_000_000_000_000n, opts.deposit ?? 0n)],
    nonce: 1n,
    maxBlockHeight: opts.maxBlockHeight ?? 10_000_000_000n,
    publicKey: await signer.getPublicKey(),
  });
  const { signedDelegate } = await signer.signDelegateAction(da);
  if (opts.tamper) signedDelegate.delegateAction.nonce = 2n;
  return btoa(String.fromCharCode(...encodeSignedDelegate(signedDelegate)));
}

export const stubFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal("fetch", fn);
  return fn;
};
