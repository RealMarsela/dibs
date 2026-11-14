/* NEAR JSON-RPC from the browser with a fallback list per network. A 429, a 5xx or a network error moves to the next
   endpoint, and the one that answered is tried first next time. Testnet starts on drpc because FastNEAR's free tier
   rate-limits busy IPs. */
export type Net = "mainnet" | "testnet";

export const NEAR_RPCS: Record<Net, string[]> = {
  mainnet: ["https://rpc.mainnet.fastnear.com", "https://free.rpc.fastnear.com", "https://near.drpc.org"],
  testnet: ["https://near-testnet.drpc.org", "https://rpc.testnet.fastnear.com", "https://test.rpc.fastnear.com"],
};

const preferred: Record<Net, number> = { mainnet: 0, testnet: 0 };

export interface RpcReply<T> {
  result?: T;
  error?: { message?: string; cause?: { name?: string } };
}

export async function nearRpc<T>(net: Net, method: string, params: unknown): Promise<RpcReply<T>> {
  const list = NEAR_RPCS[net];
  for (let i = 0; i < list.length; i++) {
    const at = (preferred[net] + i) % list.length;
    try {
      const r = await fetch(list[at], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "dibs", method, params }) });
      if (r.status === 429 || r.status >= 500) continue;
      const j = (await r.json()) as RpcReply<T>;
      preferred[net] = at;
      return j;
    } catch {
      /* next endpoint */
    }
  }
  throw new Error("NEAR RPC is not answering. Try again in a moment.");
}
