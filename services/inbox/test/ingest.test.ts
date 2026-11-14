import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../src/blob";
import { ingest, tripOf } from "../src/ingest";
import { createApp } from "../src/index";
import type { TripView } from "../src/chain";
import * as chain from "../src/chain";
import { FakeR2, KEY, forwardAsAttachment, mail, makeEnv, validEml } from "./helpers";

vi.mock("../src/chain", async (orig) => ({ ...(await orig<typeof import("../src/chain")>()), getTrip: vi.fn(), submitProof: vi.fn() }));
const paidTrip = (over: Partial<TripView> = {}): TripView => ({ book_by: String(BigInt(Date.now() + 86_400_000) * 1_000_000n), beds: [{ status: "Paid" }, { status: "Paid" }], proof: null, ...over });
const getTrip = vi.mocked(chain.getTrip);
const submitProof = vi.mocked(chain.submitProof);

async function decrypt(blob: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(KEY.match(/../g)!, (h) => parseInt(h, 16)), "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, key, blob.slice(12)));
}
const stored = (env: ReturnType<typeof makeEnv>, url: string) => (env.BLOBS as unknown as FakeR2).store.get(`blobs/${url.split("/").pop()}`) as Uint8Array;

beforeEach(() => {
  getTrip.mockReset().mockResolvedValue(paidTrip());
  submitProof.mockReset().mockResolvedValue("TXHASH");
});

describe("recipient", () => {
  it("takes the trip code from the local part of our domain only", () => {
    expect(tripOf("lis0312@dibs.larinova.com", "dibs.larinova.com")).toBe("lis0312");
    expect(tripOf("LIS0312+x@Dibs.Larinova.com", "dibs.larinova.com")).toBe("lis0312");
    expect(tripOf("lis0312@larinova.com", "dibs.larinova.com")).toBeUndefined();
    expect(tripOf("a@dibs.larinova.com", "dibs.larinova.com")).toBeUndefined();
    expect(tripOf("bad_code@dibs.larinova.com", "dibs.larinova.com")).toBeUndefined();
  });
});

describe("unwrap and encrypt", () => {
  for (const enc of ["7bit", "base64"] as const) {
    it(`forward-as-attachment (${enc}): the stored plaintext is exactly the inner bytes`, async () => {
      const env = makeEnv();
      const inner = validEml();
      const item = (await ingest(env, mail("lis0312@dibs.larinova.com", forwardAsAttachment(inner, "lis0312@dibs.larinova.com", enc))))!;
      expect(item.wrapped).toBe(true);
      expect(item.dkim_domain).toBe("dibs-test.example");
      expect(item.from_domain).toBe("dibs-test.example");
      const blob = stored(env, item.blob_url);
      expect(await sha256Hex(blob)).toBe(item.blob_sha256);
      expect(Buffer.from(await decrypt(blob)).equals(Buffer.from(inner))).toBe(true);
    });
  }

  it("direct mail (booking.com sends to the trip address): the whole raw message is the booking email", async () => {
    const env = makeEnv();
    const raw = validEml();
    const item = (await ingest(env, mail("lis0312@dibs.larinova.com", raw)))!;
    expect(item.wrapped).toBe(false);
    expect(Buffer.from(await decrypt(stored(env, item.blob_url))).equals(Buffer.from(raw))).toBe(true);
    expect(new TextDecoder().decode(stored(env, item.blob_url))).not.toContain("Alfama"); // not plaintext at rest
  });
});

describe("API binding", () => {
  it("uploads exactly the inner bytes to dibs-api /proof-blob and records its blob_url and sha", async () => {
    let sent: Uint8Array | undefined;
    const API = {
      fetch: async (url: string, init: RequestInit) => {
        expect(url).toMatch(/\/proof-blob$/);
        sent = new Uint8Array(await ((init.body as FormData).get("file") as File).arrayBuffer());
        return Response.json({ blob_url: `https://api.test/blob/${"a".repeat(64)}`, blob_sha256: "b".repeat(64), size: 1 });
      },
    } as unknown as Fetcher;
    const inner = validEml();
    const item = (await ingest(makeEnv({ API, DIBS_BLOB_KEY: undefined }), mail("lis0312@dibs.larinova.com", forwardAsAttachment(inner, "lis0312@dibs.larinova.com"))))!;
    expect(Buffer.from(sent!).equals(Buffer.from(inner))).toBe(true);
    expect(item.blob_sha256).toBe("b".repeat(64));
    expect(item.blob_url).toBe(`https://api.test/blob/${"a".repeat(64)}`);
  });
});

describe("refusals", () => {
  it("rejects an unknown address, an unknown trip and an oversize message; stores nothing", async () => {
    const env = makeEnv();
    const a = mail("a@dibs.larinova.com", validEml());
    await ingest(env, a);
    expect(a.rejected).toBeTruthy();
    getTrip.mockResolvedValueOnce(undefined);
    const b = mail("zzz9999@dibs.larinova.com", validEml());
    await ingest(env, b);
    expect(b.rejected).toBe("unknown trip");
    const big = mail("lis0312@dibs.larinova.com", new Uint8Array(2 * 1024 * 1024 + 1));
    await ingest(env, big);
    expect(big.rejected).toMatch(/too large/);
    expect((env.BLOBS as unknown as FakeR2).store.size).toBe(0);
    expect(submitProof).not.toHaveBeenCalled();
  });

  it("mail without an accepted DKIM domain is stored but never spends relayer NEAR", async () => {
    const env = makeEnv();
    const item = (await ingest(env, mail("lis0312@dibs.larinova.com", "From: a@b.example\r\nTo: lis0312@dibs.larinova.com\r\nSubject: hi\r\n\r\nhello\r\n")))!;
    expect(item.status).toBe("not_eligible");
    expect(submitProof).not.toHaveBeenCalled();
  });

  it("the test domain is not accepted when ALLOW_TEST_DOMAIN is off (mainnet)", async () => {
    const item = (await ingest(makeEnv({ ALLOW_TEST_DOMAIN: "0" }), mail("lis0312@dibs.larinova.com", validEml())))!;
    expect(item.dkim_domain).toBeNull();
    expect(submitProof).not.toHaveBeenCalled();
  });
});

describe("relayer submit", () => {
  it("submits submit_proof{trip, blob_url, blob_sha256} when every bed is paid", async () => {
    const env = makeEnv();
    const item = (await ingest(env, mail("lis0312@dibs.larinova.com", validEml())))!;
    expect(item.status).toBe("submitted");
    expect(item.tx_hash).toBe("TXHASH");
    expect(submitProof).toHaveBeenCalledWith(env, "lis0312", item.blob_url, item.blob_sha256);
  });

  it("leaves it ready for the booker when beds are unpaid, the proof exists, or the deadline passed", async () => {
    for (const t of [paidTrip({ beds: [{ status: "Paid" }, { status: "Held" }] }), paidTrip({ proof: { x: 1 } }), paidTrip({ book_by: "1" })]) {
      getTrip.mockResolvedValueOnce(t);
      const item = (await ingest(makeEnv(), mail("lis0312@dibs.larinova.com", validEml())))!;
      expect(item.status).toBe("ready");
      expect(item.note).toBeTruthy();
    }
    expect(submitProof).not.toHaveBeenCalled();
  });

  it("a rejected relayer call (for example E_NOT_BOOKER before the contract change) leaves it for the booker", async () => {
    submitProof.mockRejectedValueOnce(new Error("Smart contract panicked: E_NOT_BOOKER"));
    const item = (await ingest(makeEnv(), mail("lis0312@dibs.larinova.com", validEml())))!;
    expect(item.status).toBe("submit_failed");
    expect(item.note).toContain("E_NOT_BOOKER");
  });

  it("an RPC outage keeps the mail and does not submit", async () => {
    getTrip.mockRejectedValueOnce(new Error("rpc down"));
    const item = (await ingest(makeEnv(), mail("lis0312@dibs.larinova.com", validEml())))!;
    expect(item.status).toBe("ready");
    expect(submitProof).not.toHaveBeenCalled();
  });

  it("stops after 3 relayer submissions per trip", async () => {
    const env = makeEnv();
    for (let i = 0; i < 5; i++) await ingest(env, mail("lis0312@dibs.larinova.com", validEml()), Date.now() + i);
    expect(submitProof).toHaveBeenCalledTimes(3);
  });
});

describe("GET /inbox/:trip", () => {
  it("lists metadata newest first and never any email content", async () => {
    const env = makeEnv();
    await ingest(env, mail("lis0312@dibs.larinova.com", forwardAsAttachment(validEml(), "lis0312@dibs.larinova.com")), Date.now());
    await ingest(env, mail("lis0312@dibs.larinova.com", validEml()), Date.now() + 1000);
    const res = await createApp().fetch(new Request("http://x/inbox/lis0312"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { address: string; items: { received_at: string; subject_hash: string; wrapped: boolean }[] };
    expect(body.address).toBe("lis0312@dibs.larinova.com");
    expect(body.items.length).toBe(2);
    expect(body.items[0].wrapped).toBe(false);
    const allowed = new Set(["id", "trip", "blob_url", "blob_sha256", "received_at", "from_domain", "subject_hash", "dkim_domain", "wrapped", "status", "tx_hash", "note"]);
    for (const it of body.items) for (const k of Object.keys(it)) expect(allowed.has(k)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Alfama|Confirmation|Reservations|noreply@/);
    const bad = await createApp().fetch(new Request("http://x/inbox/A!"), env);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "bad trip code", code: "E_BAD_INPUT" });
  });
});
