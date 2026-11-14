// Live check of POST /trips: node scripts/live-create-trip.mjs [api-base]
// Generates a throwaway ed25519 key, creates a 2-bed trip, then reads get_trip over RPC.
import { KeyPair } from "near-api-js";
const API = process.argv[2] ?? "https://api.dibs.larinova.com";
const RPC = "https://test.rpc.fastnear.com";
const kp = KeyPair.fromRandom("ed25519");
const pk = kp.getPublicKey().toString().replace("ed25519:", "");
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
// base58 decode of the public key to hex
let num = 0n;
for (const ch of pk) num = num * 58n + BigInt(alphabet.indexOf(ch));
const booker = num.toString(16).padStart(64, "0");
const day = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const res = await fetch(`${API}/trips`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ place: "Porto", stay: "Ribeira river flat", check_in: day(40), check_out: day(43), beds: 2, price_usdc: 3, booker }),
});
const out = await res.json();
console.log(res.status, JSON.stringify(out), "booker", booker);
if (!res.ok) process.exit(1);
await new Promise((r) => setTimeout(r, 3000));
const q = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final", account_id: "dibs-0eb9ae.testnet", method_name: "get_trip", args_base64: Buffer.from(JSON.stringify({ trip: out.code })).toString("base64") } }) }).then((r) => r.json());
const trip = JSON.parse(Buffer.from(q.result.result).toString());
console.log("bed1", JSON.stringify(trip.beds[0]), "dao", trip.dao, "booker", trip.booker === booker);
const meta = await fetch(`${API}/trips/${out.code}/meta`).then((r) => r.json());
console.log("meta", JSON.stringify(meta));
