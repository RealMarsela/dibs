import { Hono } from "hono";
import { PublicKey } from "near-api-js";
import { z } from "zod";
import { ApiError } from "./errors";
import { type Env, rpcUrls } from "./env";
import { clientIp } from "./calls";
import { rateLimit } from "./ratelimit";

/** NEP-413 signMessage proofs: sign in to Dibs with a NEAR wallet instead of a passkey-derived account. */
export const authRoute = new Hono<{ Bindings: Env }>();

export const AUTH_RECIPIENT = "dibs.larinova.com";
export const BOOKER_MESSAGE = "Start a Dibs trip as the booker";
export const NONCE_TTL_MS = 10 * 60 * 1000;
/** The exact text an EVM wallet signs (ERC-191 personal_sign) to act as the booker. */
export const erc191Message = (nonceHex: string): string => `${BOOKER_MESSAGE}\nApp: ${AUTH_RECIPIENT}\nNonce: ${nonceHex}`;
const NEP413_TAG = 2147484061; // 2^31 + 413

export const proofSchema = z
  .object({
    accountId: z.string().min(2).max(64),
    publicKey: z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,50}$/, "ed25519:<base58>"),
    signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/, "base64 of 64 bytes"),
    nonce: z.string().regex(/^[0-9a-f]{64}$/, "64 hex chars"),
    message: z.string().max(200),
  })
  .strict();
export type Nep413Proof = z.infer<typeof proofSchema>;

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string): Uint8Array => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const u32le = (n: number): Uint8Array => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

const borshString = (s: string): Uint8Array => {
  const b = new TextEncoder().encode(s);
  return concat(u32le(b.length), b);
};

/** sha256( u32_le(2^31+413) || borsh(Payload{message, nonce[32], recipient, callbackUrl: None}) ), as the 32 bytes the wallet signs. */
export async function nep413Hash(message: string, nonceHex: string, recipient: string = AUTH_RECIPIENT): Promise<Uint8Array> {
  const payload = concat(u32le(NEP413_TAG), borshString(message), unhex(nonceHex), borshString(recipient), Uint8Array.of(0));
  return new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
}

export const authFail = (code: string, msg: string) => new ApiError(401, code, msg);

/** Single-use nonce check shared by the NEP-413 and ERC-191 proofs: consumed whatever happens next. */
export async function consumeNonce(env: Env, nonce: string): Promise<void> {
  const key = `auth/nonce/${nonce}`;
  const obj = await env.BLOBS.get(key);
  if (!obj) throw authFail("E_AUTH_NONCE", "unknown or already used nonce");
  await env.BLOBS.delete(key); // single use, whatever happens next
  let created = 0;
  try {
    created = Number(((await obj.json()) as { created_at?: number }).created_at);
  } catch {
    /* treated as expired */
  }
  if (!Number.isFinite(created) || Date.now() - created >= NONCE_TTL_MS) throw authFail("E_AUTH_NONCE", "nonce expired, request a new one");
}

async function isFullAccessKey(env: Env, accountId: string, publicKey: string): Promise<boolean> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: "dibs", method: "query", params: { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey } });
  for (const url of rpcUrls(env)) {
    try {
      const j = (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })).json()) as {
        result?: { permission?: unknown; error?: string };
        error?: unknown;
      };
      if (j.result && !j.result.error) return j.result.permission === "FullAccess";
      if (j.result?.error || j.error) return false; // unknown key or account
    } catch {
      /* try the next RPC */
    }
  }
  throw new ApiError(502, "E_RPC", "NEAR RPC access key lookup failed");
}

/** Verifies a NEP-413 proof end to end and returns the proven accountId. Consumes the nonce. */
export async function verifyNep413(env: Env, proof: Nep413Proof, expectedMessage: string): Promise<string> {
  if (proof.message !== expectedMessage) throw authFail("E_AUTH_MESSAGE", "signed message does not match");
  await consumeNonce(env, proof.nonce);
  let ok = false;
  try {
    const sig = Uint8Array.from(atob(proof.signature), (ch) => ch.charCodeAt(0));
    ok = sig.length === 64 && PublicKey.fromString(proof.publicKey as `ed25519:${string}`).verify(await nep413Hash(proof.message, proof.nonce), sig);
  } catch {
    ok = false;
  }
  if (!ok) throw authFail("E_AUTH_SIG", "signature does not verify");
  if (!(await isFullAccessKey(env, proof.accountId, proof.publicKey))) throw authFail("E_AUTH_KEY", "that key is not a full-access key of the account");
  return proof.accountId;
}

authRoute.get("/auth/nonce", async (c) => {
  rateLimit(`nonce:ip:${clientIp(c)}`, 20, 60_000);
  const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await c.env.BLOBS.put(`auth/nonce/${nonce}`, JSON.stringify({ created_at: now }));
  c.header("cache-control", "no-store");
  return c.json({ nonce, recipient: AUTH_RECIPIENT, message: BOOKER_MESSAGE, erc191_message: erc191Message(nonce), expires_at: new Date(now + NONCE_TTL_MS).toISOString() });
});
