import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actions } from "near-api-js";
import { signAndPoll } from "../src/txsend";
import { makeEnv } from "./helpers";

const env = makeEnv({ NEAR_RPC_URLS: "https://a.rpc,https://b.rpc" });
let signs = 0;
const acct = {
  accountId: "relayer-x.testnet",
  createSignedTransaction: vi.fn(async () => {
    signs += 1;
    return { transaction: { signs }, encode: () => new Uint8Array([1, 2, 3, signs]) };
  }),
};
vi.mock("near-api-js", async (orig) => ({ ...(await orig<typeof import("near-api-js")>()), encodeTransaction: (t: { signs: number }) => new Uint8Array([t.signs]) }));

type Reply = { url: string; method: string; body: unknown };
let script: (r: Reply, n: number) => unknown;
const seen: Reply[] = [];
beforeEach(() => {
  signs = 0;
  seen.length = 0;
  acct.createSignedTransaction.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    const b = JSON.parse(init.body);
    const r = { url, method: b.method, body: b.params };
    seen.push(r);
    return new Response(JSON.stringify(script(r, seen.length)));
  }));
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const run = (ms = 10_000) => {
  const p = signAndPoll(env, acct as never, "dibs.testnet", [actions.transfer(1n)], ms);
  void vi.runAllTimersAsync();
  return p;
};
const ok = { status: { SuccessValue: "" }, receipts_outcome: [], transaction: { hash: "H" } };

describe("broadcast then poll", () => {
  it("fails over to the next RPC, then polls until the tx has executed", async () => {
    let polls = 0;
    script = (r) => (r.method === "send_tx" ? (r.url.includes("a.rpc") ? { error: { message: "rate limited" } } : { result: { final_execution_status: "INCLUDED" } }) : ++polls < 3 ? { result: { status: "Started" } } : { result: ok });
    expect(await run()).toEqual(ok);
    expect(seen.filter((r) => r.method === "send_tx").map((r) => r.url)).toEqual(["https://a.rpc", "https://b.rpc"]);
    expect(seen.find((r) => r.method === "send_tx")!.body).toMatchObject({ wait_until: "INCLUDED" });
    expect(seen.filter((r) => r.method === "tx").every((r) => (r.body as { wait_until: string }).wait_until === "NONE")).toBe(true);
  });
  it("throws with the on-chain outcome when the tx failed, so callers can read the contract's error", async () => {
    const failed = { status: { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: E_NO_REFUND" } } } } }, receipts_outcome: [], transaction: { hash: "H" } };
    script = (r) => (r.method === "send_tx" ? { result: {} } : { result: failed });
    const e = await run().catch((x) => x);
    expect(JSON.stringify(e)).toContain("E_NO_REFUND");
  });
  it("re-signs with a fresh nonce on InvalidNonce", async () => {
    script = (r, n) => (r.method === "send_tx" ? (n === 1 ? { error: { cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { InvalidNonce: {} } } } } } : { result: {} }) : { result: ok });
    await run();
    expect(acct.createSignedTransaction).toHaveBeenCalledTimes(2);
  });
  it("gives up after the wait window", async () => {
    script = (r) => (r.method === "send_tx" ? { result: {} } : { result: { status: "Started" } });
    await expect(run(3000)).rejects.toThrow(/did not finish/);
  });
});
