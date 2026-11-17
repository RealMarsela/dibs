import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { paysInto } from "../src/walletreceipt";
import { json, makeEnv } from "./helpers";

const env = makeEnv();
const BED = `b01-val1.${env.DIBS_CONTRACT}`;
const W = "maya.testnet";
const HASH = "9Wf95AySuFJGwmkg5o6cCxF2gHcnDzVoWT6E8HnohZmg";
const out = (o: { signer?: string; receiver?: string; method?: string; to?: string; failed?: boolean } = {}) => ({
  status: o.failed ? { Failure: {} } : { SuccessValue: "" },
  transaction: {
    signer_id: o.signer ?? W,
    receiver_id: o.receiver ?? env.USDC_CONTRACT,
    actions: [{ FunctionCall: { method_name: "mint", args: btoa("{}") } }, { FunctionCall: { method_name: o.method ?? "ft_transfer", args: btoa(JSON.stringify({ receiver_id: o.to ?? BED, amount: "1000000" })) } }],
  },
});

describe("paysInto", () => {
  it("accepts a successful USDC transfer from the sender into the bed", () => {
    expect(paysInto(out(), env.USDC_CONTRACT, W, BED)).toBe(true);
    expect(paysInto(out({ method: "ft_transfer_call" }), env.USDC_CONTRACT, W, BED)).toBe(true);
  });
  it("refuses another signer, another token, another bed, or a failed tx", () => {
    expect(paysInto(out({ signer: "eve.testnet" }), env.USDC_CONTRACT, W, BED)).toBe(false);
    expect(paysInto(out({ receiver: "fake-usdc.testnet" }), env.USDC_CONTRACT, W, BED)).toBe(false);
    expect(paysInto(out({ to: `b02-val1.${env.DIBS_CONTRACT}` }), env.USDC_CONTRACT, W, BED)).toBe(false);
    expect(paysInto(out({ failed: true }), env.USDC_CONTRACT, W, BED)).toBe(false);
    expect(paysInto(null, env.USDC_CONTRACT, W, BED)).toBe(false);
  });
});

describe("POST /receipt/wallet-pay", () => {
  let chain: unknown;
  beforeEach(() => {
    resetRateLimits();
    chain = out();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: chain }))));
  });
  afterEach(() => vi.unstubAllGlobals());
  const post = (e = env, b: Record<string, unknown> = {}) => createApp().fetch(json("/receipt/wallet-pay", { trip: "val1", kind: "bed", n: 1, tx_hash: HASH, sender: W, ...b }), e);

  it("records a verified receipt once", async () => {
    const e = makeEnv();
    expect(await (await post(e)).json()).toEqual({ ok: true, recorded: true });
    expect(await e.NAMES.get("act/val1", "json")).toEqual([expect.objectContaining({ kind: "deposit", text: "Bed 1 paid from a NEAR wallet (maya.testnet)", tx: HASH, chain: "near" })]);
    expect(await (await post(e)).json()).toEqual({ ok: true, recorded: false });
  });
  it("refuses a tx that did not pay this bed", async () => {
    chain = out({ to: `b02-val1.${env.DIBS_CONTRACT}` });
    const r = await post(makeEnv());
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("E_NOT_A_PAYMENT");
  });
  it("validates input", async () => {
    expect((await post(makeEnv(), { tx_hash: "nope" })).status).toBe(400);
    expect((await post(makeEnv(), { extra: 1 })).status).toBe(400);
  });
});
