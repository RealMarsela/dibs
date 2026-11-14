import { beforeEach, describe, expect, it, vi } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { createApp } from "../src/index";
import { clearTripCache } from "../src/trip";
import { erc191Message } from "../src/nep413";
import { verifyErc191, type Erc191Proof } from "../src/erc191";
import { json, makeEnv, type FakeR2 } from "./helpers";

// The signer is built here from noble primitives and Buffer, independent of src/erc191.ts.
const near = vi.hoisted(() => ({ view: vi.fn(), relayerAccount: vi.fn(), accountExists: vi.fn(), nearBalance: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const addrOf = (priv: Uint8Array) => "0x" + hex(keccak_256(secp256k1.getPublicKey(priv, false).subarray(1)).subarray(12));
function personalSign(priv: Uint8Array, message: string, vBase = 27): string {
  const body = Buffer.from(message, "utf8");
  const digest = keccak_256(Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`, "utf8"), body]));
  const s = secp256k1.sign(digest, priv);
  return "0x" + s.r.toString(16).padStart(64, "0") + s.s.toString(16).padStart(64, "0") + (s.recovery + vBase).toString(16).padStart(2, "0");
}

const PRIV = secp256k1.utils.randomPrivateKey();
const ADDR = addrOf(PRIV);
const NONCE = "ab".repeat(32);
const seed = (e: ReturnType<typeof makeEnv>, nonce = NONCE) => (e.BLOBS as unknown as FakeR2).put(`auth/nonce/${nonce}`, JSON.stringify({ created_at: Date.now() }));
const proof = (over: Partial<Erc191Proof> = {}, priv = PRIV, vBase = 27): Erc191Proof => {
  const nonce = over.nonce ?? NONCE;
  const message = over.message ?? erc191Message(nonce);
  return { address: ADDR, nonce, message, signature: personalSign(priv, message, vBase), ...over };
};
const fails = async (p: Promise<unknown>, code: string) => expect(await p.then(() => null, (e: { code: string }) => e.code)).toBe(code);

describe("verifyErc191", () => {
  it("golden vector: private key 1 signing a fixed message recovers 0x7e5f...5bdf", async () => {
    // Private key 0x00..01 is the well-known secp256k1 generator key; its Ethereum address is
    // 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf (the address in the ecrecover and Hardhat examples).
    const one = Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? 1 : 0));
    expect(addrOf(one)).toBe("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf");
    const e = makeEnv();
    await seed(e);
    const p = { ...proof({}, one), address: "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf" };
    expect(await verifyErc191(e, p)).toBe("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf");
  });
  it("returns the lowercase address for a valid proof (checksummed input ok) and consumes the nonce", async () => {
    const e = makeEnv();
    await seed(e);
    expect(await verifyErc191(e, proof({ address: "0x" + ADDR.slice(2).toUpperCase() }))).toBe(ADDR);
    expect((e.BLOBS as unknown as FakeR2).store.has(`auth/nonce/${NONCE}`)).toBe(false);
  });
  it.each([[27], [0]])("accepts v with base %i", async (vBase) => {
    const e = makeEnv();
    await seed(e);
    expect(await verifyErc191(e, proof({}, PRIV, vBase))).toBe(ADDR);
  });
  it("E_AUTH_MESSAGE on the wrong message, nonce untouched", async () => {
    const e = makeEnv();
    await seed(e);
    await fails(verifyErc191(e, proof({ message: "Start a Dibs trip as someone else" })), "E_AUTH_MESSAGE");
    expect((e.BLOBS as unknown as FakeR2).store.has(`auth/nonce/${NONCE}`)).toBe(true);
  });
  it("E_AUTH_NONCE on an unknown or reused nonce", async () => {
    const e = makeEnv();
    await fails(verifyErc191(e, proof()), "E_AUTH_NONCE");
    await seed(e);
    await verifyErc191(e, proof());
    await fails(verifyErc191(e, proof()), "E_AUTH_NONCE");
  });
  it("E_AUTH_SIG on a tampered signature", async () => {
    const e = makeEnv();
    await seed(e);
    const p = proof();
    const flipped = p.signature.slice(0, 10) + (p.signature[10] === "0" ? "1" : "0") + p.signature.slice(11);
    await fails(verifyErc191(e, { ...p, signature: flipped }), "E_AUTH_SIG");
  });
  it("E_AUTH_SIG on a signature from a different key, and on malformed or bad-v signatures", async () => {
    const e = makeEnv();
    await seed(e);
    await fails(verifyErc191(e, proof({}, secp256k1.utils.randomPrivateKey())), "E_AUTH_SIG");
    await seed(e);
    await fails(verifyErc191(e, proof({ signature: "0x1234" })), "E_AUTH_SIG");
    await seed(e);
    await fails(verifyErc191(e, proof({ signature: proof().signature.slice(0, 130) + "05" })), "E_AUTH_SIG");
  });
});

describe("POST /trips with an eth-implicit booker", () => {
  const app = createApp();
  const call = vi.fn();
  const soon = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
  const good = () => ({ place: "Lisbon", stay: "Alfama flat", check_in: soon(30), check_out: soon(33), beds: 2, price_usdc: 5, booker: ADDR });
  const env = () => makeEnv({ TRIP_DAO: "dao-x.sputnik-v2.testnet" });
  const post = (body: unknown, e = env()) => app.fetch(json("/trips", body), e);
  const err = async (r: Response) => (await r.json()) as { error: string; code: string };

  beforeEach(() => {
    clearTripCache();
    call.mockReset().mockImplementation(async () => ({ transaction: { hash: "TX" }, status: { SuccessValue: "" } }));
    const transfer = vi.fn();
    near.relayerAccount.mockReturnValue({ callFunctionRaw: call, transfer });
    near.accountExists.mockReset().mockResolvedValue(false);
    near.nearBalance.mockReset().mockResolvedValue(5n * 10n ** 24n);
    near.view.mockReset().mockImplementation(async (_e: unknown, _c: string, m: string) => (m === "create_cost" ? "157740000000000000000000" : undefined));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }))));
  });

  it("valid ERC-191 auth creates the trip for the 0x booker with no existence check or bootstrap", async () => {
    const e = env();
    await seed(e);
    const r = await post({ ...good(), auth: proof() }, e);
    expect(r.status).toBe(200);
    const [create, hold] = call.mock.calls.map((c) => c[0]);
    expect(create.args.booker).toBe(ADDR);
    expect(hold.args.holder).toBe(ADDR);
    expect(near.accountExists).not.toHaveBeenCalled();
  });
  it("a proof from another wallet is 401 E_AUTH_ACCOUNT and sends nothing", async () => {
    const e = env();
    const other = secp256k1.utils.randomPrivateKey();
    await seed(e);
    const r = await post({ ...good(), auth: { ...proof({}, other), address: addrOf(other) } }, e);
    expect(r.status).toBe(401);
    expect((await err(r)).code).toBe("E_AUTH_ACCOUNT");
    expect(call).not.toHaveBeenCalled();
  });
  it("NEP-413-shaped auth for a 0x booker is 400 E_BAD_INPUT", async () => {
    const auth = { accountId: ADDR, publicKey: "ed25519:" + "1".repeat(44), signature: "A".repeat(86) + "==", nonce: NONCE, message: "Start a Dibs trip as the booker" };
    const r = await post({ ...good(), auth });
    expect(r.status).toBe(400);
    expect((await err(r)).code).toBe("E_BAD_INPUT");
    expect(call).not.toHaveBeenCalled();
  });
  it("ERC-191-shaped auth for a named booker is 400 E_BAD_INPUT", async () => {
    const r = await post({ ...good(), booker: "maya.testnet", auth: proof() });
    expect(r.status).toBe(400);
    expect((await err(r)).code).toBe("E_BAD_INPUT");
  });
  it("0x booker without auth is 401 E_AUTH_REQUIRED", async () => {
    const r = await post(good());
    expect(r.status).toBe(401);
    expect((await err(r)).code).toBe("E_AUTH_REQUIRED");
    expect(call).not.toHaveBeenCalled();
  });
});
