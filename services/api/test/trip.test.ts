import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { clearTripCache } from "../src/trip";
import { makeEnv } from "./helpers";

const near = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
beforeEach(() => {
  clearTripCache();
  near.view.mockReset().mockImplementation(async (_e: unknown, _c: string, m: string) => (m === "get_trip" ? { price: "250000", n_beds: 2 } : []));
});

describe("GET /trip/:code", () => {
  it("merges trip, waitlist and bed accounts, and caches for 2 s", async () => {
    const env = makeEnv();
    const r1 = await app.fetch(new Request("http://api.test/trip/lis0312"), env);
    const b = (await r1.json()) as { bed_accounts: string[]; trip: { price: string } };
    expect(b.bed_accounts).toEqual(["b01-lis0312.dibs-x.testnet", "b02-lis0312.dibs-x.testnet"]);
    expect(r1.headers.get("cache-control")).toBe("public, max-age=2");
    await app.fetch(new Request("http://api.test/trip/lis0312"), env);
    expect(near.view).toHaveBeenCalledTimes(2); // get_trip + get_waitlist once only
  });
  it("404 for unknown trip, 400 for bad code", async () => {
    near.view.mockResolvedValue(undefined);
    expect((await app.fetch(new Request("http://api.test/trip/nopetrip"), makeEnv())).status).toBe(404);
    const bad = await app.fetch(new Request("http://api.test/trip/NO!"), makeEnv());
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { code: string }).code).toBe("E_BAD_INPUT");
  });
});
