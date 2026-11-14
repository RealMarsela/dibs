// Cross-language check: sealed boxes made by libsodium (PyNaCl) and by the Rust verifier open in TypeScript.
// Run: node --test outlayer/card-compat/card.test.ts   (Node 24 strips types natively)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openCard, openSealed, seedOf, x25519, groupPan } from "../../apps/web/src/live/card.ts";

const g = JSON.parse(readFileSync(new URL("../verifier/tests/fixtures/card-golden.json", import.meta.url), "utf8"));
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
function base58(bytes: Uint8Array): string {
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let out = "";
  for (; n > 0n; n /= 58n) out = B58[Number(n % 58n)] + out;
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}
// the secret exactly as DeviceKey.secret() in apps/web/src/live/passkey.ts formats it
const nearSecret = "ed25519:" + base58(new Uint8Array([...hex(g.ed25519_seed_hex), ...hex(g.ed25519_public_hex)]));

test("RFC 7748 X25519 vector", () => {
  const k = hex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4");
  const u = hex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c");
  assert.equal(Buffer.from(x25519(k, u)).toString("hex"), "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552");
});

test("libsodium (PyNaCl) sealed box opens in TypeScript, from the near-api-js secret string", () => {
  const card = openCard(g.libsodium_sealed_hex, nearSecret);
  assert.deepEqual(card, { pan: "4111111111110165", cvv: "123", exp: "11/2031" });
  assert.equal(groupPan(card.pan), "4111 1111 1111 0165");
});

test("the Rust verifier's sealed box opens in TypeScript", () => {
  assert.deepEqual(openCard(g.rust_sealed_hex, g.ed25519_seed_hex), { pan: "4111111111110165", cvv: "123", exp: "11/2031" });
});

test("seed parsing agrees across formats", () => {
  assert.deepEqual(seedOf(nearSecret), hex(g.ed25519_seed_hex));
});

test("wrong key and tampered box are refused", () => {
  assert.throws(() => openCard(g.rust_sealed_hex, "08".repeat(32)), /not sealed to your key/);
  const flipped = hex(g.rust_sealed_hex);
  flipped[flipped.length - 1] ^= 1;
  assert.throws(() => openSealed(flipped, hex(g.ed25519_seed_hex)), /not sealed to your key/);
  assert.throws(() => openSealed(new Uint8Array(10), hex(g.ed25519_seed_hex)), /too short/);
});
