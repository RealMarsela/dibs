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

const prfOf = (c: PublicKeyCredential | null) => (c?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined)?.prf?.results?.first;

/** One Touch ID in the usual case: an existing passkey (known id, or a discoverable one) is used before creating one,
    and a new passkey's PRF output from create() is used directly when the authenticator returns it. */
async function prfSeed(): Promise<Uint8Array | null> {
  if (!window.PublicKeyCredential || !navigator.credentials) return null;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const prf = { eval: { first: SALT } };
  const known = store(CRED);
  const get = (allow?: string) =>
    withTimeout(navigator.credentials.get({
      publicKey: {
        challenge,
        ...(allow ? { allowCredentials: [{ type: "public-key" as const, id: fromB64u(allow) }] } : {}),
        userVerification: "preferred",
        extensions: { prf } as AuthenticationExtensionsClientInputs,
        timeout: 30000,
      },
    }), 32000) as Promise<PublicKeyCredential | null>;
  try {
    // A device that has signed in before looks for its passkey first (by id, or discoverable if the id was lost);
    // a first visit goes straight to create(), so each case is one Touch ID.
    let first = known || store(ACCOUNT) ? prfOf(await get(known ?? undefined).catch(() => null)) : undefined;
    if (!first && !known) {
      const created = (await withTimeout(navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Dibs" },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "dibs-bed", displayName: "Your bed on Dibs" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
          extensions: { prf } as AuthenticationExtensionsClientInputs,
          timeout: 30000,
        },
      }), 32000)) as PublicKeyCredential | null;
      if (!created) return null;
      store(CRED, b64u(created.rawId));
      first = prfOf(created) ?? prfOf(await get(b64u(created.rawId)).catch(() => null));
    }
    return first ? sha256(new Uint8Array(first)) : null;
  } catch {
    return null;
  }
}

let cached: DeviceKey | null = null;
const SESSION = "dibs.session.seed";
const ACCOUNT = "dibs.device.account";

/** This device's account id, if it has ever signed in, read without any prompt (for "who am I" on page load). */
export function rememberedDevice(): string | null {
  return store(ACCOUNT);
}

function sessionSeed(v?: string): string | null {
  try {
    if (v) sessionStorage.setItem(SESSION, v);
    return sessionStorage.getItem(SESSION);
  } catch {
    return null;
  }
}

/** The friend's key: passkey-derived when the browser supports PRF, otherwise a device key in this browser. Asked for
    only after a tap, and kept for this browser session, so it is at most one Touch ID per session. */
export async function deviceKey(): Promise<DeviceKey> {
  if (cached) return cached;
  const s = sessionSeed();
  if (s) return (cached = await fromSeed(Uint8Array.from(s.match(/.{2}/g)!.map((h) => parseInt(h, 16))), "passkey"));
  const seed = await prfSeed();
  if (seed) {
    sessionSeed(bytesToHex(seed));
    cached = await fromSeed(seed, "passkey");
    store(ACCOUNT, cached.accountId);
    window.dispatchEvent(new Event("dibs:wallet"));
    return cached;
  }
  let saved = store(FALLBACK);
  if (!saved) saved = store(FALLBACK, bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
  const hex = saved ?? bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  cached = await fromSeed(bytes, "device");
  store(ACCOUNT, cached.accountId);
  window.dispatchEvent(new Event("dibs:wallet"));
  return cached;
}
