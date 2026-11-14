// Minimal read-only NEAR mainnet RPC client for the mainnet checks in verify.mjs (node:* + fetch only).
const RPCS = ['https://free.rpc.fastnear.com', 'https://rpc.mainnet.fastnear.com', 'https://near.drpc.org'];

async function rpc(params) {
  let last;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'v', method: 'query', params }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const out = await res.json();
      if (out.result) return out.result;
      last = new Error(JSON.stringify(out.error ?? out).slice(0, 200));
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export const mainnetAccount = (account_id) => rpc({ request_type: 'view_account', finality: 'final', account_id });

export async function mainnetView(account_id, method_name, args = {}) {
  const r = await rpc({ request_type: 'call_function', finality: 'final', account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  return JSON.parse(Buffer.from(r.result).toString());
}

export const mainnetLink = (h) => `https://nearblocks.io/txns/${h}`;
