import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { interpretRun } from "../src/cardrun";
import { json, makeEnv } from "./helpers";

const run = vi.hoisted(() => ({ submitCardOp: vi.fn(), checkCardRun: vi.fn() }));
vi.mock("../src/cardrun", async (orig) => ({ ...(await orig<typeof import("../src/cardrun")>()), ...run }));

const app = createApp();
const b64 = (o: unknown) => btoa(JSON.stringify(o));
const issue = (env: ReturnType<typeof makeEnv>) => app.fetch(json("/card/lis0312/issue", {}), env);
beforeEach(() => {
  resetRateLimits();
  run.submitCardOp.mockReset().mockResolvedValue("TX1");
  run.checkCardRun.mockReset();
});

describe("POST /card/:trip/issue (submit, then poll)", () => {
  it("starts one TEE run and answers 202; a poll while it runs does not start another", async () => {
    const env = makeEnv();
    const a = await issue(env);
    expect(a.status).toBe(202);
    expect(await a.json()).toMatchObject({ pending: true, runs: 1, tx: "TX1" });
    run.checkCardRun.mockResolvedValue({ state: "pending" });
    expect((await issue(env)).status).toBe(202);
    expect(run.submitCardOp).toHaveBeenCalledTimes(1);
    expect(run.checkCardRun).toHaveBeenCalledWith(expect.anything(), "TX1");
  });
  it("resubmits a run that timed out, and gives up with E_OUTLAYER_BUSY after 4 runs", async () => {
    const env = makeEnv();
    await issue(env);
    run.checkCardRun.mockResolvedValue({ state: "failed" });
    for (let i = 2; i <= 4; i++) {
      run.submitCardOp.mockResolvedValueOnce(`TX${i}`);
      const r = await issue(env);
      expect(await r.json()).toMatchObject({ pending: true, runs: i, tx: `TX${i}` });
      resetRateLimits();
    }
    const r = await issue(env);
    expect(r.status).toBe(503);
    expect(((await r.json()) as { code: string }).code).toBe("E_OUTLAYER_BUSY");
  });
  it("surfaces a TEE refusal as {error, code} and clears the run", async () => {
    const env = makeEnv();
    await issue(env);
    run.checkCardRun.mockImplementation(async () => interpretRun({ status: { SuccessValue: b64({ error: "bed 2 is not Paid", code: "E_NOT_FULL" }) } }));
    const r = await issue(env);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "bed 2 is not Paid", code: "E_NOT_FULL" });
    run.checkCardRun.mockReset();
    expect((await issue(env)).status).toBe(202); // a fresh run, not the refused one
  });
  it("rejects a finished result whose signature does not verify", async () => {
    const env = makeEnv({ VERIFIER_PUBLIC_KEY: "11".repeat(32) });
    await issue(env);
    run.checkCardRun.mockResolvedValue({ state: "done", message: "dibs-card:v1:{}" + "x".repeat(30), signature: "00".repeat(64) });
    expect((await issue(env)).status).toBe(403);
  });
  it("502 when the run cannot be started", async () => {
    const { ApiError } = await import("../src/errors");
    run.submitCardOp.mockRejectedValue(new ApiError(502, "E_OUTLAYER_FAILED", "could not start the card op on OutLayer"));
    const r = await issue(makeEnv());
    expect(r.status).toBe(502);
    expect(((await r.json()) as { code: string }).code).toBe("E_OUTLAYER_FAILED");
  });
});

describe("interpretRun", () => {
  it("reads in-flight, timed-out, failed and finished runs", () => {
    expect(interpretRun({ status: "Started" })).toEqual({ state: "pending" });
    expect(interpretRun({ final_execution_status: "INCLUDED" })).toEqual({ state: "pending" });
    expect(interpretRun({ status: { SuccessValue: btoa("null") } })).toEqual({ state: "failed" });
    expect(interpretRun({ status: { Failure: {} } })).toEqual({ state: "failed" });
    expect(interpretRun({ status: { SuccessValue: b64({ message: "m", signature: "s" }) } })).toEqual({ state: "done", message: "m", signature: "s" });
  });
});
