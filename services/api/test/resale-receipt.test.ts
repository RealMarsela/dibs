import { describe, expect, it, vi } from "vitest";
import { actions } from "near-api-js";
import { createApp } from "../src/index";
import { DIBS, json, makeEnv, signedDelegateB64 } from "./helpers";
const near = vi.hoisted(() => ({ provider: vi.fn(), relayerAccount: vi.fn(), getTrip: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));
describe("resale receipt", () => {
  it("a relayed list_for_resale writes a receipt (delegate args decode as a plain array)", async () => {
    near.provider.mockReturnValue({ viewBlock: async () => ({ header: { height: 1 } }) });
    near.relayerAccount.mockReturnValue({ relayMetaTransaction: vi.fn().mockResolvedValue({ transaction: { hash: "RTX" }, status: { SuccessValue: "" } }) });
    near.getTrip.mockResolvedValue({ beds: [{ status: "Paid" }, { status: "Paid" }] });
    const env = makeEnv();
    const sd = await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale", actionList: [actions.functionCall("list_for_resale", { trip: "lyo1", n: 2 }, 30_000_000_000_000n, 0n)] });
    const r = await createApp().fetch(json("/relay", { signed_delegate: sd }), env);
    expect(r.status).toBe(200);
    expect(await env.NAMES.get("act/lyo1", "json")).toEqual([expect.objectContaining({ kind: "resale", text: "Bed 2 resold at face value to the waitlist", tx: "RTX" })]);
  });
});
