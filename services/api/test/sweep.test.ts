import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { FakeR2, makeEnv, mainnetEnv, stubFetch } from "./helpers";

const near = vi.hoisted(() => ({ getTrip: vi.fn(), ftBalance: vi.fn(), relayerAccount: vi.fn(), calls: [] as unknown[] }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const callFunctionRaw = vi.fn();
let balance = 250000n;

beforeEach(() => {
  near.calls.length = 0;
  callFunctionRaw.mockReset();
  callFunctionRaw.mockImplementation(async (a: unknown) => {
    near.calls.push(a);
    balance = 0n; // the sweep moves the funds
    return { transaction: { hash: "TXHASH1" }, status: { SuccessValue: "" } };
  });
  balance = 250000n;
  near.getTrip.mockResolvedValue({ price: "250000", n_beds: 8 });
  near.ftBalance.mockImplementation(async () => balance);
  near.relayerAccount.mockReturnValue({ callFunctionRaw });
});

const get = (env = makeEnv(), addr = "b03-lis0312.dibs-x.testnet") => app.fetch(new Request(`http://api.test/status/${addr}`), env);
const body = async (r: Response) => (await r.json()) as Record<string, unknown>;

describe("GET /status direct (testnet) sweep", () => {
  it("sweeps once with the chain price and 300 Tgas", async () => {
    const env = makeEnv();
    const b = await body(await get(env));
    expect(b).toMatchObject({ status: "SUCCESS", sweep: "done", tx_hash: "TXHASH1" });
    expect(near.calls).toHaveLength(1);
    expect(near.calls[0]).toMatchObject({ contractId: "b03-lis0312.dibs-x.testnet", methodName: "sweep", args: { amount: "250000" }, gas: 300_000_000_000_000n });
  });

  it("is idempotent: repeated polls never sweep twice", async () => {
    const env = makeEnv();
    await get(env);
    const second = await body(await get(env));
    const third = await body(await get(env));
    expect(near.calls).toHaveLength(1);
    expect(second.sweep).toBe("already_done");
    expect(third.sweep).toBe("already_done");
  });

  it("is idempotent under concurrency (create-only R2 claim)", async () => {
    const env = makeEnv();
    callFunctionRaw.mockImplementation(async (a: unknown) => {
      near.calls.push(a);
      await new Promise((r) => setTimeout(r, 20));
      balance = 0n;
      return { transaction: { hash: "T" }, status: { SuccessValue: "" } };
    });
    const rs = await Promise.all([get(env), get(env), get(env), get(env)]);
    expect(near.calls).toHaveLength(1);
    const results = await Promise.all(rs.map(body));
    expect(results.filter((r) => r.sweep === "done")).toHaveLength(1);
  });

  it("no funds yet: no call and PENDING_DEPOSIT", async () => {
    balance = 0n;
    const b = await body(await get());
    expect(b).toMatchObject({ status: "PENDING_DEPOSIT", sweep: "no_funds" });
    expect(near.calls).toHaveLength(0);
  });

  it("a failed sweep releases the claim so a later poll retries", async () => {
    const env = makeEnv();
    callFunctionRaw.mockRejectedValueOnce(new Error("boom"));
    const first = await get(env);
    expect(first.status).toBe(502);
    expect(((await first.json()) as { code: string }).code).toBe("E_SWEEP_FAILED");
    const retry = await body(await get(env));
    expect(retry.sweep).toBe("done");
  });

  it("an address outside the receipt pattern is never swept directly", async () => {
    stubFetch(() => new Response("{}", { status: 404 }));
    const res = await get(makeEnv(), "evil.testnet");
    expect(res.status).toBe(404);
    expect(near.calls).toHaveLength(0);
  });
});

describe("GET /status via 1Click (mainnet)", () => {
  const status = (s: string, recipient = "b03-lis0312.dibs-x.near") =>
    stubFetch(() => new Response(JSON.stringify({ status: s, quoteResponse: { quote: { amountIn: "1", amountOut: "250000" }, quoteRequest: { recipient, originAsset: "x" } } })));

  it("does not sweep while 1Click is not SUCCESS", async () => {
    status("PROCESSING");
    const b = await body(await get(mainnetEnv(), "0xdeposit"));
    expect(b).toMatchObject({ status: "PROCESSING", sweep: "not_ready" });
    expect(near.calls).toHaveLength(0);
  });

  it("sweeps exactly once on SUCCESS, even if polled repeatedly", async () => {
    status("SUCCESS");
    const env = mainnetEnv();
    const a = await body(await get(env, "0xdeposit"));
    const b = await body(await get(env, "0xdeposit"));
    expect(a.sweep).toBe("done");
    expect(b.sweep).toBe("already_done");
    expect(near.calls).toHaveLength(1);
    expect((env.BLOBS as unknown as FakeR2).store.has("sweeps/0xdeposit")).toBe(true);
  });

  it("refuses to sweep a 1Click recipient that is not a dibs receipt", async () => {
    status("SUCCESS", "attacker.near");
    const res = await get(mainnetEnv(), "0xdeposit");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("E_NOT_OUR_RECEIPT");
    expect(near.calls).toHaveLength(0);
  });
});
