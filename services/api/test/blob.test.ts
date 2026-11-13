import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { FakeR2, makeEnv } from "./helpers";
import { MAX_EML_BYTES, parseKey } from "../src/blob";

const app = createApp();
const upload = (env = makeEnv(), content: string | Uint8Array = "From: bookings@booking.com\r\n\r\nhi", type = "message/rfc822", field = "file") => {
  const fd = new FormData();
  fd.set(field, new File([content as unknown as string], "booking.eml", { type }));
  return app.fetch(new Request("http://api.test/proof-blob", { method: "POST", body: fd, headers: { "cf-connecting-ip": String(Math.random()) } }), env);
};

async function decrypt(keyHex: string, blob: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", parseKey(keyHex), "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, key, blob.slice(12));
  return new TextDecoder().decode(pt);
}

describe("POST /proof-blob", () => {
  it("encrypts, stores, returns capability url and sha256 of the ciphertext", async () => {
    const env = makeEnv();
    const res = await upload(env);
    expect(res.status).toBe(200);
    const b = (await res.json()) as { blob_url: string; blob_sha256: string };
    expect(b.blob_url).toMatch(/^http:\/\/api\.test\/blob\/[0-9a-f]{64}$/);
    const id = b.blob_url.split("/").pop()!;
    const stored = (env.BLOBS as unknown as FakeR2).store.get(`blobs/${id}`) as Uint8Array;
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", stored)), (x) => x.toString(16).padStart(2, "0")).join("");
    expect(b.blob_sha256).toBe(sha);
    expect(await decrypt(env.DIBS_BLOB_KEY, stored)).toContain("bookings@booking.com");
    expect(new TextDecoder().decode(stored)).not.toContain("booking.com"); // not plaintext at rest
  });

  it("GET /blob/:id serves the ciphertext; unknown or malformed ids are 404", async () => {
    const env = makeEnv();
    const b = (await (await upload(env)).json()) as { blob_url: string; blob_sha256: string };
    const got = await app.fetch(new Request(b.blob_url), env);
    expect(got.status).toBe(200);
    const bytes = new Uint8Array(await got.arrayBuffer());
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (x) => x.toString(16).padStart(2, "0")).join("");
    expect(sha).toBe(b.blob_sha256);
    expect((await app.fetch(new Request("http://api.test/blob/" + "0".repeat(64)), env)).status).toBe(404);
    expect((await app.fetch(new Request("http://api.test/blob/../etc"), env)).status).toBe(404);
  });

  it("two uploads of the same file get different ids and ciphertext", async () => {
    const env = makeEnv();
    const a = (await (await upload(env)).json()) as { blob_url: string; blob_sha256: string };
    const b = (await (await upload(env)).json()) as { blob_url: string; blob_sha256: string };
    expect(a.blob_url).not.toBe(b.blob_url);
    expect(a.blob_sha256).not.toBe(b.blob_sha256);
  });

  it("enforces the 2 MB limit (exact limit ok, one byte over refused)", async () => {
    expect((await upload(makeEnv(), new Uint8Array(MAX_EML_BYTES))).status).toBe(200);
    const res = await upload(makeEnv(), new Uint8Array(MAX_EML_BYTES + 1));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { code: string }).code).toBe("E_TOO_LARGE");
  });

  it("rejects wrong content types, empty files and missing field", async () => {
    let res = await upload(makeEnv(), "<html>", "text/html");
    expect(res.status).toBe(415);
    res = await upload(makeEnv(), "x", "application/zip");
    expect(res.status).toBe(415);
    res = await upload(makeEnv(), "");
    expect(res.status).toBe(400);
    res = await upload(makeEnv(), "x", "message/rfc822", "other");
    expect(res.status).toBe(400);
    const json = await app.fetch(new Request("http://api.test/proof-blob", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), makeEnv());
    expect(json.status).toBe(415);
  });

  it("fails closed when the key is not 32 bytes", async () => {
    const res = await upload(makeEnv({ DIBS_BLOB_KEY: "abcd" }));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { code: string }).code).toBe("E_BLOB_KEY_UNCONFIGURED");
  });
});
