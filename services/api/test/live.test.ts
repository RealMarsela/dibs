import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyPair } from "near-api-js";
import { createApp } from "../src/index";
import { clearActivityCache } from "../src/activity";
import { resetRateLimits } from "../src/ratelimit";
import { nameMessage } from "../src/names";
import { json, makeEnv, mainnetEnv, DIBS, USDC } from "./helpers";

const near = vi.hoisted(() => ({ getTrip: vi.fn(), ftBalance: vi.fn(), relayerAccount: vi.fn(), accountExists: vi.fn(), view: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const callFunctionRaw = vi.fn();
const transfer = vi.fn();
const ACC = "ab".repeat(32);
const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const body = async (r: Response) => (await r.json()) as Record<string, any>;

beforeEach(() => {
  resetRateLimits();
  clearActivityCache();
  callFunctionRaw.mockReset().mockResolvedValue({ transaction: { hash: "TX1" }, status: { SuccessValue: "" } });
  transfer.mockReset().mockResolvedValue({ transaction: { hash: "BOOT1" }, status: { SuccessValue: "" } });
  near.relayerAccount.mockReturnValue({ callFunctionRaw, transfer });
  near.accountExists.mockReset().mockResolvedValue(false);
  near.getTrip.mockResolvedValue({ price: "40000000", n_beds: 2, n_wait: 1, beds: [{ status: "Held" }, { status: "Paid" }], wait_res: [null] });
  near.ftBalance.mockResolvedValue(40000000n);
  near.view.mockResolvedValue(undefined);
});

describe("POST /testnet/fund", () => {
  it("mints the exact price then sweeps", async () => {
    const r = await app.fetch(json("/testnet/fund", { trip: "lis0312", kind: "bed", n: 1 }), makeEnv());
    expect(r.status).toBe(200);
    const b = await body(r);
    expect(b.mint_tx).toBe("TX1");
    expect(b.status).toBe("done");
    expect(callFunctionRaw.mock.calls[0][0]).toMatchObject({ contractId: USDC, methodName: "mint", args: { account_id: `b01-lis0312.${DIBS}`, amount: "40000000" } });
    expect(callFunctionRaw.mock.calls[1][0]).toMatchObject({ methodName: "sweep" });
  });
  it("404 on mainnet, 409 when the bed is not held, 400 out of range", async () => {
    expect((await app.fetch(json("/testnet/fund", { trip: "lis0312", kind: "bed", n: 1 }), mainnetEnv())).status).toBe(404);
    expect((await app.fetch(json("/testnet/fund", { trip: "lis0312", kind: "bed", n: 2 }), makeEnv())).status).toBe(409);
    expect((await app.fetch(json("/testnet/fund", { trip: "lis0312", kind: "bed", n: 9 }), makeEnv())).status).toBe(400);
    expect(callFunctionRaw).not.toHaveBeenCalled();
  });
  it("rate limits per IP", async () => {
    const env = makeEnv();
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await app.fetch(json("/testnet/fund", { trip: "lis0312", kind: "bed", n: 9 }), env)).status;
    expect(last).toBe(429);
  });
});

describe("implicit bootstrap", () => {
  it("sends exactly 0.01 NEAR to a missing implicit account", async () => {
    const b = await body(await app.fetch(json("/account/bootstrap", { account: ACC }), makeEnv()));
    expect(b).toMatchObject({ created: true, tx_hash: "BOOT1" });
    expect(transfer).toHaveBeenCalledWith({ receiverId: ACC, amount: 10n ** 22n });
  });
  it("is idempotent when the account exists and refuses named accounts", async () => {
    near.accountExists.mockResolvedValue(true);
    const b = await body(await app.fetch(json("/account/bootstrap", { account: ACC }), makeEnv()));
    expect(b.created).toBe(false);
    expect(transfer).not.toHaveBeenCalled();
    expect((await app.fetch(json("/account/bootstrap", { account: "maya.own-0eb9ae.testnet" }), makeEnv())).status).toBe(400);
  });
  it("/hold bootstraps an implicit holder first", async () => {
    const b = await body(await app.fetch(json("/hold", { trip: "lis0312", kind: "bed", n: 1, holder: ACC }), makeEnv()));
    expect(b.bootstrap_tx).toBe("BOOT1");
    expect(transfer).toHaveBeenCalledTimes(1);
  });
});

async function signName(name: string, ts: number, kp = KeyPair.fromRandom("ed25519")) {
  const account = hexOf((kp.getPublicKey() as unknown as { data: Uint8Array }).data);
  const { signature } = kp.sign(new TextEncoder().encode(nameMessage(account, name, ts)));
  return { account, name, ts, sig: hexOf(signature) };
}

describe("names", () => {
  it("stores a signed name and serves it, seeds included", async () => {
    const env = makeEnv();
    const p = await signName("Zoë Park", Date.now());
    const put = await app.fetch(json("/names", p, "PUT"), env);
    expect(put.status).toBe(200);
    const get = await body(await app.fetch(new Request(`http://api.test/names?accounts=${p.account},maya.own-0eb9ae.testnet,tomas.own-0eb9ae.testnet,nobody.testnet`), env));
    expect(get).toEqual({ [p.account]: "Zoë Park", "maya.own-0eb9ae.testnet": "Maya", "tomas.own-0eb9ae.testnet": "Tomás" });
  });
  it("rejects bad signature, stale ts, bad name", async () => {
    const env = makeEnv();
    const p = await signName("Zoe", Date.now());
    expect((await app.fetch(json("/names", { ...p, name: "Zed" }, "PUT"), env)).status).toBe(401);
    const old = await signName("Zoe", Date.now() - 11 * 60_000);
    expect((await app.fetch(json("/names", old, "PUT"), env)).status).toBe(400);
    const bad = await signName("Zoe<script>", Date.now());
    expect((await app.fetch(json("/names", bad, "PUT"), env)).status).toBe(400);
    const long = await signName("a".repeat(25), Date.now());
    expect((await app.fetch(json("/names", long, "PUT"), env)).status).toBe(400);
  });
});

describe("proof, draw, refund-check", () => {
  const url = "https://dibs-api.gabrielaxy.workers.dev/blob/" + "a".repeat(64);
  const env = () => makeEnv({ PUBLIC_BASE_URL: "https://dibs-api.gabrielaxy.workers.dev" });
  it("submit_proof with 0.025 NEAR and 300 Tgas", async () => {
    const b = await body(await app.fetch(json("/proof/submit", { trip: "sin1025", blob_url: url, blob_sha256: "b".repeat(64) }), env()));
    expect(b.tx_hash).toBe("TX1");
    expect(callFunctionRaw.mock.calls[0][0]).toMatchObject({ methodName: "submit_proof", deposit: 25n * 10n ** 21n, gas: 300_000_000_000_000n });
  });
  it("refuses a foreign blob url", async () => {
    const r = await app.fetch(json("/proof/submit", { trip: "sin1025", blob_url: "https://evil.example/blob/x", blob_sha256: "b".repeat(64) }), env());
    expect(r.status).toBe(400);
  });
  it("draw calls request_draw", async () => {
    await app.fetch(json("/draw", { trip: "drw0001" }), makeEnv());
    expect(callFunctionRaw.mock.calls[0][0]).toMatchObject({ methodName: "request_draw", args: { trip: "drw0001" }, deposit: 25n * 10n ** 21n });
  });
  it("draw is rate limited per trip", async () => {
    let s = 0;
    for (let i = 0; i < 4; i++) s = (await app.fetch(json("/draw", { trip: "drw0001" }), makeEnv())).status;
    expect(s).toBe(429);
  });
  it("refund-check returns the contract code and tx hash from a failed outcome", async () => {
    callFunctionRaw.mockResolvedValue({ transaction: { hash: "FAILTX" }, status: { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: E_NO_REFUND" } } } } } });
    const b = await body(await app.fetch(json("/refund-check", { trip: "sin1025", n: 1 }), makeEnv()));
    expect(b).toMatchObject({ code: "E_NO_REFUND", tx_hash: "FAILTX", refused: true });
  });
});

describe("activity and trip fields", () => {
  it("returns logged events newest first, capped, and [] on failure", async () => {
    const env = makeEnv();
    await app.fetch(json("/draw", { trip: "drw0001" }), env);
    await app.fetch(json("/hold", { trip: "drw0001", kind: "bed", n: 1, holder: "maya.own-0eb9ae.testnet" }), env);
    clearActivityCache();
    const a = (await (await app.fetch(new Request("http://api.test/trip/drw0001/activity"), env)).json()) as any[];
    expect(a.length).toBe(2);
    expect(a[0]).toMatchObject({ kind: "hold", tx: "TX1" });
    clearActivityCache();
    near.view.mockRejectedValue(new Error("x"));
    const broken = makeEnv({ NAMES: { get: async () => { throw new Error("kv"); } } as unknown as KVNamespace });
    expect(await (await app.fetch(new Request("http://api.test/trip/drw0001/activity"), broken)).json()).toEqual([]);
  });
});
