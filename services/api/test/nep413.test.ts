import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyPair } from "near-api-js";
import { Hono } from "hono";
import { onError } from "../src/errors";
import { authRoute, BOOKER_MESSAGE, nep413Hash, verifyNep413, type Nep413Proof } from "../src/nep413";
import { resetRateLimits } from "../src/ratelimit";
import { makeEnv, FakeR2 } from "./helpers";

// near-api-js (noble ed25519 underneath) signs; the payload is built here with node:crypto, independent of src/nep413.ts.
const kp = KeyPair.fromRandom("ed25519");
const PK = kp.getPublicKey().toString();
const ACCOUNT = "maya.testnet";
const NONCE = "ab".repeat(32);

const app = new Hono<{ Bindings: ReturnType<typeof makeEnv> }>().route("/", authRoute);
app.onError(onError);

const enc = new TextEncoder();
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const str = (s: string) => { const b = enc.encode(s); return [u32(b.length), b]; };
const cat = (parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => Array.from(p)));
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

async function payloadHash(message: string, nonceHex: string): Promise<Uint8Array> {
  const payload = cat([u32(2147484061), ...str(message), fromHex(nonceHex), ...str("dibs.larinova.com"), Uint8Array.of(0)]);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
}

export async function proof(over: Partial<Nep413Proof> = {}, key = kp): Promise<Nep413Proof> {
  const p = { accountId: ACCOUNT, publicKey: key.getPublicKey().toString(), message: BOOKER_MESSAGE, nonce: NONCE, ...over };
  const sig = key.sign(await payloadHash(p.message, p.nonce)).signature;
  return { signature: b64(sig), ...p } as Nep413Proof;
}

const seed = (env: ReturnType<typeof makeEnv>, nonce = NONCE, created_at = Date.now()) =>
  (env.BLOBS as unknown as FakeR2).put(`auth/nonce/${nonce}`, JSON.stringify({ created_at }));

const rpc = (permission: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(permission === null
    ? { jsonrpc: "2.0", id: "dibs", result: { error: "access key does not exist", block_height: 1 } }
    : { jsonrpc: "2.0", id: "dibs", result: { nonce: 1, permission } }))));
const code = async (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as { code: string }).code);

beforeEach(() => { resetRateLimits(); rpc("FullAccess"); });

describe("verifyNep413", () => {
  it("returns the accountId for a valid proof and consumes the nonce", async () => {
    const env = makeEnv();
    await seed(env);
    expect(await verifyNep413(env, await proof(), BOOKER_MESSAGE)).toBe(ACCOUNT);
    expect((env.BLOBS as unknown as FakeR2).store.has(`auth/nonce/${NONCE}`)).toBe(false);
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.params).toMatchObject({ request_type: "view_access_key", finality: "final", account_id: ACCOUNT, public_key: PK });
  });
  it("E_AUTH_MESSAGE on a different message", async () => {
    const env = makeEnv();
    await seed(env);
    expect(await code(verifyNep413(env, await proof({ message: "Send me your funds" }), BOOKER_MESSAGE))).toBe("E_AUTH_MESSAGE");
  });
  it("E_AUTH_NONCE on reuse", async () => {
    const env = makeEnv();
    await seed(env);
    await verifyNep413(env, await proof(), BOOKER_MESSAGE);
    expect(await code(verifyNep413(env, await proof(), BOOKER_MESSAGE))).toBe("E_AUTH_NONCE");
  });
  it("E_AUTH_NONCE on an unknown nonce", async () => {
    expect(await code(verifyNep413(makeEnv(), await proof(), BOOKER_MESSAGE))).toBe("E_AUTH_NONCE");
  });
  it("E_AUTH_NONCE on an expired nonce, which is deleted", async () => {
    const env = makeEnv();
    await seed(env, NONCE, Date.now() - 11 * 60_000);
    expect(await code(verifyNep413(env, await proof(), BOOKER_MESSAGE))).toBe("E_AUTH_NONCE");
    expect((env.BLOBS as unknown as FakeR2).store.has(`auth/nonce/${NONCE}`)).toBe(false);
  });
  it("E_AUTH_SIG on a tampered signature or a foreign key", async () => {
    const env = makeEnv();
    await seed(env);
    const p = await proof();
    const raw = Uint8Array.from(atob(p.signature), (c) => c.charCodeAt(0));
    raw[0] ^= 1;
    expect(await code(verifyNep413(env, { ...p, signature: b64(raw) }, BOOKER_MESSAGE))).toBe("E_AUTH_SIG");
    await seed(env);
    expect(await code(verifyNep413(env, { ...await proof(), publicKey: KeyPair.fromRandom("ed25519").getPublicKey().toString() }, BOOKER_MESSAGE))).toBe("E_AUTH_SIG");
  });
  it("E_AUTH_KEY for a FunctionCall key and for an unknown key", async () => {
    const env = makeEnv();
    await seed(env);
    rpc({ FunctionCall: { allowance: "1", receiver_id: "x.testnet", method_names: [] } });
    expect(await code(verifyNep413(env, await proof(), BOOKER_MESSAGE))).toBe("E_AUTH_KEY");
    await seed(env);
    rpc(null);
    expect(await code(verifyNep413(env, await proof(), BOOKER_MESSAGE))).toBe("E_AUTH_KEY");
  });
  it("golden vector: payload hash for a fixed message and nonce", async () => {
    // Derived by hand in Python: sha256(struct.pack("<I", 2147484061) + borsh(message) + bytes(range(32))
    // + borsh("dibs.larinova.com") + b"\x00"), borsh string = u32 LE length + UTF-8, callbackUrl None = 0x00.
    const nonce = toHex(Uint8Array.from({ length: 32 }, (_, i) => i));
    const h = await nep413Hash(BOOKER_MESSAGE, nonce);
    expect(toHex(h)).toBe("31257a441313fc10bfda2bce5328fc4b11cb9fb3c3a83a435a83eaf93dd47e83");
  });
});

describe("GET /auth/nonce", () => {
  it("issues a 64-hex nonce stored in R2", async () => {
    const env = makeEnv();
    const r = await app.fetch(new Request("http://api.test/auth/nonce"), env);
    const b = (await r.json()) as { nonce: string; recipient: string; message: string; expires_at: string };
    expect(r.status).toBe(200);
    expect(b.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatchObject({ recipient: "dibs.larinova.com", message: BOOKER_MESSAGE });
    expect((b as { erc191_message?: string }).erc191_message).toBe(`Start a Dibs trip as the booker\nApp: dibs.larinova.com\nNonce: ${b.nonce}`);
    expect(Date.parse(b.expires_at)).toBeGreaterThan(Date.now());
    expect((env.BLOBS as unknown as FakeR2).store.has(`auth/nonce/${b.nonce}`)).toBe(true);
  });
});
