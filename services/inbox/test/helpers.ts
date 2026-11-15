import { readFileSync } from "node:fs";
import type { Env } from "../src/env";
import type { MailLike } from "../src/ingest";

export const FIXTURE = new URL("../../../outlayer/verifier/tests/fixtures/valid.eml", import.meta.url);
export const validEml = (): Uint8Array => new Uint8Array(readFileSync(FIXTURE));
export const KEY = "00".repeat(31) + "2a";

export class FakeR2 {
  store = new Map<string, Uint8Array | string>();
  private bytes(k: string): Uint8Array {
    const v = this.store.get(k)!;
    return typeof v === "string" ? new TextEncoder().encode(v) : v;
  }
  async get(key: string) {
    if (!this.store.has(key)) return null;
    const b = this.bytes(key);
    return { text: async () => new TextDecoder().decode(b), body: new Response(b).body };
  }
  async put(key: string, value: string | Uint8Array) {
    this.store.set(key, value);
    return {};
  }
  async list(o: { prefix?: string }) {
    const objects = [...this.store.keys()].filter((k) => k.startsWith(o.prefix ?? "")).map((key) => ({ key }));
    return { objects, truncated: false, cursor: undefined };
  }
}

export function makeEnv(over: Partial<Env> = {}): Env {
  return {
    NEAR_NETWORK: "testnet",
    NEAR_RPC_URLS: "https://rpc.invalid",
    DIBS_CONTRACT: "dibs-x.testnet",
    RELAYER_ACCOUNT_ID: "relayer.testnet",
    MAIL_DOMAIN: "dibs.larinova.com",
    PUBLIC_BASE_URL: "https://api.test",
    ALLOW_TEST_DOMAIN: "1",
    AUTO_SUBMIT: "1",
    DIBS_BLOB_KEY: KEY,
    RELAYER_PRIVATE_KEY: "ed25519:unused",
    BLOBS: new FakeR2() as unknown as R2Bucket,
    ...over,
  };
}

export function mail(to: string, raw: Uint8Array | string): MailLike & { rejected?: string } {
  const bytes = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
  const m: MailLike & { rejected?: string } = {
    from: "someone@example.org",
    to,
    rawSize: bytes.length,
    raw: new Response(bytes).body!,
    setReject: (r) => void (m.rejected = r),
  };
  return m;
}

const concat = (...p: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of p) (out.set(x, o), (o += x.length));
  return out;
}

/** Gmail "Forward as attachment": an outer message whose message/rfc822 part holds the original bytes. */
export function forwardAsAttachment(inner: Uint8Array, to: string, encoding: "7bit" | "base64" = "7bit"): Uint8Array {
  const enc = new TextEncoder();
  const b = "----=_Part_42_1700000000.1700000000";
  const head = enc.encode(
    `From: Maya <g@example.org>\r\nTo: ${to}\r\nSubject: Fwd: Your booking\r\nDate: Sat, 14 Nov 2026 10:00:00 +0000\r\nMessage-ID: <fwd1@example.org>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${b}"\r\n\r\n` +
      `--${b}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\nForwarded, see attached.\r\n` +
      `--${b}\r\nContent-Type: message/rfc822; name="Your booking.eml"\r\nContent-Disposition: attachment; filename="Your booking.eml"\r\nContent-Transfer-Encoding: ${encoding}\r\n\r\n`,
  );
  const body = encoding === "base64" ? enc.encode((btoa(String.fromCharCode(...inner)).match(/.{1,76}/g) ?? []).join("\r\n")) : inner;
  return concat(head, body, enc.encode(`\r\n--${b}--\r\n`));
}
