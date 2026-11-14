#!/usr/bin/env node
// Read-only judge check of the live Dibs testnet deployment. Node 20+, no dependencies.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { b58ToHex, view, viewAccount, txStatus, txLink, getJson } from './lib/near.mjs';
import { mainnetAccount, mainnetView, mainnetLink } from './lib/mainnet.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'deploy/testnet.json'), 'utf8'));
const DIBS = cfg.dibs, USDC = cfg.usdc, API = cfg.api_url;

// Recorded live transactions (all sent by the relayer account, testnet).
const TX = {
  proofSin1025: '54g9Y2qgKPNFamFeN6tQUgpR1AqU322F1J184LB8mYKr',
  drawLis0312: '3RDs4qUK27Jfthi1NhNz7hsoYJtmh5N6j5o1BtjQfBSV',
  refundRefused: 'J6aDm4oGLZmdghs1ewZ5ttMXpY9Q6qUCm7ZHZN9jnRrR',
};
const SENDER = cfg.relayer;

const rows = [];
const link = (h) => txLink(h);
async function check(name, fn) {
  try {
    const evidence = await fn();
    rows.push({ ok: true, name, evidence });
  } catch (e) {
    rows.push({ ok: false, name, evidence: e.message });
  }
}
function must(cond, msg) { if (!cond) throw new Error(msg); }
const decodeArgs = (b64) => JSON.parse(Buffer.from(b64, 'base64').toString());
function firstCall(tx) {
  const a = tx.transaction.actions.find((x) => x.FunctionCall)?.FunctionCall;
  return a ? { method: a.method_name, args: decodeArgs(a.args) } : null;
}
function failures(tx) {
  return tx.receipts_outcome.filter((o) => o.outcome.status.Failure).map((o) => JSON.stringify(o.outcome.status.Failure));
}

const trips = {};
await check('a. contract exists with the pinned code hash', async () => {
  const acc = await viewAccount(DIBS);
  const hex = b58ToHex(acc.code_hash);
  must(hex === cfg.dibs_wasm_sha256, `code hash ${hex} != ${cfg.dibs_wasm_sha256}`);
  return `${DIBS} sha256 ${hex.slice(0, 16)}... matches deploy/testnet.json`;
});

for (const [code, t] of Object.entries(cfg.trips)) {
  await check(`b. get_trip ${code}: beds, waitlist, dao`, async () => {
    const tr = await view(DIBS, 'get_trip', { trip: code });
    trips[code] = tr;
    must(tr.beds.length === t.n_beds, `beds ${tr.beds.length} != ${t.n_beds}`);
    must(tr.dao === t.dao, `dao ${tr.dao}`);
    must(tr.n_wait === t.n_wait, `n_wait ${tr.n_wait}`);
    const paid = tr.beds.filter((b) => b.status === 'Paid').length;
    return `${tr.beds.length} beds (${paid} Paid), waitlist ${tr.waitlist.length}/${tr.n_wait}, dao ${tr.dao}`;
  });
}

await check('c1. sin1025 proof: booking.com, dates, guests', async () => {
  const p = trips.sin1025?.proof;
  must(p, 'no proof stored');
  must(p.dkim_domain === 'booking.com', `dkim_domain ${p.dkim_domain}`);
  must(p.check_in === cfg.trips.sin1025.check_in && p.check_out === cfg.trips.sin1025.check_out, 'dates differ');
  must(p.guests === cfg.trips.sin1025.n_beds, `guests ${p.guests}`);
  return `dkim ${p.dkim_domain}, ${p.check_in}..${p.check_out}, ${p.guests} guests, total ${p.total} ${p.currency}`;
});
await check('c2. sin1025 payout Done (proof tx accepted)', async () => {
  must(trips.sin1025?.payout === 'Done', `payout ${trips.sin1025?.payout}`);
  const tx = await txStatus(TX.proofSin1025, SENDER);
  const call = firstCall(tx);
  must(call?.method === 'submit_proof' && call.args.trip === 'sin1025', 'tx is not submit_proof sin1025');
  must(!tx.status.Failure, 'tx failed');
  return `payout Done; submit_proof ${link(TX.proofSin1025)}`;
});
await check('c3. sin1025 USDC moved: DAO down, booker up', async () => {
  const tr = trips.sin1025, t = cfg.trips.sin1025;
  const collected = BigInt(t.price) * BigInt(t.n_beds);
  const total = BigInt(tr.proof.total);
  const dao = BigInt(await view(USDC, 'ft_balance_of', { account_id: t.dao }));
  const booker = BigInt(await view(USDC, 'ft_balance_of', { account_id: t.booker }));
  must(dao === collected - total, `DAO ${dao} != collected ${collected} - total ${total}`);
  must(booker >= total, `booker ${booker} < total ${total}`);
  const f = (n) => (Number(n) / 1e6).toFixed(2);
  return `DAO ${f(collected)} -> ${f(dao)} USDC; booker holds ${f(booker)} (>= payout ${f(total)})`;
});

await check('d. lis0312 drawn is a permutation of 1..8', async () => {
  const d = trips.lis0312?.drawn;
  must(Array.isArray(d) && d.length === 8, 'no draw');
  must([...d].sort((a, b) => a - b).join() === '1,2,3,4,5,6,7,8', `not a permutation: ${d}`);
  const tx = await txStatus(TX.drawLis0312, SENDER);
  const call = firstCall(tx);
  must(call?.method === 'request_draw' && call.args.trip === 'lis0312', 'tx is not request_draw lis0312');
  return `drawn [${d}]; request_draw ${link(TX.drawLis0312)}`;
});

await check('e. check_proof refuses a forged signature', async () => {
  const code = await view(DIBS, 'check_proof', { trip: 'sin1025', message: 'dibs-booking:v1:{}', signature: '00'.repeat(64) });
  must(code === 'E_BAD_SIG', `got ${JSON.stringify(code)}`);
  const bad = await view(DIBS, 'check_proof', { trip: 'sin1025', message: 'forged', signature: '00'.repeat(64) });
  must(bad === 'E_BAD_PREFIX', `got ${JSON.stringify(bad)}`);
  return `forged signature -> ${code}; wrong prefix -> ${bad}`;
});

await check('f. request_refund refused on chain (E_NO_REFUND)', async () => {
  const tx = await txStatus(TX.refundRefused, SENDER);
  must(firstCall(tx)?.method === 'request_refund', 'tx is not request_refund');
  const f = failures(tx).join(' ') + JSON.stringify(tx.status);
  must(f.includes('E_NO_REFUND'), 'failure does not contain E_NO_REFUND');
  return `request_refund failed with E_NO_REFUND ${link(TX.refundRefused)}`;
});

await check('g. pinned verifier key equals deploy/testnet.json', async () => {
  const conf = await view(DIBS, 'get_config');
  const hex = b58ToHex(conf.verifier_key);
  must(hex === cfg.verifier_public_key, `${hex} != ${cfg.verifier_public_key}`);
  return `ed25519 ${hex.slice(0, 16)}... (set_verifier_key ${link(cfg.tx.set_verifier_key)})`;
});

await check('h1. API /health', async () => {
  const h = await getJson(`${API}/health`);
  must(h.ok === true && h.contract === DIBS, `unexpected ${JSON.stringify(h)}`);
  return `${API}/health ok, contract ${h.contract}`;
});
await check('h2. API /trip/sin1025', async () => {
  const t = await getJson(`${API}/trip/sin1025`);
  must(t.trip?.payout === 'Done' && t.trip.proof?.dkim_domain === 'booking.com', 'API trip view disagrees with chain');
  return `API serves proof (${t.trip.proof.dkim_domain}) and payout ${t.trip.payout}`;
});
await check('i. card on lis0312: last4 and mcc 7011', async () => {
  const c = await getJson(`${API}/card/lis0312`);
  must(/^\d{4}$/.test(c.last4) && c.mcc === '7011', `unexpected ${c.last4} ${c.mcc}`);
  const sims = c.simulations ?? [];
  const hotel = sims.find((s) => s.mcc === '7011' && s.approved);
  const shop = sims.find((s) => s.mcc === '5732' && !s.approved);
  must(hotel && shop, 'missing hotel-approved / electronics-declined simulation');
  return `last4 ${c.last4}, mcc ${c.mcc}; hotel ${hotel.result}, electronics ${shop.result} (${shop.reason})`;
});

// Mainnet: the same contracts with real USDC (deploy/mainnet.json). Read-only.
const main = JSON.parse(readFileSync(join(root, 'deploy/mainnet.json'), 'utf8'));
await check('m1. mainnet contract runs the pinned wasm', async () => {
  const hex = b58ToHex((await mainnetAccount(main.dibs)).code_hash);
  must(hex === main.dibs_wasm_sha256, `code hash ${hex} != ${main.dibs_wasm_sha256}`);
  return `${main.dibs} sha256 ${hex.slice(0, 16)}... matches deploy/mainnet.json`;
});
await check('m2. mainnet lismain: every bed Paid', async () => {
  const t = await mainnetView(main.dibs, 'get_trip', { trip: 'lismain' });
  const st = t.beds.map((b) => b.status);
  must(st.length === 2 && st.every((s) => s === 'Paid'), `beds ${st.join(',')}`);
  return `2 beds Paid (bed 1 from Base via 1Click, bed 2 USDC on NEAR); sweep ${mainnetLink(main.txs.bed1_sweep_to_dao)}`;
});
await check('m3. mainnet crew DAO holds the real USDC', async () => {
  const dao = main.trips.lismain.dao;
  const bal = BigInt(await mainnetView(main.usdc, 'ft_balance_of', { account_id: dao }));
  must(bal >= 500000n, `${dao} holds ${bal}`);
  return `${dao} holds ${(Number(bal) / 1e6).toFixed(2)} USDC (native USDC on NEAR)`;
});

const w = Math.max(...rows.map((r) => r.name.length));
console.log(`Dibs live verification on NEAR testnet (${DIBS}) and mainnet (${main.dibs})\n`);
for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(w)}  ${r.evidence}`);
const failed = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - failed}/${rows.length} checks passed`);
process.exit(failed ? 1 : 0);
