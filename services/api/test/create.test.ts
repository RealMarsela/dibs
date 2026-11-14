import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { makeCode } from "../src/create";
import { clearTripCache } from "../src/trip";
import { KeyPair } from "near-api-js";
import { nep413Hash } from "../src/nep413";
import { json, makeEnv, type FakeR2 } from "./helpers";

const near = vi.hoisted(() => ({ view: vi.fn(), relayerAccount: vi.fn(), accountExists: vi.fn(), nearBalance: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const call = vi.fn();
const transfer = vi.fn();
const BOOKER = "cd".repeat(32);
const DAO = "dao-x.sputnik-v2.testnet";
const soon = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
const good = () => ({ place: "Lisbon", stay: "Alfama flat", check_in: soon(30), check_out: soon(33), beds: 2, price_usdc: 5, booker: BOOKER });
const env = () => makeEnv({ TRIP_DAO: DAO, CF_EMAIL_TOKEN: "tok", CF_ZONE_ID: "zone" });
const post = (body: unknown, e = env(), ip = "1.1.1.1") => {
  const r = json("/trips", body);
  r.headers.set("cf-connecting-ip", ip);
  return app.fetch(r, e);
};
const err = async (r: Response) => (await r.json()) as { error: string; code: string };

beforeEach(() => {
  clearTripCache();
  call.mockReset().mockImplementation(async () => ({ transaction: { hash: "TX" + call.mock.calls.length }, status: { SuccessValue: "" } }));
  transfer.mockReset().mockResolvedValue({ transaction: { hash: "BOOT" }, status: { SuccessValue: "" } });
  near.relayerAccount.mockReturnValue({ callFunctionRaw: call, transfer });
  near.accountExists.mockReset().mockResolvedValue(false);
  near.nearBalance.mockReset().mockResolvedValue(5n * 10n ** 24n);
  near.view.mockReset().mockImplementation(async (_e: unknown, _c: string, m: string) => (m === "create_cost" ? "157740000000000000000000" : undefined));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
});

describe("POST /trips", () => {
  it("creates the trip, holds bed 1, stores meta, adds the inbox rule", async () => {
    const e = env();
    const r = await post(good(), e);
    expect(r.status).toBe(200);
    const b = (await r.json()) as Record<string, string>;
    expect(b.code).toMatch(/^lis[a-z0-9]{5}$/);
    expect(b.url).toBe(`/t/${b.code}`);
    expect(b.inbox).toBe(`${b.code}@dibs.larinova.com`);
    const [create, hold] = call.mock.calls.map((c) => c[0]);
    expect(create).toMatchObject({ methodName: "create_trip", args: { price: "5000000", n_beds: 2, n_wait: 2, dao: DAO, booker: BOOKER } });
    expect(BigInt(create.deposit)).toBe(157740000000000000000000n + 2n * 10n ** 22n);
    expect(hold).toMatchObject({ methodName: "hold", args: { trip: b.code, n: 1, holder: BOOKER } });
    const meta = await app.fetch(new Request(`http://api.test/trips/${b.code}/meta`), e);
    expect(await meta.json()).toEqual({ place: "Lisbon", stay: "Alfama flat" });
  });
  it("trip view carries meta", async () => {
    const e = env();
    const b = (await (await post(good(), e)).json()) as { code: string };
    near.view.mockImplementation(async (_e: unknown, _c: string, m: string) => (m === "get_trip" ? { price: "5000000", n_beds: 2 } : []));
    const t = (await (await app.fetch(new Request(`http://api.test/trip/${b.code}`), e)).json()) as { meta: unknown };
    expect(t.meta).toEqual({ place: "Lisbon", stay: "Alfama flat" });
  });
  it("inbox is null without the token or when Cloudflare refuses", async () => {
    const r1 = await post(good(), makeEnv({ TRIP_DAO: DAO }));
    expect(((await r1.json()) as { inbox: unknown }).inbox).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 403 })));
    const r2 = await post(good(), env(), "2.2.2.2");
    expect(((await r2.json()) as { inbox: unknown }).inbox).toBeNull();
  });
  it.each([
    ["short place", { place: "a" }], ["long stay", { stay: "x".repeat(61) }], ["bad date", { check_in: "2027-13-01" }],
    ["out before in", { check_out: soon(20) }], ["past", { check_in: "2020-01-01", check_out: "2020-01-03" }],
    ["too far", { check_in: soon(900), check_out: soon(903) }], ["1 bed", { beds: 1 }], ["7 beds", { beds: 7 }],
    ["price 0", { price_usdc: 0 }], ["price 51", { price_usdc: 51 }], ["fractional price", { price_usdc: 2.5 }],
    ["bad booker", { booker: "Maya Q" }], ["extra key", { dao: "evil.testnet" }], ["markup", { place: "<b>Lisbon</b>" }],
  ])("rejects %s with E_BAD_INPUT and sends nothing", async (_n, over) => {
    const r = await post({ ...good(), ...over });
    expect(r.status).toBe(400);
    expect((await err(r)).code).toBe("E_BAD_INPUT");
    expect(call).not.toHaveBeenCalled();
  });
  it("named booker without auth is refused with 401 E_AUTH_REQUIRED and sends nothing", async () => {
    const r = await post({ ...good(), booker: "maya.testnet" });
    expect(r.status).toBe(401);
    expect((await err(r)).code).toBe("E_AUTH_REQUIRED");
    expect(call).not.toHaveBeenCalled();
  });
  it("named booker with a proof for a different account is 401 E_AUTH_ACCOUNT", async () => {
    const e = env();
    const auth = { accountId: "eve.testnet", publicKey: "ed25519:" + "1".repeat(44), signature: "A".repeat(86) + "==", nonce: "00".repeat(32), message: "Start a Dibs trip as the booker" };
    const r = await post({ ...good(), booker: "maya.testnet", auth }, e);
    expect(r.status).toBe(401); // no nonce stored: refused before any chain write
    expect(call).not.toHaveBeenCalled();
  });
  it("named booker with a valid proof creates the trip without bootstrapping an implicit account", async () => {
    const kp = KeyPair.fromRandom("ed25519");
    const nonce = "cd".repeat(32);
    const message = "Start a Dibs trip as the booker";
    const sig = kp.sign(await nep413Hash(message, nonce)).signature;
    const auth = { accountId: "maya.testnet", publicKey: kp.getPublicKey().toString(), signature: btoa(String.fromCharCode(...sig)), nonce, message };
    const e = env();
    await (e.BLOBS as unknown as FakeR2).put(`auth/nonce/${nonce}`, JSON.stringify({ created_at: Date.now() }));
    near.accountExists.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) =>
      new Response(JSON.stringify(String(init?.body).includes("view_access_key") ? { result: { nonce: 1, permission: "FullAccess" } } : { success: true }))));
    const r = await post({ ...good(), booker: "maya.testnet", auth }, e);
    expect(r.status).toBe(200);
    expect(transfer).not.toHaveBeenCalled();
    const [create, hold] = call.mock.calls.map((c) => c[0]);
    expect(create.args.booker).toBe("maya.testnet");
    expect(hold.args.holder).toBe("maya.testnet");
    // The nonce is single use.
    expect((await err(await post({ ...good(), booker: "maya.testnet", auth }, e, "3.3.3.3"))).code).toBe("E_AUTH_NONCE");
  });
  it("503 E_NOT_CONFIGURED without a DAO", async () => {
    expect((await err(await post(good(), makeEnv()))).code).toBe("E_NOT_CONFIGURED");
  });
  it("refuses with E_RELAYER_LOW under 1 NEAR and does not use up the quota", async () => {
    near.nearBalance.mockResolvedValue(9n * 10n ** 23n);
    const e = env();
    const r = await post(good(), e);
    expect(r.status).toBe(503);
    expect((await err(r)).code).toBe("E_RELAYER_LOW");
    expect(call).not.toHaveBeenCalled();
    near.nearBalance.mockResolvedValue(5n * 10n ** 24n);
    expect((await post(good(), e)).status).toBe(200);
  });
  it("2 trips per IP per day, then 429; another IP still works", async () => {
    const e = env();
    expect((await post(good(), e)).status).toBe(200);
    expect((await post(good(), e)).status).toBe(200);
    const r = await post(good(), e);
    expect(r.status).toBe(429);
    expect((await err(r)).code).toBe("E_RATE_LIMIT");
    expect(call).toHaveBeenCalledTimes(4);
    expect((await post(good(), e, "9.9.9.9")).status).toBe(200);
  });
  it("20 trips per day globally, then E_DAILY_CAP", async () => {
    const e = env();
    for (let i = 0; i < 20; i++) expect((await post(good(), e, `10.0.0.${i}`)).status).toBe(200);
    const r = await post(good(), e, "10.0.1.1");
    expect(r.status).toBe(429);
    expect((await err(r)).code).toBe("E_DAILY_CAP");
  });
  it("502 E_CREATE_FAILED when the contract call fails, no hold sent", async () => {
    call.mockRejectedValueOnce(new Error("boom"));
    const r = await post(good());
    expect(r.status).toBe(502);
    expect((await err(r)).code).toBe("E_CREATE_FAILED");
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("meta and codes", () => {
  it("404 for a trip without meta, 400 for a bad code", async () => {
    expect((await app.fetch(new Request("http://api.test/trips/lis0312/meta"), env())).status).toBe(404);
    expect((await app.fetch(new Request("http://api.test/trips/NO!/meta"), env())).status).toBe(400);
  });
  it("code is 3 place letters plus 5 random, accents folded, short places padded", () => {
    expect(makeCode("São Paulo")).toMatch(/^sao[a-z0-9]{5}$/);
    expect(makeCode("Rio")).toMatch(/^rio[a-z0-9]{5}$/);
    expect(makeCode("京都")).toMatch(/^xxx[a-z0-9]{5}$/);
    expect(new Set(Array.from({ length: 50 }, () => makeCode("Lisbon"))).size).toBeGreaterThan(45);
  });
});
