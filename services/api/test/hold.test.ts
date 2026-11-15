import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { json, makeEnv, DIBS } from "./helpers";

const near = vi.hoisted(() => ({ getTrip: vi.fn(), ftBalance: vi.fn(), relayerAccount: vi.fn(), accountExists: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const call = vi.fn();
const ALICE = "alice-x.testnet";
const BOB = "bob-x.testnet";
const post = (body: unknown, ip = "9.9.9.9") => {
  const r = json("/hold", body);
  r.headers.set("cf-connecting-ip", ip);
  return app.fetch(r, makeEnv());
};
const err = async (r: Response) => (await r.json()) as { error: string; code: string };
const wait = (holder: string, n = 1) => ({ trip: "lis0312", kind: "wait", n, holder });
const trip = (wait_res: (string | null)[]) => ({ price: "5000000", n_beds: 2, wait_res });

beforeEach(() => {
  call.mockReset().mockResolvedValue({ transaction: { hash: "TXHOLD" }, status: { SuccessValue: "" } });
  near.relayerAccount.mockReturnValue({ callFunctionRaw: call });
  near.accountExists.mockReset().mockResolvedValue(true);
  near.getTrip.mockReset().mockResolvedValue(trip([null, null]));
  near.ftBalance.mockReset().mockResolvedValue(0n);
});

describe("POST /hold waitlist slot guard", () => {
  it("reserves a free slot without reading any balance", async () => {
    const r = await post(wait(ALICE));
    expect(r.status).toBe(200);
    expect(near.ftBalance).not.toHaveBeenCalled();
    expect(call.mock.calls[0][0]).toMatchObject({ methodName: "reserve_wait", args: { trip: "lis0312", slot: 1, buyer: ALICE } });
  });
  it("refuses 409 E_SLOT_PAYING when USDC sits in the slot receipt account of another reserver", async () => {
    near.getTrip.mockResolvedValue(trip([ALICE, null]));
    near.ftBalance.mockResolvedValue(5_000_000n);
    const r = await post(wait(BOB));
    expect(r.status).toBe(409);
    expect((await err(r)).code).toBe("E_SLOT_PAYING");
    expect(near.ftBalance).toHaveBeenCalledWith(expect.anything(), `w01-lis0312.${DIBS}`);
    expect(call).not.toHaveBeenCalled();
  });
  it("checks the receipt account of the requested slot", async () => {
    near.getTrip.mockResolvedValue(trip([null, ALICE]));
    near.ftBalance.mockResolvedValue(1n);
    const r = await post(wait(BOB, 2));
    expect(r.status).toBe(409);
    expect(near.ftBalance).toHaveBeenCalledWith(expect.anything(), `w02-lis0312.${DIBS}`);
  });
  it("lets the contract decide when another reserver holds an empty receipt account", async () => {
    near.getTrip.mockResolvedValue(trip([ALICE, null]));
    const r = await post(wait(BOB));
    expect(r.status).toBe(200);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("does not guard the current reserver re-reserving their own slot", async () => {
    near.getTrip.mockResolvedValue(trip([ALICE, null]));
    near.ftBalance.mockResolvedValue(5_000_000n);
    const r = await post(wait(ALICE));
    expect(r.status).toBe(200);
    expect(near.ftBalance).not.toHaveBeenCalled();
  });
  it("never guards bed holds", async () => {
    const r = await post({ trip: "lis0312", kind: "bed", n: 1, holder: BOB });
    expect(r.status).toBe(200);
    expect(near.getTrip).not.toHaveBeenCalled();
    expect(near.ftBalance).not.toHaveBeenCalled();
  });
  it("keeps the { error, code } shape on a contract refusal", async () => {
    near.getTrip.mockResolvedValue(trip([ALICE, null]));
    call.mockRejectedValue(new Error("E_SLOT_TAKEN"));
    const r = await post(wait(BOB));
    expect(r.status).toBe(502);
    expect(await err(r)).toMatchObject({ code: "E_HOLD_FAILED" });
  });
});
