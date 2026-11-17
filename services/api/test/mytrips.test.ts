import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { indexAccount, mergeEntry } from "../src/acctindex";
import { tripStatus } from "../src/mytrips";
import { makeEnv, type FakeKV } from "./helpers";

const near = vi.hoisted(() => ({ getTrip: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const A = "a".repeat(64);
const B = "0x" + "b".repeat(40);
const chainTrip = (paid: number, extra = {}) => ({
  price: "1000000", n_beds: 2, book_by: String(Date.parse("2026-12-01T00:00:00Z") * 1_000_000), check_in: "2026-12-11", check_out: "2026-12-13",
  beds: [{ status: paid > 0 ? "Paid" : "Held" }, { status: paid > 1 ? "Paid" : "Open" }], ...extra,
});
const get = (q: string, env = makeEnv()) => app.fetch(new Request(`http://api.test/my-trips?accounts=${q}`), env);

beforeEach(() => {
  resetRateLimits();
  near.getTrip.mockReset().mockImplementation(async (_e, code: string) => (code === "kyo1" ? chainTrip(2) : chainTrip(1)));
});

describe("account index", () => {
  it("merges roles for one trip and keeps the first time", () => {
    const a = mergeEntry(null, { role: "booker" }, "testnet", "t1");
    const b = mergeEntry(a, { role: "bed", n: 1 }, "testnet", "t2");
    expect(b).toMatchObject({ role: "booker", at: "t1", roles: [{ role: "booker" }, { role: "bed", n: 1 }] });
    expect(mergeEntry(b, { role: "bed", n: 1 }, "testnet", "t3").roles).toHaveLength(2);
  });
  it("never fails the caller when KV throws", async () => {
    const env = makeEnv({ NAMES: { get: async () => { throw new Error("kv down"); } } as unknown as KVNamespace });
    await expect(indexAccount(env, A, "kyo1", { role: "booker" })).resolves.toBeUndefined();
  });
});

describe("GET /my-trips", () => {
  it("validates 1 to 3 well-formed accounts", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("not an id!")).status).toBe(400);
    expect((await get([A, B, "x.testnet", "y.testnet"].join(","))).status).toBe(400);
  });
  it("merges trips across accounts, newest first, with chain status", async () => {
    const env = makeEnv();
    const kv = env.NAMES as unknown as FakeKV;
    await kv.put("trip/kyo1", JSON.stringify({ code: "kyo1", place: "Kyoto", stay: "Machiya", created_at: "2026-11-15T01:00:00Z", creator: A }));
    await kv.put("trip/por1", JSON.stringify({ code: "por1", place: "Porto", stay: "Loft", created_at: "2026-11-14T01:00:00Z", creator: A }));
    await indexAccount(env, A, "por1", { role: "booker" });
    await indexAccount(env, A, "kyo1", { role: "booker" });
    await indexAccount(env, B, "kyo1", { role: "bed", n: 2 });
    const r = await get(`${A},${B}`, env);
    expect(r.status).toBe(200);
    const { trips } = (await r.json()) as { trips: { code: string; place: string; status: string; paid: number; roles: unknown[] }[] };
    expect(trips.map((t) => t.code)).toEqual(["kyo1", "por1"]);
    expect(trips[0]).toMatchObject({ place: "Kyoto", status: "all_paid", paid: 2, roles: [{ role: "booker" }, { role: "bed", n: 2 }] });
    expect(trips[1]).toMatchObject({ place: "Porto", status: "filling", paid: 1 });
  });
  it("is an empty list for an account with no trips, and 503 when the index is down", async () => {
    expect(((await (await get(A)).json()) as { trips: unknown[] }).trips).toEqual([]);
    const down = makeEnv({ NAMES: { list: async () => { throw new Error("kv down"); } } as unknown as KVNamespace });
    expect((await get(A, down)).status).toBe(503);
  });
  it("reads status in contract order", () => {
    expect(tripStatus({ refunded: true, payout: "Done", beds: [] })).toBe("refunded");
    expect(tripStatus({ refunded: false, payout: "Done", beds: [{ status: "Paid" }] })).toBe("booked");
    expect(tripStatus({ refunded: false, payout: "None", beds: [{ status: "Paid" }, { status: "Held" }] })).toBe("filling");
  });
});
