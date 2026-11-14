import { blake2b } from "@noble/hashes/blake2.js";
import { sha512 } from "@noble/hashes/sha2.js";

/* Opens the trip's virtual card. The dibs-verifier TEE seals {pan, cvv, exp} to the booker's account key with a
   libsodium crypto_box_seal (see outlayer/verifier/src/seal.rs); only the booker's device key can open it.
   Layout: epk(32) || XSalsa20-Poly1305(mac16 || ct), nonce = blake2b-24(epk || recipient_x25519).
   Self-contained (no new dependencies): X25519, HSalsa20/XSalsa20 and Poly1305 are written out below and are
   checked against a libsodium-made vector in outlayer/card-compat/card.test.ts. */

export interface CardDetails {
  pan: string;
  cvv: string;
  exp: string;
}

const P = (1n << 255n) - 19n;
const mod = (a: bigint) => ((a % P) + P) % P;
const leToBig = (b: Uint8Array) => b.reduceRight((acc, x) => (acc << 8n) | BigInt(x), 0n);
function bigToLe(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++, n >>= 8n) out[i] = Number(n & 0xffn);
  return out;
}
function pow(b: bigint, e: bigint): bigint {
  let r = 1n;
  for (b = mod(b); e > 0n; e >>= 1n, b = mod(b * b)) if (e & 1n) r = mod(r * b);
  return r;
}

/** RFC 7748 X25519 (Montgomery ladder). */
export function x25519(scalar: Uint8Array, u: Uint8Array): Uint8Array {
  const k = Uint8Array.from(scalar);
  k[0] &= 248;
  k[31] &= 127;
  k[31] |= 64;
  const kn = leToBig(k);
  const uc = Uint8Array.from(u);
  uc[31] &= 127;
  const x1 = leToBig(uc);
  let [x2, z2, x3, z3, swap] = [1n, 0n, x1, 1n, 0n];
  for (let t = 254n; t >= 0n; t--) {
    const bit = (kn >> t) & 1n;
    if (swap ^ bit) [x2, x3, z2, z3] = [x3, x2, z3, z2];
    swap = bit;
    const A = mod(x2 + z2), AA = mod(A * A), B = mod(x2 - z2), BB = mod(B * B), E = mod(AA - BB);
    const C = mod(x3 + z3), D = mod(x3 - z3), DA = mod(D * A), CB = mod(C * B);
    x3 = mod((DA + CB) ** 2n);
    z3 = mod(x1 * mod((DA - CB) ** 2n));
    x2 = mod(AA * BB);
    z2 = mod(E * (AA + 121665n * E));
  }
  if (swap) [x2, z2] = [x3, z3];
  return bigToLe(mod(x2 * pow(z2, P - 2n)), 32);
}

const BASE = Uint8Array.from([9, ...new Array(31).fill(0)]);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const rotl = (a: number, n: number) => ((a << n) | (a >>> (32 - n))) >>> 0;
const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

function rounds(x: Uint32Array) {
  const qr = (a: number, b: number, c: number, d: number) => {
    x[b] ^= rotl((x[a] + x[d]) >>> 0, 7);
    x[c] ^= rotl((x[b] + x[a]) >>> 0, 9);
    x[d] ^= rotl((x[c] + x[b]) >>> 0, 13);
    x[a] ^= rotl((x[d] + x[c]) >>> 0, 18);
  };
  for (let i = 0; i < 10; i++) {
    qr(0, 4, 8, 12); qr(5, 9, 13, 1); qr(10, 14, 2, 6); qr(15, 3, 7, 11);
    qr(0, 1, 2, 3); qr(5, 6, 7, 4); qr(10, 11, 8, 9); qr(15, 12, 13, 14);
  }
}

function state(key: Uint8Array, n4: number[]): Uint32Array {
  const s = new Uint32Array(16);
  [s[0], s[5], s[10], s[15]] = SIGMA as [number, number, number, number];
  for (let i = 0; i < 4; i++) {
    s[1 + i] = u32(key, 4 * i);
    s[11 + i] = u32(key, 16 + 4 * i);
    s[6 + i] = n4[i];
  }
  return s;
}

function hsalsa20(key: Uint8Array, nonce16: Uint8Array): Uint8Array {
  const x = state(key, [u32(nonce16, 0), u32(nonce16, 4), u32(nonce16, 8), u32(nonce16, 12)]);
  rounds(x);
  const out = new Uint8Array(32);
  [0, 5, 10, 15, 6, 7, 8, 9].forEach((w, i) => bigToLe(BigInt(x[w]), 4).forEach((b, j) => (out[4 * i + j] = b)));
  return out;
}

/** First `len` bytes of the Salsa20 stream for (key, 8-byte nonce). */
function salsaStream(key: Uint8Array, nonce8: Uint8Array, len: number): Uint8Array {
  const out = new Uint8Array(Math.ceil(len / 64) * 64);
  for (let blk = 0; blk * 64 < len; blk++) {
    const init = state(key, [u32(nonce8, 0), u32(nonce8, 4), blk >>> 0, Math.floor(blk / 2 ** 32)]);
    const x = Uint32Array.from(init);
    rounds(x);
    for (let i = 0; i < 16; i++) out.set(bigToLe(BigInt((x[i] + init[i]) >>> 0), 4), blk * 64 + 4 * i);
  }
  return out.subarray(0, len);
}

function poly1305(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const clamp = 0x0ffffffc0ffffffc0ffffffc0fffffffn;
  const r = leToBig(key.subarray(0, 16)) & clamp;
  const s = leToBig(key.subarray(16, 32));
  const p = (1n << 130n) - 5n;
  let h = 0n;
  for (let i = 0; i < msg.length; i += 16) {
    const blk = msg.subarray(i, i + 16);
    h = ((h + (leToBig(blk) | (1n << BigInt(8 * blk.length)))) * r) % p;
  }
  return bigToLe((h + s) & ((1n << 128n) - 1n), 16);
}

const SEAL_OVERHEAD = 32 + 16;

/** Open a crypto_box_seal made for the account whose ed25519 seed is `ed25519Seed`. Throws if it does not open. */
export function openSealed(sealed: Uint8Array, ed25519Seed: Uint8Array): Uint8Array {
  if (sealed.length < SEAL_OVERHEAD) throw new Error("sealed box too short");
  const sk = sha512(ed25519Seed).subarray(0, 32);
  const pk = x25519(sk, BASE);
  const epk = sealed.subarray(0, 32);
  const nonce = blake2b(new Uint8Array([...epk, ...pk]), { dkLen: 24 });
  const boxKey = hsalsa20(x25519(sk, epk), new Uint8Array(16));
  const subkey = hsalsa20(boxKey, nonce.subarray(0, 16));
  const body = sealed.subarray(32);
  const stream = salsaStream(subkey, nonce.subarray(16), 32 + body.length - 16);
  const tag = poly1305(stream.subarray(0, 32), body.subarray(16));
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= tag[i] ^ body[i];
  if (diff !== 0) throw new Error("this card was not sealed to your key");
  return body.subarray(16).map((b, i) => b ^ stream[32 + i]);
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** The seed of a device key: raw 32 bytes, 64 hex, or the near-api-js secret `DeviceKey.secret()` returns. */
export function seedOf(secret: string | Uint8Array): Uint8Array {
  if (secret instanceof Uint8Array) return secret.subarray(0, 32);
  if (/^[0-9a-f]{64}$/i.test(secret)) return Uint8Array.from(secret.match(/../g)!.map((h) => parseInt(h, 16)));
  let n = 0n;
  for (const c of secret.replace(/^ed25519:/, "")) {
    const d = B58.indexOf(c);
    if (d < 0) throw new Error("bad key");
    n = n * 58n + BigInt(d);
  }
  return bigToLe(n, 64).reverse().subarray(0, 32); // 64 bytes big-endian: seed || public key
}

const hexToBytes = (h: string) => Uint8Array.from((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

/** Decrypt the `sealed_hex` from GET /card/:trip with the booker's device key (`key.secret()`). */
export function openCard(sealedHex: string, secret: string | Uint8Array): CardDetails {
  const plain = openSealed(hexToBytes(sealedHex), seedOf(secret));
  const d = JSON.parse(new TextDecoder().decode(plain)) as Partial<CardDetails>;
  if (!d.pan || !d.cvv || !d.exp) throw new Error("malformed card payload");
  return { pan: d.pan, cvv: d.cvv, exp: d.exp };
}

/** "4111 1111 1111 0165" for display. */
export const groupPan = (pan: string) => pan.replace(/(\d{4})(?=\d)/g, "$1 ");
