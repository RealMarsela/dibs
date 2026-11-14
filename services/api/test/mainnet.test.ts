import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { mainnetAllowed, mainnetEnv } from "../src/mainnet";
import { json, makeEnv } from "./helpers";

const MAIN = {
  MAINNET_RPC_URLS: "https://rpc.mainnet.invalid",
  MAINNET_DIBS_CONTRACT: "dibsapp.near",
  MAINNET_USDC_CONTRACT: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  MAINNET_RELAYER_ACCOUNT_ID: "relayer.dibsapp.near",
  MAINNET_RELAYER_PRIVATE_KEY: "",
};
const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext;
const call = (req: Request, env: Parameters<typeof worker.fetch>[1] = { ...makeEnv(), ...MAIN }) => worker.fetch(req, env, ctx);
const code = async (res: Response) => ((await res.json()) as { code?: string }).code;

describe("mainnet path", () => {
  it("swaps every network value and drops testnet-only secrets", () => {
    const m = mainnetEnv({ ...makeEnv({ TRIP_DAO: "lis.sputnik-v2.testnet", LITHIC_SIM_KEY: "x" }), ...MAIN })!;
    expect(m.NEAR_NETWORK).toBe("mainnet");
    expect(m.DIBS_CONTRACT).toBe("dibsapp.near");
    expect(m.RELAYER_ACCOUNT_ID).toBe("relayer.dibsapp.near");
    expect(m.TRIP_DAO).toBeUndefined();
    expect(m.LITHIC_SIM_KEY).toBeUndefined();
  });

  it("is unconfigured without the mainnet vars", async () => {
    const res = await call(new Request("http://api.test/mainnet/health"), makeEnv());
    expect(res.status).toBe(503);
    expect(await code(res)).toBe("E_MAINNET_UNCONFIGURED");
  });

  it("serves health as mainnet", async () => {
    const res = await call(new Request("http://api.test/mainnet/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ network: "mainnet", contract: "dibsapp.near" });
  });

  it("refuses everything that would spend NEAR outside the pay-in", async () => {
    for (const [path, body] of [
      ["/mainnet/trips", { place: "x" }],
      ["/mainnet/draw", { trip: "lismain" }],
      ["/mainnet/refund-check", { trip: "lismain", n: 1 }],
      ["/mainnet/relay", { signed_delegate: "x" }],
      ["/mainnet/account/bootstrap", { account: "a".repeat(64) }],
      ["/mainnet/testnet/fund", { trip: "lismain", kind: "bed", n: 1 }],
      ["/mainnet/proof/submit", { trip: "lismain" }],
    ] as const) {
      const res = await call(json(path, body));
      expect(res.status, path).toBe(403);
      expect(await code(res), path).toBe("E_MAINNET_SCOPE");
    }
  });

  it("allows only the pay-in routes", () => {
    expect(mainnetAllowed("POST", "/quote")).toBe(true);
    expect(mainnetAllowed("POST", "/hold")).toBe(true);
    expect(mainnetAllowed("GET", "/status/0xabc")).toBe(true);
    expect(mainnetAllowed("GET", "/trip/lismain")).toBe(true);
    expect(mainnetAllowed("POST", "/card/lismain/issue")).toBe(false);
    expect(mainnetAllowed("GET", "/blob/abc")).toBe(false);
  });

  it("leaves testnet paths untouched", async () => {
    const res = await call(new Request("http://api.test/health"));
    expect(await res.json()).toMatchObject({ network: "testnet" });
  });
});
