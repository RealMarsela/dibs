import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApp } from "../src/index";
import { json, makeEnv, mainnetEnv, stubFetch } from "./helpers";

const near = vi.hoisted(() => ({
  getTrip: vi.fn(),
  accountExists: vi.fn(),
  isStorageRegistered: vi.fn(),
}));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const good = { trip: "lis0312", n: 3, kind: "bed", fromChain: "arb", refundTo: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D" };
const quoteJson = (extra = {}) => ({
  quote: { depositAddress: "0xdeposit", amountIn: "256994", minAmountIn: "254468", amountOut: "250000", timeEstimate: 25, deadline: "2026-11-14T10:00:00Z", refundFee: "5300" },
  quoteRequest: { recipient: "b03-lis0312.dibs-x.near", originAsset: "x" },
  ...extra,
});

beforeEach(() => {
  near.getTrip.mockResolvedValue({ price: "250000", n_beds: 8 });
  near.accountExists.mockResolvedValue(true);
  near.isStorageRegistered.mockResolvedValue(true);
});

describe("POST /quote input validation", () => {
  const bad: [string, unknown][] = [
    ["missing fields", {}],
    ["unknown chain", { ...good, fromChain: "btc" }],
    ["evm refund address on solana", { ...good, fromChain: "sol" }],
    ["short trip code", { ...good, trip: "ab" }],
    ["bed index 0 (1-based)", { ...good, n: 0 }],
    ["extra field", { ...good, price: "1" }],
    ["dry overrides without dry", { ...good, dry_amount: "1" }],
  ];
  for (const [name, body] of bad) {
    it(`rejects ${name} with {error, code}`, async () => {
      const res = await app.fetch(json("/quote", body), makeEnv());
      expect(res.status).toBe(400);
      const b = (await res.json()) as { error: string; code: string };
      expect(b.code).toBe("E_BAD_INPUT");
      expect(typeof b.error).toBe("string");
    });
  }
  it("rejects non-JSON with E_BAD_JSON", async () => {
    const res = await app.fetch(new Request("http://api.test/quote", { method: "POST", body: "nope" }), makeEnv());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("E_BAD_JSON");
  });
});

describe("POST /quote behaviour", () => {
  it("testnet returns faucet-pay instructions and never calls 1Click", async () => {
    const f = stubFetch(() => new Response("{}"));
    const res = await app.fetch(json("/quote", good), makeEnv());
    const b = (await res.json()) as { mode: string; depositAddress: string; amountIn: string; instructions: unknown[] };
    expect(res.status).toBe(200);
    expect(b.mode).toBe("testnet");
    expect(b.depositAddress).toBe("b03-lis0312.dibs-x.testnet");
    expect(b.amountIn).toBe("250000");
    expect(f).not.toHaveBeenCalled();
  });

  it("mainnet sends an EXACT_OUTPUT DESTINATION_CHAIN quote with price read from chain", async () => {
    const f = stubFetch(() => new Response(JSON.stringify(quoteJson())));
    const res = await app.fetch(json("/quote", good), mainnetEnv());
    const b = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(b).toMatchObject({ mode: "oneclick", depositAddress: "0xdeposit", amountIn: "256994", recipient: "b03-lis0312.dibs-x.near" });
    const sent = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body));
    expect(sent).toMatchObject({ dry: false, swapType: "EXACT_OUTPUT", recipientType: "DESTINATION_CHAIN", refundTo: good.refundTo, refundType: "ORIGIN_CHAIN", amount: "250000", recipient: "b03-lis0312.dibs-x.near" });
  });

  it("maps a 1Click 400 (minimum) to 422 E_QUOTE_REJECTED", async () => {
    stubFetch(() => new Response(JSON.stringify({ message: "Amount is too low for bridge, try at least 145568" }), { status: 400 }));
    const res = await app.fetch(json("/quote", good), mainnetEnv());
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("E_QUOTE_REJECTED");
  });

  it("1Click 500 becomes E_ONECLICK without leaking upstream text", async () => {
    stubFetch(() => new Response("stack trace secret", { status: 500 }));
    const res = await app.fetch(json("/quote", good), mainnetEnv());
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain("secret");
  });

  it("refuses a receipt account that is missing or has no USDC storage", async () => {
    near.accountExists.mockResolvedValue(false);
    let res = await app.fetch(json("/quote", good), mainnetEnv());
    expect(((await res.json()) as { code: string }).code).toBe("E_RECEIPT_NOT_FOUND");
    near.accountExists.mockResolvedValue(true);
    near.isStorageRegistered.mockResolvedValue(false);
    res = await app.fetch(json("/quote", good), mainnetEnv());
    expect(((await res.json()) as { code: string }).code).toBe("E_RECEIPT_NOT_REGISTERED");
  });

  it("unknown trip is 404 E_TRIP_NOT_FOUND", async () => {
    near.getTrip.mockResolvedValue(undefined);
    const res = await app.fetch(json("/quote", good), mainnetEnv());
    expect(res.status).toBe(404);
  });

  it("dry mode skips chain reads and returns no deposit address", async () => {
    stubFetch(() => new Response(JSON.stringify({ quote: { amountIn: "256994", amountOut: "250000" }, quoteRequest: { recipient: "app.near" } })));
    const res = await app.fetch(json("/quote", { ...good, dry: true, dry_recipient: "app.near" }), mainnetEnv());
    const b = (await res.json()) as { dry: boolean; depositAddress: null };
    expect(b.dry).toBe(true);
    expect(b.depositAddress).toBeNull();
    expect(near.getTrip).not.toHaveBeenCalled();
  });
});
