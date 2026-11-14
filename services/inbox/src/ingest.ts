import { sha256Hex, storeBlob } from "./blob";
import { getTrip, notReady, submitProof } from "./chain";
import { type Env, MAX_EML_BYTES, TRIP_RE } from "./env";
import { type Item, listItems, newId, putItem } from "./store";
import { dkimAllowed, extractBooking } from "./unwrap";

export const MAX_SUBMITS_PER_TRIP = 3;

export interface MailLike {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
  rawSize: number;
  setReject(reason: string): void;
}

export function tripOf(to: string, domain: string): string | undefined {
  const m = /^([^@]+)@(.+)$/.exec(to.trim().toLowerCase());
  if (!m || m[2] !== domain.toLowerCase()) return undefined;
  const local = m[1].split("+")[0];
  return TRIP_RE.test(local) ? local : undefined;
}

async function readLimited(m: MailLike): Promise<Uint8Array | undefined> {
  if (m.rawSize > MAX_EML_BYTES) return undefined;
  const buf = new Uint8Array(await new Response(m.raw).arrayBuffer());
  return buf.length > MAX_EML_BYTES || buf.length === 0 ? undefined : buf;
}

/** Store the booking mail as an encrypted blob and (when eligible) submit the proof through the relayer. */
export async function ingest(env: Env, m: MailLike, now = Date.now()): Promise<Item | undefined> {
  const trip = tripOf(m.to, env.MAIL_DOMAIN);
  if (!trip) return void m.setReject("unknown address");
  const raw = await readLimited(m);
  if (!raw) return void m.setReject("message too large (2 MB max) or empty");

  let view: Awaited<ReturnType<typeof getTrip>> | undefined;
  let rpcOk = true;
  try {
    view = await getTrip(env, trip);
    if (!view) return void m.setReject("unknown trip");
  } catch {
    rpcOk = false; // RPC down: keep the mail, decide later
  }

  const booking = await extractBooking(raw);
  if (booking.bytes.length > MAX_EML_BYTES) return void m.setReject("message too large");
  const stored = await storeBlob(env, booking.bytes);

  const item: Item = {
    id: newId(now),
    trip,
    blob_url: stored.blob_url,
    blob_sha256: stored.blob_sha256,
    received_at: new Date(now).toISOString(),
    from_domain: booking.fromDomain,
    subject_hash: await sha256Hex(new TextEncoder().encode(booking.subject)),
    dkim_domain: dkimAllowed(booking.dkimDomains, env.ALLOW_TEST_DOMAIN === "1") ?? null,
    wrapped: booking.wrapped,
    status: "ready",
  };

  // Only mail that carries an allowed DKIM domain is worth 0.025 NEAR of relayer deposit.
  const why =
    !item.dkim_domain ? "no DKIM signature from an accepted booking domain"
    : env.AUTO_SUBMIT !== "1" ? "auto-submit off: the booker releases from the app"
    : !rpcOk || !view ? "chain unreachable: the booker releases from the app"
    : notReady(view, now);
  if (why) {
    item.note = why;
    if (!item.dkim_domain) item.status = "not_eligible";
    await putItem(env, item);
    return item;
  }
  const prior = (await listItems(env, trip, 100)).filter((i) => i.status === "submitted" || i.status === "submit_failed").length;
  if (prior >= MAX_SUBMITS_PER_TRIP) {
    item.note = "relayer submit limit for this trip reached: the booker releases from the app";
    await putItem(env, item);
    return item;
  }
  await putItem(env, item); // visible as "ready" while the chain call runs
  try {
    item.tx_hash = await submitProof(env, trip, item.blob_url, item.blob_sha256);
    item.status = "submitted";
  } catch (e) {
    item.status = "submit_failed";
    item.note = `relayer submit failed (${String((e as Error)?.message ?? "error").slice(0, 120)}); the booker releases from the app`;
  }
  await putItem(env, item);
  return item;
}
