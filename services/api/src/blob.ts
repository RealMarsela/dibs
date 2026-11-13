import { Hono } from "hono";
import { ApiError } from "./errors";
import type { Env } from "./env";
import { rateLimit } from "./ratelimit";

export const blobRoute = new Hono<{ Bindings: Env }>();

export const MAX_EML_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["message/rfc822", "text/plain", "application/octet-stream", "application/eml", "application/x-eml"]);

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function parseKey(raw: string): Uint8Array {
  const s = raw.trim();
  let bytes: Uint8Array | undefined;
  if (/^[0-9a-fA-F]{64}$/.test(s)) bytes = Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16));
  else {
    try {
      bytes = Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
    } catch {
      bytes = undefined;
    }
  }
  if (!bytes || bytes.length !== 32) throw new ApiError(503, "E_BLOB_KEY_UNCONFIGURED", "DIBS_BLOB_KEY must be 32 bytes (64 hex chars or base64)");
  return bytes;
}

/** Stored layout: iv(12) || ciphertext || gcm tag(16). No AAD. This is what the verifier decrypts. */
export async function encrypt(keyRaw: string, plain: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", parseKey(keyRaw), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

blobRoute.post("/proof-blob", async (c) => {
  const env = c.env;
  rateLimit(`blob:${c.req.header("cf-connecting-ip") ?? "anon"}`, 10, 60_000);

  const declared = Number(c.req.header("content-length") ?? "0");
  if (declared > MAX_EML_BYTES + 4096) throw new ApiError(413, "E_TOO_LARGE", "file exceeds 2 MB");
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "E_BAD_CONTENT_TYPE", "send multipart/form-data with a file field named 'file'");
  }
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new ApiError(400, "E_BAD_INPUT", "unreadable multipart body");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "E_BAD_INPUT", "missing file field");
  const type = (file.type || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(type)) throw new ApiError(415, "E_BAD_CONTENT_TYPE", `file type ${type} is not accepted (.eml only)`);
  if (file.size === 0) throw new ApiError(400, "E_EMPTY", "file is empty");
  if (file.size > MAX_EML_BYTES) throw new ApiError(413, "E_TOO_LARGE", "file exceeds 2 MB");

  const plain = new Uint8Array(await file.arrayBuffer());
  const blob = await encrypt(env.DIBS_BLOB_KEY, plain);
  const sha = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", blob)));
  const id = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.BLOBS.put(`blobs/${id}`, blob, { httpMetadata: { contentType: "application/octet-stream" } });

  const base = (env.PUBLIC_BASE_URL || new URL(c.req.url).origin).replace(/\/$/, "");
  return c.json({ blob_url: `${base}/blob/${id}`, blob_sha256: sha, size: blob.length });
});

blobRoute.get("/blob/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[0-9a-f]{64}$/.test(id)) throw new ApiError(404, "E_NOT_FOUND", "blob not found");
  const o = await c.env.BLOBS.get(`blobs/${id}`);
  if (!o) throw new ApiError(404, "E_NOT_FOUND", "blob not found");
  return new Response(o.body, {
    headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
});
