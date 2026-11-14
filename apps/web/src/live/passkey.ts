import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/* A friend's NEAR key, held by their phone. The WebAuthn PRF extension turns the passkey into 32 stable bytes;
   those seed an ed25519 key whose hex public key is the friend's implicit NEAR account. No wallet, no seed phrase.
   Where PRF is missing (older browsers), a random device key is kept in this browser instead, and the UI says so. */
ed.hashes.sha512 = sha512;

const SALT = new TextEncoder().encode("dibs:bed-key:v1");
const CRED = "dibs.passkey.id";
const FALLBACK = "dibs.device.seed";

export interface DeviceKey {
  accountId: string;
  publicKey: Uint8Array;
  sign: (msg: Uint8Array) => Promise<Uint8Array>;
  /** The secret in near-api-js form ("ed25519:<base58 64 bytes>"). Kept in memory only. */
  secret: () => string;
  kind: "passkey" | "device";
}

function store(k: string, v?: string): string | null {
  try {
    if (v !== undefined) localStorage.setItem(k, v);
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Uint8Array): string {
  let n = BigInt("0x" + (bytesToHex(bytes) || "0"));
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

async function fromSeed(seed: Uint8Array, kind: DeviceKey["kind"]): Promise<DeviceKey> {
  const pub = await ed.getPublicKeyAsync(seed);
  return {
    accountId: bytesToHex(pub),
    publicKey: pub,
    kind,
    sign: (msg) => ed.signAsync(msg, seed),
    secret: () => "ed25519:" + base58(new Uint8Array([...seed, ...pub])),
  };
}

/** A passkey prompt that nobody answers (no authenticator, headless, dismissed) must not freeze the app. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function prfSeed(): Promise<Uint8Array | null> {
  if (!window.PublicKeyCredential || !navigator.credentials) return null;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const prf = { eval: { first: SALT } };
  const known = store(CRED);
  try {
    if (!known) {
      const created = (await withTimeout(navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Dibs" },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "dibs-bed", displayName: "Your bed on Dibs" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
          extensions: { prf } as AuthenticationExtensionsClientInputs,
          timeout: 30000,
        },
      }), 32000)) as PublicKeyCredential | null;
      if (!created) return null;
      store(CRED, b64u(created.rawId));
    }
    const got = (await withTimeout(navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: fromB64u(store(CRED) ?? "") }],
        userVerification: "preferred",
        extensions: { prf } as AuthenticationExtensionsClientInputs,
        timeout: 30000,
      },
    }), 32000)) as PublicKeyCredential | null;
    const res = got?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined;
    const first = res?.prf?.results?.first;
    return first ? sha256(new Uint8Array(first)) : null;
  } catch {
    return null;
  }
}

let cached: DeviceKey | null = null;

/** The friend's key: passkey-derived when the browser supports PRF, otherwise a device key in this browser. */
export async function deviceKey(): Promise<DeviceKey> {
  if (cached) return cached;
  const seed = await prfSeed();
  if (seed) return (cached = await fromSeed(seed, "passkey"));
  let saved = store(FALLBACK);
  if (!saved) saved = store(FALLBACK, bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
  const hex = saved ?? bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  return (cached = await fromSeed(bytes, "device"));
}
