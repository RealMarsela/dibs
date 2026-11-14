import PostalMime from "postal-mime";
import { innerRfc822 } from "./mime";

export interface Booking {
  /** The bytes the verifier will DKIM-check: the inner message/rfc822 part, else the whole raw message. */
  bytes: Uint8Array;
  wrapped: boolean;
  fromDomain: string;
  subject: string;
  /** DKIM-Signature d= values found in the header block (unverified here; the TEE verifies). */
  dkimDomains: string[];
}

const headerBlock = (b: Uint8Array): string => {
  const head = new TextDecoder("latin1").decode(b.subarray(0, Math.min(b.length, 65536)));
  const i = head.search(/\r?\n\r?\n/);
  return i < 0 ? head : head.slice(0, i);
};

export function dkimDomains(raw: Uint8Array): string[] {
  const unfolded = headerBlock(raw).replace(/\r?\n[ \t]+/g, " ");
  const out: string[] = [];
  for (const line of unfolded.split(/\r?\n/)) {
    if (!/^dkim-signature:/i.test(line)) continue;
    const m = /(?:^|[;\s])d=\s*([A-Za-z0-9.-]+)/.exec(line);
    if (m) out.push(m[1].toLowerCase());
  }
  return out;
}

/** Forward-as-attachment keeps the original bytes in a message/rfc822 part; take them untouched. */
export async function extractBooking(raw: Uint8Array): Promise<Booking> {
  const inner = innerRfc822(raw);
  const bytes = inner ?? raw;
  const meta = await PostalMime.parse(bytes);
  const addr = meta.from?.address ?? "";
  return {
    bytes,
    wrapped: Boolean(inner),
    fromDomain: addr.includes("@") ? addr.split("@").pop()!.toLowerCase() : "",
    subject: meta.subject ?? "",
    dkimDomains: dkimDomains(bytes),
  };
}

export const ALLOWED_DKIM = ["booking.com", "airbnb.com", "hostelworld.com"];
export const TEST_DKIM = "dibs-test.example";

export function dkimAllowed(domains: string[], allowTest: boolean): string | undefined {
  const ok = [...ALLOWED_DKIM, ...(allowTest ? [TEST_DKIM] : [])];
  return domains.find((d) => ok.some((a) => d === a || d.endsWith(`.${a}`)));
}
