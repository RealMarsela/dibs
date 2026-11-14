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
  proof?: { stay: string; guests: number; total: string; dkim_domain: string; check_in: string; check_out: string } | null;
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
