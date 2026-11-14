import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { FakeR2, json, makeEnv, stubFetch } from "./helpers";

const near = vi.hoisted(() => ({ getTrip: vi.fn(), ftBalance: vi.fn(), relayerAccount: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const DEPOSIT = "0x1111111111111111111111111111111111111111";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const FROM = "0x2527d02599ba641c19fea793cd0f167589a0f10d";
const pad = (a: string) => "0x" + a.slice(2).toLowerCase().padStart(64, "0");
const hex = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");
const HASH = "0x" + "ab".repeat(32);
const env = () => makeEnv({ TESTNET_EVM_DEPOSIT: DEPOSIT });
const post = (b: unknown, e = env()) => app.fetch(json("/testnet/evm-deposit", b), e);
const good = { trip: "lis0312", kind: "bed", n: 3, txHash: HASH };
const log = (over: Partial<{ address: string; to: string; amount: bigint }> = {}) => ({
  address: over.address ?? USDC.toLowerCase(),
  topics: [TOPIC, pad(FROM), pad(over.to ?? DEPOSIT)],
  data: hex(over.amount ?? 250000n),
});
const evmRes = (receipt: unknown) => () => Response.json({ jsonrpc: "2.0", id: 1, result: receipt });
const codeOf = async (r: Response) => ((await r.json()) as { code?: string }).code;

const callFunctionRaw = vi.fn();
let balance = 0n;
beforeEach(() => {
  resetRateLimits();
  callFunctionRaw.mockReset();
  callFunctionRaw.mockImplementation(async (a: { methodName: string }) => {
    if (a.methodName === "mint") balance = 250000n;
    if (a.methodName === "sweep") balance = 0n;
    return { transaction: { hash: "NEARTX_" + a.methodName }, status: { SuccessValue: "" } };
  });
  balance = 0n;
  near.getTrip.mockResolvedValue({ price: "250000", n_beds: 8, beds: Array.from({ length: 8 }, () => ({ status: "Held" })) });
  near.ftBalance.mockImplementation(async () => balance);
  near.relayerAccount.mockReturnValue({ callFunctionRaw });
});

describe("GET /testnet/evm-info", () => {
  it("returns the Base Sepolia deposit target", async () => {
    const res = await app.fetch(new Request("http://api.test/testnet/evm-info"), env());
    expect(await res.json()).toEqual({ chainId: 84532, chain: "base-sepolia", usdc: USDC, address: DEPOSIT });
  });
  it("503 when unconfigured, refused on a mainnet env", async () => {
    const r1 = await app.fetch(new Request("http://api.test/testnet/evm-info"), makeEnv());
    expect(r1.status).toBe(503);
    expect(await codeOf(r1)).toBe("E_EVM_UNCONFIGURED");
    const r2 = await app.fetch(new Request("http://api.test/testnet/evm-info"), makeEnv({ NEAR_NETWORK: "mainnet", TESTNET_EVM_DEPOSIT: DEPOSIT }));
    expect(r2.status).toBe(403); // the app-level mainnet guard answers before the route's own 404
  });
});

describe("POST /testnet/evm-deposit", () => {
  it("rejects a bad body", async () => {
    for (const b of [{ ...good, txHash: "0x123" }, { ...good, extra: 1 }, { ...good, kind: "x" }, {}]) {
      const res = await post(b);
      expect(res.status).toBe(400);
      expect(await codeOf(res)).toBe("E_BAD_INPUT");
    }
  });

  it("409 while the receipt is null", async () => {
    stubFetch(evmRes(null));
    const res = await post(good);
    expect(res.status).toBe(409);
    expect(await codeOf(res)).toBe("E_EVM_TX_PENDING");
  });

  it("502 when every RPC fails, and falls over to the second RPC", async () => {
    stubFetch(() => new Response("nope", { status: 500 }));
    const res = await post(good);
    expect(res.status).toBe(502);
    expect(await codeOf(res)).toBe("E_RPC");
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      return url.includes("publicnode") ? Response.json({ result: null }) : new Response("x", { status: 503 });
    });
    resetRateLimits();
    expect((await post(good)).status).toBe(409);
    expect(seen).toEqual(["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"]);
  });

  it("400 when the transaction failed", async () => {
    stubFetch(evmRes({ status: "0x0", logs: [log()] }));
    const res = await post(good);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("E_EVM_TX_FAILED");
  });

  it("400 for a wrong recipient, too small an amount, or another token", async () => {
    for (const l of [log({ to: "0x2222222222222222222222222222222222222222" }), log({ amount: 249999n }), log({ address: "0x3333333333333333333333333333333333333333" })]) {
      stubFetch(evmRes({ status: "0x1", logs: [l] }));
      const res = await post(good);
      expect(res.status).toBe(400);
      expect(await codeOf(res)).toBe("E_EVM_NO_TRANSFER");
    }
    resetRateLimits();
    stubFetch(evmRes({ status: "0x1", logs: [] }));
    const res = await post(good);
    expect(((await res.json()) as { error: string }).error).toContain(DEPOSIT);
  });

  it("credits the bed once, then refuses a replay", async () => {
    stubFetch(evmRes({ status: "0x1", logs: [log({ amount: 300000n })] }));
    const e = env();
    const res = await post({ ...good, txHash: HASH.toUpperCase().replace("0X", "0x") }, e);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ evm_tx: HASH.toLowerCase(), from: FROM, mint_tx: "NEARTX_mint", sweep_tx: "NEARTX_sweep", status: "done" });
    const methods = callFunctionRaw.mock.calls.map((c) => c[0].methodName);
    expect(methods).toEqual(["mint", "sweep"]);
    expect((e.BLOBS as unknown as FakeR2).store.has(`evmdep/${HASH.toLowerCase()}`)).toBe(true);

    const again = await post(good, e);
    expect(again.status).toBe(409);
    expect(await codeOf(again)).toBe("E_DEPOSIT_USED");
    expect(callFunctionRaw).toHaveBeenCalledTimes(2);
  });

  it("releases the replay claim when crediting fails", async () => {
    stubFetch(evmRes({ status: "0x1", logs: [log()] }));
    near.getTrip.mockResolvedValueOnce({ price: "250000", n_beds: 8 }).mockResolvedValueOnce({ price: "250000", n_beds: 8, beds: [{ status: "Open" }, { status: "Open" }, { status: "Open" }] });
    const e = env();
    const res = await post(good, e);
    expect(res.status).toBe(409);
    expect(await codeOf(res)).toBe("E_NOT_HELD");
    expect((e.BLOBS as unknown as FakeR2).store.has(`evmdep/${HASH}`)).toBe(false);
  });

  it("is refused on /mainnet/ by the scope guard", async () => {
    const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext;
    const main = { ...makeEnv(), MAINNET_RPC_URLS: "https://rpc.mainnet.invalid", MAINNET_DIBS_CONTRACT: "dibsapp.near", MAINNET_USDC_CONTRACT: "x", MAINNET_RELAYER_ACCOUNT_ID: "relayer.dibsapp.near", MAINNET_RELAYER_PRIVATE_KEY: "" };
    const res = await worker.fetch(json("/mainnet/testnet/evm-deposit", good), main, ctx);
    expect(res.status).toBe(403);
    expect(await codeOf(res)).toBe("E_MAINNET_SCOPE");
  });
});
