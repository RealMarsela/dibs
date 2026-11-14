import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";

/* Paying a bed from a NEAR wallet through NEAR Connect, the official connector (HOT, Meteor, MyNearWallet, Intear,
   NEAR Mobile, Ledger). USDC on NEAR needs no swap: the wallet sends it straight to the bed's own keyless account,
   whose code forwards it to the crew DAO. The connector is loaded only when a friend picks this route. */

export type NearNet = "mainnet" | "testnet";
/* Mainnet: native USDC. Testnet: the trip contract's test USDC, whose open `mint` lets a wallet fund itself first. */
export const NEAR_USDC: Record<NearNet, string> = { mainnet: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", testnet: "usdc.own-0eb9ae.testnet" };
const RPC: Record<NearNet, string> = { mainnet: "https://rpc.mainnet.fastnear.com", testnet: "https://rpc.testnet.fastnear.com" };

const connectors: Partial<Record<NearNet, Promise<NearConnector>>> = {};
function get(net: NearNet): Promise<NearConnector> {
  connectors[net] ??= import("@hot-labs/near-connect").then(({ NearConnector }) => new NearConnector({ network: net }));
  return connectors[net]!;
}

export interface NearSession {
  accountId: string;
  wallet: string;
}

export async function connectNear(net: NearNet): Promise<NearSession> {
  const c = await get(net);
  const w = await c.connect();
  const [a] = await w.getAccounts({ network: net });
  if (!a?.accountId) throw new Error("The wallet did not share an account.");
  return { accountId: a.accountId, wallet: w.manifest.name };
}

async function wallet(net: NearNet): Promise<NearWalletBase> {
  return (await get(net)).wallet();
}

export async function nearUsdcBalance(net: NearNet, accountId: string): Promise<bigint> {
  const args = btoa(JSON.stringify({ account_id: accountId }));
  const r = (await (
    await fetch(RPC[net], {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "dibs", method: "query", params: { request_type: "call_function", finality: "final", account_id: NEAR_USDC[net], method_name: "ft_balance_of", args_base64: args } }),
    })
  ).json()) as { result?: { result?: number[] } };
  const bytes = r.result?.result;
  return bytes ? BigInt(JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes))) as string) : 0n;
}

const call = (methodName: string, args: object, deposit: string) => ({ type: "FunctionCall" as const, params: { methodName, args, gas: "30000000000000", deposit } });

/** ft_transfer of exactly `amount` USDC (6 decimals) into the bed's account. On testnet, `mintFirst` adds the test
    token's open mint to the friend's own account in the same transaction. Returns the NEAR transaction hash. */
export async function payBedFromNear(net: NearNet, s: NearSession, bed: string, amount: string, mintFirst = false): Promise<string> {
  const transfer = call("ft_transfer", { receiver_id: bed, amount, memo: "Dibs bed" }, "1");
  const out = await (await wallet(net)).signAndSendTransaction({
    network: net,
    signerId: s.accountId,
    receiverId: NEAR_USDC[net],
    actions: mintFirst ? [call("mint", { account_id: s.accountId, amount }, "0"), transfer] : [transfer],
  });
  const hash = (out as { transaction?: { hash?: string } })?.transaction?.hash;
  if (!hash) throw new Error("The wallet did not return a transaction.");
  return hash;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fromBase58(s: string): Uint8Array | null {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n % 256n));
    n /= 256n;
  }
  for (const ch of s) {
    if (ch !== "1") break;
    out.unshift(0);
  }
  return Uint8Array.from(out);
}
function fromBase64(s: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
/** Wallets return the NEP-413 signature as base64 (the spec) or base58; the API checks 64 bytes as padded base64. */
function signatureBase64(sig: string): string {
  const raw = [fromBase64(sig), fromBase58(sig)].find((b) => b?.length === 64);
  if (!raw) throw new Error("The wallet returned a signature Dibs cannot read.");
  return btoa(String.fromCharCode(...raw));
}

export interface Nep413Proof {
  accountId: string;
  publicKey: string;
  signature: string;
  nonce: string;
  message: string;
}

/** NEP-413 signMessage: proves the friend controls the account, bound to Dibs (recipient) and a one-time server nonce. */
export async function signInNear(net: NearNet, s: NearSession, message: string, recipient: string, nonceHex: string): Promise<Nep413Proof> {
  const nonce = Uint8Array.from(nonceHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const out = await (await wallet(net)).signMessage({ message, recipient, nonce, network: net, signerId: s.accountId });
  if (out.accountId !== s.accountId) throw new Error(`The wallet signed as ${out.accountId}, not ${s.accountId}.`);
  return { accountId: out.accountId, publicKey: out.publicKey.startsWith("ed25519:") ? out.publicKey : `ed25519:${out.publicKey}`, signature: signatureBase64(out.signature), nonce: nonceHex, message };
}

export async function disconnectNear(net: NearNet): Promise<void> {
  try {
    await (await get(net)).disconnect();
  } catch {
    /* already signed out */
  }
}

export function nearError(e: unknown, wallet: string): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (/reject|cancel|denied|closed/i.test(m)) return `You cancelled in ${wallet}. Nothing was sent.`;
  if (/not enough balance|NotEnoughBalance|LackBalanceForState/i.test(m)) return `${wallet} needs a little NEAR for the network fee.`;
  return m.length > 160 ? `${wallet} could not send it: ${m.slice(0, 157)}…` : m;
}
