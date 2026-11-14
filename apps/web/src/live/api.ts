/* Typed calls to the Dibs API worker (services/api). Every error comes back as { error, code? }. */
export const API = (import.meta.env.VITE_DIBS_API as string | undefined)?.replace(/\/$/, "") ?? "";
export const NETWORK = (import.meta.env.VITE_DIBS_NETWORK as string | undefined) ?? "testnet";

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, init);
  const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new ApiError(body.error ?? `HTTP ${r.status}`, body.code);
  return body as T;
}
const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export interface RawBed {
  holder?: string | null;
  buyer?: string | null;
  status: "Open" | "Held" | "Paid" | "Listed";
  paid_from_chain?: string | null;
}
export interface RawTrip {
  price: string;
  n_beds: number;
  book_by: string;
  booker: string;
  dao: string;
  check_in: string;
  check_out: string;
  stay?: string;
  beds: RawBed[];
  waitlist: { buyer: string; slot: number }[];
  proof?: { stay: string; guests: number; total: string; dkim_domain: string; check_in: string; check_out: string; currency?: string } | null;
  payout?: unknown;
  drawn?: number[] | null;
  drawn_out?: boolean;
  refunded?: boolean;
  last_error?: string | null;
}
export interface TripView {
  code: string;
  network: string;
  contract: string;
  usdc: string;
  trip: RawTrip;
  bed_accounts: string[];
  fetched_at: string;
}

export const getTrip = (code: string) => call<TripView>(`/trip/${encodeURIComponent(code)}`);

export interface Quote {
  mode: "oneclick" | "testnet";
  depositAddress: string;
  amountIn: string;
  token: string;
  expiresAt: string | null;
  etaSeconds?: number;
  instructions?: { step: number; text: string }[];
}
export const quote = (q: { trip: string; n: number; kind: "bed" | "wait"; fromChain: string; refundTo: string }) => post<Quote>("/quote", q);

export interface Status {
  mode: "oneclick" | "direct";
  status: string;
  sweep: "not_ready" | "no_funds" | "in_progress" | "done" | "already_done";
  tx_hash?: string;
}
export const status = (depositAddress: string) => call<Status>(`/status/${encodeURIComponent(depositAddress)}`);

export const hold = (h: { trip: string; kind: "bed" | "wait"; n: number; holder: string }) => post<{ tx_hash: string }>("/hold", h);

export const relay = (signed_delegate: string) => post<{ tx_hash: string; sender: string; receiver: string }>("/relay", { signed_delegate });

export async function uploadProof(file: File): Promise<{ blob_url: string; blob_sha256: string; size: number }> {
  const fd = new FormData();
  fd.append("file", file);
  return call("/proof-blob", { method: "POST", body: fd });
}

export const explorer = (tx: string) => `https://${NETWORK === "mainnet" ? "" : "testnet."}nearblocks.io/txns/${tx}`;

/* Live wiring endpoints (services/api, Lane G) and the trip inbox / card. */
export const INBOX = (import.meta.env.VITE_DIBS_INBOX as string | undefined)?.replace(/\/$/, "") ?? "";

export const fund = (b: { trip: string; kind: "bed" | "wait"; n: number }) => post<{ mint_tx?: string; sweep_tx?: string; status?: string }>("/testnet/fund", b);
export const refundCheck = (b: { trip: string; n: number }) => post<{ code: string; tx_hash?: string }>("/refund-check", b);
export const draw = (trip: string) => post<{ tx_hash: string }>("/draw", { trip });
export const proofSubmit = (b: { trip: string; blob_url: string; blob_sha256: string }) => post<{ tx_hash: string }>("/proof/submit", b);
export const bootstrap = (account: string) => post<{ tx_hash?: string; existed?: boolean }>("/account/bootstrap", { account });
export const names = (accounts: string[]) =>
  accounts.length ? call<Record<string, string>>(`/names?accounts=${accounts.map(encodeURIComponent).join(",")}`) : Promise.resolve({});
export const putName = (b: { account: string; name: string; ts: number; sig: string }) => call<{ ok: boolean }>("/names", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

export interface ActivityRow {
  at: string;
  kind: string;
  text: string;
  tx?: string;
  chain?: string;
}
export const activity = (trip: string) => call<ActivityRow[]>(`/trip/${encodeURIComponent(trip)}/activity`).catch(() => [] as ActivityRow[]);

export interface InboxItem {
  id: string;
  blob_url: string;
  blob_sha256: string;
  received_at: string;
  from_domain?: string;
  dkim_domain?: string;
  wrapped?: boolean;
  status: string;
  tx_hash?: string;
  note?: string;
}
export async function inbox(trip: string): Promise<{ address: string; items: InboxItem[] }> {
  const r = await fetch(`${INBOX}/inbox/${encodeURIComponent(trip)}`);
  if (!r.ok) throw new ApiError(`inbox HTTP ${r.status}`);
  return r.json();
}

export interface CardInfo {
  last4: string;
  spend_limit: string | number;
  mcc: string | number;
  sealed_hex: string;
  issued_at: string;
  simulations: { merchant: string; descriptor: string; approved: boolean; reason?: string; result?: string; at: string }[];
}
export const cardIssue = (trip: string) => post<{ last4: string; spend_limit: string | number; mcc: string | number }>(`/card/${encodeURIComponent(trip)}/issue`, {});
export const cardGet = (trip: string) => call<CardInfo>(`/card/${encodeURIComponent(trip)}`);
export const cardSimulate = (trip: string, merchant: "carlton" | "electronics") =>
  post<{ approved: boolean; descriptor: string; reason?: string; result?: string; lithic_request_id?: string }>(`/card/${encodeURIComponent(trip)}/simulate`, { merchant });
