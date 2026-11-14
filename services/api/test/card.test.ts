import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { FakeR2, json, makeEnv, stubFetch } from "./helpers";

const app = createApp();
const TOKEN = "a2a6aa00-0c34-491b-9f8a-d762c5e28c3e";
const SEALED = "ab".repeat(120);
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

// Same bytes the Rust verifier signs (outlayer/verifier/src/card.rs card_message).
const message = (over: Record<string, unknown> = {}) => {
  const f = { trip: "lis0312", card_token: TOKEN, last4: "8087", spend_limit: 100000, mcc: "7011", sealed_hex: SEALED, ...over };
  return "dibs-card:v1:" + JSON.stringify(f);
};

let keys: CryptoKeyPair;
let pub: string;
const sign = async (m: string, k = keys.privateKey) => hex(await crypto.subtle.sign({ name: "Ed25519" }, k, new TextEncoder().encode(m)));
const envFor = () => makeEnv({ VERIFIER_PUBLIC_KEY: pub, LITHIC_SIM_KEY: "sim-key", LITHIC_BASE: "https://lithic.test" });
const issue = async (env = envFor(), m = message(), sig?: string, trip = "lis0312") =>
  app.fetch(json(`/card/${trip}/issued`, { message: m, signature: sig ?? (await sign(m)) }), env);

beforeEach(async () => {
  resetRateLimits();
  keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  pub = hex((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer);
});

describe("POST /card/:trip/issued", () => {
  it("stores a message signed by the pinned verifier key and serves it back without the card token", async () => {
    const env = envFor();
    const r = await issue(env);
    expect(r.status).toBe(200);
    const g = await app.fetch(new Request("http://api.test/card/lis0312"), env);
    const b = (await g.json()) as Record<string, unknown>;
    expect(b).toMatchObject({ last4: "8087", spend_limit: 100000, mcc: "7011", sealed_hex: SEALED, simulations: [] });
    expect(typeof b.issued_at).toBe("string");
    expect(JSON.stringify(b)).not.toContain(TOKEN);
  });
  it("refuses a forged signature, a foreign key, a tampered message and a wrong prefix", async () => {
    const env = envFor();
    const other = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const m = message();
    expect((await issue(env, m, await sign(m, other.privateKey))).status).toBe(403);
    expect((await issue(env, message({ spend_limit: 999999 }), await sign(m))).status).toBe(403);
    const wrong = "dibs-vrf:v1:" + m.slice(13);
    const r = await issue(env, wrong, await sign(wrong));
    expect(((await r.json()) as { code: string }).code).toBe("E_BAD_PREFIX");
    expect((await app.fetch(new Request("http://api.test/card/lis0312"), env)).status).toBe(404);
  });
  it("refuses a message for another trip, even if validly signed", async () => {
    const r = await issue(envFor(), message({ trip: "other99" }));
    expect(((await r.json()) as { code: string }).code).toBe("E_TRIP_MISMATCH");
  });
  it("is idempotent for the same card and 409 for a different one", async () => {
    const env = envFor();
    await issue(env);
    expect((await issue(env)).status).toBe(200);
    expect(((await (await issue(env)).json()) as { stored: boolean }).stored).toBe(false);
    const r = await issue(env, message({ card_token: "b2a6aa00-0c34-491b-9f8a-d762c5e28c3e" }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe("E_CARD_EXISTS");
  });
  it("503 when the verifier key is not configured, 400 on bad shapes", async () => {
    expect((await issue(makeEnv())).status).toBe(503);
    const bad = await app.fetch(json("/card/lis0312/issued", { message: "x", signature: "y" }), envFor());
    expect(bad.status).toBe(400);
    expect((await app.fetch(json("/card/NO!/issued", {}), envFor())).status).toBe(400);
  });
});

describe("POST /card/:trip/simulate", () => {
  const lithic = (declineMcc: string | null) =>
    stubFetch((url, init) => {
      const auth = new Headers(init?.headers).get("authorization");
      expect(auth).toBe("sim-key");
      if (url.endsWith(`/v1/cards/${TOKEN}`)) return Response.json({ token: TOKEN, pan: "4111111111118087" });
      if (url.endsWith("/v1/simulate/authorize")) {
        const b = JSON.parse(String(init?.body)) as { mcc: string; amount: number; descriptor: string };
        expect(b.amount).toBe(100000);
        expect(b.descriptor.length).toBeLessThanOrEqual(25);
        return Response.json({ token: `txn-${b.mcc}`, debugging_request_id: "req-1" }, { status: 201, headers: { "x-correlation-id": `corr-${b.mcc}` } });
      }
      const mcc = url.split("txn-")[1];
      const declined = mcc === declineMcc;
      return Response.json({ result: declined ? "DECLINED" : "APPROVED", events: [{ result: declined ? "DECLINED" : "APPROVED", rule_results: declined ? [{ result: "PROGRAM_USAGE_RESTRICTION" }] : [] }] });
    });

  it("hotel approves, electronics declines, results are stored in simulations[]", async () => {
    const env = envFor();
    await issue(env);
    lithic("5732");
    const h = (await (await app.fetch(json("/card/lis0312/simulate", { merchant: "carlton" }), env)).json()) as Record<string, unknown>;
    expect(h).toMatchObject({ approved: true, result: "APPROVED", mcc: "7011", lithic_request_id: "corr-7011" });
    const e = (await (await app.fetch(json("/card/lis0312/simulate", { merchant: "electronics" }), env)).json()) as Record<string, unknown>;
    expect(e).toMatchObject({ approved: false, result: "DECLINED", reason: "PROGRAM_USAGE_RESTRICTION", mcc: "5732" });
    const g = (await (await app.fetch(new Request("http://api.test/card/lis0312"), env)).json()) as { simulations: unknown[] };
    expect(g.simulations).toHaveLength(2);
  });
  it("never returns or stores the card number", async () => {
    const env = envFor();
    await issue(env);
    lithic(null);
    const text = await (await app.fetch(json("/card/lis0312/simulate", { merchant: "carlton" }), env)).text();
    expect(text).not.toContain("4111111111118087");
    expect((env.BLOBS as unknown as FakeR2).store.get("cards/lis0312.json")).not.toContain("4111111111118087");
  });
  it("404 without a card, 503 without a sim key, 400 on an unknown merchant, 502 when the issuer fails", async () => {
    const env = envFor();
    expect((await app.fetch(json("/card/lis0312/simulate", { merchant: "carlton" }), env)).status).toBe(404);
    await issue(env);
    expect((await app.fetch(json("/card/lis0312/simulate", { merchant: "casino" }), env)).status).toBe(400);
    const nokey = makeEnv({ VERIFIER_PUBLIC_KEY: pub });
    (nokey.BLOBS as unknown as FakeR2).store = (env.BLOBS as unknown as FakeR2).store;
    expect((await app.fetch(json("/card/lis0312/simulate", { merchant: "carlton" }), nokey)).status).toBe(503);
    stubFetch(() => new Response("boom", { status: 500 }));
    const r = await app.fetch(json("/card/lis0312/simulate", { merchant: "carlton" }), env);
    expect(r.status).toBe(502);
    expect(((await r.json()) as { code: string }).code).toBe("E_ISSUER");
  });
});
