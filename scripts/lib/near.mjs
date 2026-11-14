// Minimal read-only NEAR testnet RPC client (node:* + fetch only).
const RPCS = [
  'https://rpc.testnet.fastnear.com',
  'https://near-testnet.drpc.org',
  'https://test.rpc.fastnear.com',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function b58ToHex(s) {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(ALPHA.indexOf(c));
  return n.toString(16).padStart(64, '0');
}

async function post(url, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 429 && attempt < 3) {
      await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.json();
  }
  throw new Error(`rate limited by ${url}`);
}

export async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const out = await post(url, { jsonrpc: '2.0', id: 'v', method, params });
      if (out.error) {
        // a real answer from the node (e.g. unknown tx), not a transport problem
        if (out.error.cause?.name !== 'UNKNOWN_TRANSACTION' && out.error.name === 'HANDLER_ERROR') return out;
        last = new Error(JSON.stringify(out.error).slice(0, 200));
        continue;
      }
      return out;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

export async function viewAccount(account) {
  const out = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: account });
  if (out.error) throw new Error(`view_account ${account}: ${JSON.stringify(out.error.cause ?? out.error).slice(0, 160)}`);
  return out.result;
}

export async function view(account, method, args = {}) {
  const out = await rpc('query', {
    request_type: 'call_function', finality: 'final', account_id: account, method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
  });
  if (out.error) throw new Error(`${method}: ${JSON.stringify(out.error.cause ?? out.error).slice(0, 160)}`);
  if (out.result.error) throw new Error(`${method}: ${out.result.error.slice(0, 160)}`);
  return JSON.parse(Buffer.from(out.result.result).toString());
}

export async function txStatus(hash, sender) {
  const out = await rpc('EXPERIMENTAL_tx_status', { tx_hash: hash, sender_account_id: sender, wait_until: 'FINAL' });
  if (out.error) throw new Error(`tx ${hash}: ${JSON.stringify(out.error.cause ?? out.error).slice(0, 160)}`);
  return out.result;
}

export const txLink = (h) => `https://testnet.nearblocks.io/txns/${h}`;

export async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (res.status === 429 && attempt < 3) { await sleep(1000 * 2 ** attempt); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res.json();
  }
  throw new Error(`rate limited ${url}`);
}
