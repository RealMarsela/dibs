import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions } from "near-api-js";
import { createApp } from "../src/index";
import { resetRateLimits } from "../src/ratelimit";
import { DIBS, json, makeEnv, signedDelegateB64 } from "./helpers";

const near = vi.hoisted(() => ({ provider: vi.fn(), relayerAccount: vi.fn() }));
vi.mock("../src/near", async (orig) => ({ ...(await orig<typeof import("../src/near")>()), ...near }));

const app = createApp();
const relayMetaTransaction = vi.fn();
const relay = async (b64: string) => app.fetch(json("/relay", { signed_delegate: b64 }), makeEnv());
const code = async (r: Response) => ((await r.json()) as { code: string }).code;

beforeEach(() => {
  resetRateLimits();
  relayMetaTransaction.mockReset().mockResolvedValue({ transaction: { hash: "RELAYTX" }, status: { SuccessValue: "" } });
  near.relayerAccount.mockReturnValue({ relayMetaTransaction });
  near.provider.mockReturnValue({ viewBlock: async () => ({ header: { height: 1000 } }) });
});

describe("POST /relay policy", () => {
  it("forwards an allowlisted call to the dibs contract", async () => {
    const res = await relay(await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale" }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { tx_hash: string }).tx_hash).toBe("RELAYTX");
    expect(relayMetaTransaction).toHaveBeenCalledTimes(1);
  });

  it("forwards sweep to a bed account", async () => {
    const res = await relay(await signedDelegateB64({ receiverId: `b03-lis0312.${DIBS}`, method: "sweep" }));
    expect(res.status).toBe(200);
  });

  for (const receiver of ["usdc-x.testnet", "attacker.testnet", `evil.${DIBS}`, "dibs-x.near", `b03-lis0312.${DIBS}.evil`]) {
    it(`refuses non-allowlisted receiver ${receiver}`, async () => {
      const res = await relay(await signedDelegateB64({ receiverId: receiver, method: "sweep" }));
      expect(res.status).toBe(403);
      expect(await code(res)).toBe("E_RECEIVER_NOT_ALLOWED");
      expect(relayMetaTransaction).not.toHaveBeenCalled();
    });
  }

  for (const [receiver, method] of [[DIBS, "create_trip"], [DIBS, "set_verifier_key"], [DIBS, "add_relayer"], [DIBS, "ft_on_transfer"], [`b03-lis0312.${DIBS}`, "hold"], [DIBS, "sweep"]]) {
    it(`refuses method ${method} on ${receiver}`, async () => {
      const res = await relay(await signedDelegateB64({ receiverId: receiver, method }));
      expect(res.status).toBe(403);
      expect(await code(res)).toBe("E_METHOD_NOT_ALLOWED");
      expect(relayMetaTransaction).not.toHaveBeenCalled();
    });
  }

  it("refuses non-function-call actions (transfer, add key)", async () => {
    const b64 = await signedDelegateB64({ receiverId: DIBS, method: "x", actionList: [actions.transfer(1n) as never] });
    const res = await relay(b64);
    expect(await code(res)).toBe("E_ACTION_NOT_ALLOWED");
  });

  it("refuses a smuggled second action", async () => {
    const b64 = await signedDelegateB64({
      receiverId: DIBS, method: "x",
      actionList: [actions.functionCall("list_for_resale", {}, 30n, 0n), actions.functionCall("set_verifier_key", {}, 30n, 0n)],
    });
    expect(await code(await relay(b64))).toBe("E_METHOD_NOT_ALLOWED");
  });

  it("refuses deposits above the per-method cap and gas above the cap", async () => {
    expect(await code(await relay(await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale", deposit: 1n })))).toBe("E_DEPOSIT_NOT_ALLOWED");
    expect(await code(await relay(await signedDelegateB64({ receiverId: DIBS, method: "submit_proof", deposit: 10n ** 24n })))).toBe("E_DEPOSIT_NOT_ALLOWED");
    expect(await code(await relay(await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale", gas: 301_000_000_000_000n })))).toBe("E_GAS_TOO_HIGH");
  });

  it("refuses a tampered signature before touching the relayer", async () => {
    const res = await relay(await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale", tamper: true }));
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("E_BAD_SIGNATURE");
    expect(near.relayerAccount).not.toHaveBeenCalled();
  });

  it("refuses an expired delegate", async () => {
    const res = await relay(await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale", maxBlockHeight: 10n }));
    expect(res.status).toBe(409);
    expect(await code(res)).toBe("E_DELEGATE_EXPIRED");
  });

  it("rejects garbage and bad shapes with {error, code}", async () => {
    expect(await code(await relay("A".repeat(60)))).toBe("E_BAD_DELEGATE");
    const res = await app.fetch(json("/relay", { signed_delegate: 5 }), makeEnv());
    expect(res.status).toBe(400);
    expect(await code(res)).toBe("E_BAD_INPUT");
  });

  it("rate-limits per sender", async () => {
    const b64 = await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale" });
    let last = 200;
    for (let i = 0; i < 21; i++) last = (await relay(b64)).status;
    expect(last).toBe(429);
    const other = await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale", senderId: "someone-else.testnet" });
    expect((await relay(other)).status).toBe(200);
  });

  it("never leaks the relayer key in an error body", async () => {
    relayMetaTransaction.mockRejectedValue(new Error("ed25519:SECRETKEY exploded"));
    const res = await relay(await signedDelegateB64({ receiverId: DIBS, method: "list_for_resale" }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("SECRETKEY");
  });
});
