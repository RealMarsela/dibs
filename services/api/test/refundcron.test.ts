import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRefunds } from "../src/refundcron";
import { makeEnv, type FakeKV } from "./helpers";

const near = vi.hoisted(() => ({ getTrip: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));
const calls = vi.hoisted(() => ({ relayerCall: vi.fn() }));
vi.mock("../src/calls", async (orig) => ({ ...(await orig<typeof import("../src/calls")>()), ...calls }));

const NOW = Date.parse("2026-11-17T10:00:00Z");
const ns = (ms: number) => String(BigInt(ms) * 1_000_000n);
const H = (c: string) => c.repeat(64);
function trip(o: Partial<{ beds: { holder: string | null; status: string }[]; book_by: string; proof: unknown; refunded: boolean; cursor: number; waitlist: { buyer: string; slot: number }[] }> = {}) {
  const beds = o.beds ?? [{ holder: H("a"), status: "Paid" }, { holder: H("b"), status: "Paid" }];
  return { price: "1000000", n_beds: beds.length, book_by: o.book_by ?? ns(NOW - 60_000), refunded: o.refunded ?? false, refund_cursor: o.cursor ?? 0, proof: o.proof ?? null, proof_pending: false, payout: "None", beds, waitlist: o.waitlist ?? [] };
}
async function envWith(codes: string[], over = {}) {
  const env = makeEnv(over);
  for (const c of codes) await (env.NAMES as unknown as FakeKV).put(`trip/${c}`, JSON.stringify({ code: c }));
  return env;
}
const receipts = async (env: ReturnType<typeof makeEnv>, code: string) => ((await env.NAMES.get(`act/${code}`, "json")) as { text: string; tx: string }[] | null) ?? [];

beforeEach(() => {
  near.getTrip.mockReset();
  calls.relayerCall.mockReset().mockImplementation(async () => "TX" + calls.relayerCall.mock.calls.length);
});

describe("deadline refund cron", () => {
  it("refunds a lapsed trip with one receipt per payer and a summary", async () => {
    const env = await envWith(["por1"]);
    near.getTrip.mockResolvedValue(trip());
    expect(await runRefunds(env, NOW)).toEqual([{ trip: "por1", calls: 1, done: true }]);
    expect(calls.relayerCall.mock.calls[0].slice(1, 4)).toEqual([env.DIBS_CONTRACT, "refund_all", { trip: "por1", limit: 3 }]);
    const r = await receipts(env, "por1");
    expect(r.map((x) => x.text)).toEqual(expect.arrayContaining(["Bed 1 refunded $1 to aaaaaa…aaaa", "Bed 2 refunded $1 to bbbbbb…bbbb", "Deadline passed without a verified booking: every paid bed refunded"]));
    expect(r.every((x) => x.tx === "TX1")).toBe(true);
  });
  it("keeps calling while beds remain (3 per call) and pays the waitlist last", async () => {
    const env = await envWith(["big1"]);
    const beds = ["a", "b", "c", "d"].map((c) => ({ holder: H(c), status: "Paid" }));
    near.getTrip
      .mockResolvedValueOnce(trip({ beds, waitlist: [{ buyer: H("e"), slot: 1 }] }))
      .mockResolvedValueOnce(trip({ beds, cursor: 3, waitlist: [{ buyer: H("e"), slot: 1 }] }));
    expect(await runRefunds(env, NOW)).toEqual([{ trip: "big1", calls: 2, done: true }]);
    expect((await receipts(env, "big1")).map((x) => x.text)).toContain("Waitlist #1 refunded $1 to eeeeee…eeee");
  });
  it("skips trips before the deadline, with a proof, already refunded, or owing nothing", async () => {
    const env = await envWith(["t1", "t2", "t3", "t4"]);
    near.getTrip.mockImplementation(async (_e, c: string) =>
      c === "t1" ? trip({ book_by: ns(NOW + 60_000) }) : c === "t2" ? trip({ proof: { total: "1" } }) : c === "t3" ? trip({ refunded: true }) : trip({ beds: [{ holder: H("a"), status: "Held" }, { holder: null, status: "Open" }] }),
    );
    expect(await runRefunds(env, NOW)).toEqual([]);
    expect(calls.relayerCall).not.toHaveBeenCalled();
  });
  it("sweeps the seeded examples only when REFUND_SAMPLES is 1, and never runs on mainnet", async () => {
    near.getTrip.mockResolvedValue(trip());
    expect(await runRefunds(await envWith([]), NOW)).toEqual([]);
    expect((await runRefunds(await envWith([], { REFUND_SAMPLES: "1" }), NOW)).map((r) => r.trip)).toEqual(["lis0312", "lis0314", "drw0001", "sin1025"]);
    calls.relayerCall.mockClear();
    expect(await runRefunds(await envWith(["por1"], { NEAR_NETWORK: "mainnet" }), NOW)).toEqual([]);
    expect(calls.relayerCall).not.toHaveBeenCalled();
  });
});
