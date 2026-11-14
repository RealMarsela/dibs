import { afterEach, describe, expect, it, vi } from "vitest";
import { view } from "../src/near";
import { makeEnv } from "./helpers";

const rpc = (result: unknown) => vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result })));
const bytes = (v: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(v)));
afterEach(() => vi.unstubAllGlobals());

describe("view over raw RPC", () => {
  it("decodes a JSON result", async () => {
    vi.stubGlobal("fetch", rpc({ result: bytes({ n_beds: 2 }) }));
    expect(await view(makeEnv(), "d.testnet", "get_trip", { trip: "x" })).toEqual({ n_beds: 2 });
  });
  it("maps an E_NO_TRIP panic to undefined, other panics to E_RPC", async () => {
    vi.stubGlobal("fetch", rpc({ error: 'GuestPanic { panic_msg: "E_NO_TRIP" }' }));
    expect(await view(makeEnv(), "d.testnet", "get_trip", { trip: "x" })).toBeUndefined();
    vi.stubGlobal("fetch", rpc({ error: 'GuestPanic { panic_msg: "E_OTHER" }' }));
    await expect(view(makeEnv(), "d.testnet", "get_trip", { trip: "x" })).rejects.toMatchObject({ code: "E_RPC" });
  });
  it("fails over to the next RPC when the first is down", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(new Response(JSON.stringify({ result: { result: bytes("40000000") } })));
    vi.stubGlobal("fetch", f);
    expect(await view(makeEnv({ NEAR_RPC_URLS: "https://a.test,https://b.test" }), "d.testnet", "create_cost", {})).toBe("40000000");
    expect(f).toHaveBeenCalledTimes(2);
  });
});
