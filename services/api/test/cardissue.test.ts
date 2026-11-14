import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { json, makeEnv } from "./helpers";

const near = vi.hoisted(() => ({ relayerAccount: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const call = vi.fn();
const b64 = (o: unknown) => btoa(JSON.stringify(o));
beforeEach(() => {
  resetRateLimits();
  call.mockReset();
  near.relayerAccount.mockReturnValue({ callFunctionRaw: call });
});

describe("POST /card/:trip/issue", () => {
  it("surfaces a TEE refusal as {error, code}", async () => {
    call.mockResolvedValue({ status: { SuccessValue: b64({ error: "bed 2 is not Paid", code: "E_NOT_FULL" }) } });
    const r = await app.fetch(json("/card/lis0312/issue", {}), makeEnv());
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "bed 2 is not Paid", code: "E_NOT_FULL" });
    expect(call.mock.calls[0][0]).toMatchObject({ contractId: "outlayer.testnet", methodName: "request_execution", waitUntil: "FINAL" });
    expect(JSON.parse(call.mock.calls[0][0].args.input_data)).toMatchObject({ op: "card", trip: "lis0312", network: "testnet" });
  });
  it("rejects a result whose signature does not verify", async () => {
    call.mockResolvedValue({ status: { SuccessValue: b64({ message: "dibs-card:v1:{}" + "x".repeat(30), signature: "00".repeat(64) }) } });
    const r = await app.fetch(json("/card/lis0312/issue", {}), makeEnv({ VERIFIER_PUBLIC_KEY: "11".repeat(32) }));
    expect(r.status).toBe(403);
  });
  it("502 when OutLayer fails", async () => {
    call.mockRejectedValue(new Error("boom"));
    const r = await app.fetch(json("/card/lis0312/issue", {}), makeEnv());
    expect(r.status).toBe(502);
    expect(((await r.json()) as { code: string }).code).toBe("E_OUTLAYER_FAILED");
  });
});
