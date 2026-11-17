#!/usr/bin/env node
// One-off, idempotent: index trips that existed before the "My trips" index (acct/<account>/<code> in the NAMES KV).
// Reads every app trip (KV trip/*) plus the seeded examples from the chain and writes booker, bed and waitlist roles.
//   cd services/api && node scripts/backfill-my-trips.mjs [--dry]       (needs CLOUDFLARE_API_TOKEN in the env)
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NETS = {
  testnet: { rpc: "https://near-testnet.drpc.org", contract: "dibs-0eb9ae.testnet", samples: ["lis0312", "lis0314", "sin1025", "drw0001"] },
  mainnet: { rpc: "https://near.drpc.org", contract: "dibsapp.near", samples: ["lismain", "lismain2"] },
};
const dry = process.argv.includes("--dry");
const wrangler = (args) => execFileSync("npx", ["wrangler", ...args, "--remote"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

async function getTrip(net, code) {
  const body = { jsonrpc: "2.0", id: "dibs", method: "query", params: { request_type: "call_function", finality: "final", account_id: NETS[net].contract, method_name: "get_trip", args_base64: Buffer.from(JSON.stringify({ trip: code })).toString("base64") } };
  const r = await (await fetch(NETS[net].rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
  return r.result?.result ? JSON.parse(Buffer.from(r.result.result).toString()) : null;
}

const appTrips = JSON.parse(wrangler(["kv", "key", "list", "--binding", "NAMES", "--prefix", "trip/"])).map((k) => k.name.slice(5));
const work = [...new Set([...appTrips, ...NETS.testnet.samples])].map((c) => ["testnet", c]).concat(NETS.mainnet.samples.map((c) => ["mainnet", c]));
const entries = new Map(); // key -> entry
const at = new Date().toISOString();
const add = (account, code, network, ref) => {
  if (!account) return;
  const key = `acct/${account.toLowerCase()}/${code}`;
  const e = entries.get(key) ?? { network, at, roles: [] };
  if (!e.roles.some((r) => r.role === ref.role && (r.n ?? 0) === (ref.n ?? 0))) e.roles.push(ref);
  entries.set(key, e);
};
for (const [net, code] of work) {
  const t = await getTrip(net, code);
  if (!t) continue;
  add(t.booker, code, net, { role: "booker" });
  t.beds.forEach((b, i) => b.holder && add(b.holder, code, net, { role: "bed", n: i + 1 }));
  (t.wait_res ?? []).forEach((w, i) => w && add(w, code, net, { role: "waitlist", n: i + 1 }));
  (t.waitlist ?? []).forEach((w) => add(w.buyer, code, net, { role: "waitlist", n: w.slot }));
}
const bulk = [...entries].map(([key, e]) => {
  const v = { role: e.roles[0].role, ...(e.roles[0].n ? { n: e.roles[0].n } : {}), network: e.network, at: e.at, roles: e.roles };
  return { key, value: JSON.stringify(v), metadata: v };
});
console.log(`${work.length} trips read, ${bulk.length} index entries`);
if (!dry && bulk.length) {
  const file = join(mkdtempSync(join(tmpdir(), "dibs-backfill-")), "bulk.json");
  writeFileSync(file, JSON.stringify(bulk));
  wrangler(["kv", "bulk", "put", file, "--binding", "NAMES"]);
  console.log("written");
}
