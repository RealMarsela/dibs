import { z } from "zod";
import type { Env } from "./env";
// Same format as services/api/src/blob.ts: iv(12) || AES-256-GCM ciphertext || tag(16), no AAD.
// blob_sha256 is the sha256 of the stored (encrypted) bytes.
export const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export const sha256Hex = async (b: Uint8Array): Promise<string> => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", b)));

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
  if (!bytes || bytes.length !== 32) throw new Error("DIBS_BLOB_KEY must be 32 bytes (64 hex chars or base64)");
  return bytes;
}

export async function encrypt(keyRaw: string, plain: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", parseKey(keyRaw), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

const uploaded = z.object({ blob_url: z.string().url(), blob_sha256: z.string().regex(/^[0-9a-f]{64}$/) });

/** Encrypt and store the booking email; returns what submit_proof needs. */
export async function storeBlob(env: Env, plain: Uint8Array): Promise<{ blob_url: string; blob_sha256: string }> {
  if (env.API) {
    const fd = new FormData();
    fd.set("file", new File([plain], "booking.eml", { type: "message/rfc822" }));
    const res = await env.API.fetch("https://dibs-api/proof-blob", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`proof-blob upload failed (${res.status})`);
    return uploaded.parse(await res.json());
  }
  if (!env.DIBS_BLOB_KEY) throw new Error("no API binding and no DIBS_BLOB_KEY");
  const blob = await encrypt(env.DIBS_BLOB_KEY, plain);
  const id = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.BLOBS.put(`blobs/${id}`, blob, { httpMetadata: { contentType: "application/octet-stream" } });
  return { blob_url: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/blob/${id}`, blob_sha256: await sha256Hex(blob) };
}
