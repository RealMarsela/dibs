import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";

/* Paying a bed from a NEAR wallet through NEAR Connect, the official connector (HOT, Meteor, MyNearWallet, Intear,
   NEAR Mobile, Ledger). USDC on NEAR needs no swap: the wallet sends it straight to the bed's own keyless account,
   whose code forwards it to the crew DAO. The connector is loaded only when a friend picks this route. */

export const NEAR_USDC = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const RPC = "https://rpc.mainnet.fastnear.com";

let connector: Promise<NearConnector> | null = null;
function get(): Promise<NearConnector> {
  connector ??= import("@hot-labs/near-connect").then(({ NearConnector }) => new NearConnector({ network: "mainnet" }));
  return connector;
}

export interface NearSession {
  accountId: string;
  wallet: string;
}

export async function connectNear(): Promise<NearSession> {
  const c = await get();
  const w = await c.connect();
  const [a] = await w.getAccounts({ network: "mainnet" });
  if (!a?.accountId) throw new Error("The wallet did not share an account.");
  return { accountId: a.accountId, wallet: w.manifest.name };
}

async function wallet(): Promise<NearWalletBase> {
  return (await get()).wallet();
}

export async function nearUsdcBalance(accountId: string): Promise<bigint> {
  const args = btoa(JSON.stringify({ account_id: accountId }));
  const r = (await (
    await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "dibs", method: "query", params: { request_type: "call_function", finality: "final", account_id: NEAR_USDC, method_name: "ft_balance_of", args_base64: args } }),
    })
  ).json()) as { result?: { result?: number[] } };
  const bytes = r.result?.result;
  return bytes ? BigInt(JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes))) as string) : 0n;
}

/** ft_transfer of exactly `amount` USDC (6 decimals) into the bed's account. Returns the NEAR transaction hash. */
export async function payBedFromNear(bed: string, amount: string): Promise<string> {
  const out = await (await wallet()).signAndSendTransaction({
    network: "mainnet",
    receiverId: NEAR_USDC,
    actions: [{ type: "FunctionCall", params: { methodName: "ft_transfer", args: { receiver_id: bed, amount, memo: "Dibs bed" }, gas: "30000000000000", deposit: "1" } }],
  });
  const hash = (out as { transaction?: { hash?: string } })?.transaction?.hash;
  if (!hash) throw new Error("The wallet did not return a transaction.");
  return hash;
}

export async function disconnectNear(): Promise<void> {
  try {
    await (await get()).disconnect();
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
