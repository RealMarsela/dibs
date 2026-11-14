/* Typed calls to the Dibs API worker (services/api). Every error comes back as { error, code? }. */
export const API = (import.meta.env.VITE_DIBS_API as string | undefined)?.replace(/\/$/, "") ?? "";
const DEFAULT_NETWORK: Network = import.meta.env.VITE_DIBS_NETWORK === "mainnet" ? "mainnet" : "testnet";

/* Trips that live on NEAR mainnet. Opening one switches every call to the API's /mainnet path, the mainnet
   contract and mainnet explorers; any other trip code stays on testnet. */
export type Network = "testnet" | "mainnet";
export const MAINNET_TRIPS = ["lismain", "lismain2"];
export const CONTRACTS: Record<Network, string> = {
  testnet: (import.meta.env.VITE_DIBS_CONTRACT as string | undefined) ?? "dibs-0eb9ae.testnet",
  mainnet: "dibsapp.near",
};
let current: Network = DEFAULT_NETWORK;
export const networkFor = (code: string): Network => (MAINNET_TRIPS.includes(code.toLowerCase()) ? "mainnet" : DEFAULT_NETWORK);
export const setNetwork = (n: Network) => void (current = n);
export const network = (): Network => current;
const base = () => (current === "mainnet" ? `${API}/mainnet` : API);

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(base() + path, init);
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
  meta?: { place?: string; country?: string; stay?: string } | null;
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
  minAmountIn?: string | null;
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
/** A wallet in the app paid the 1Click deposit: tell 1Click the transaction so it verifies the deposit sooner. */
export const submitDeposit = (depositAddress: string, txHash: string) => post<{ ok: boolean }>("/deposit/submit", { depositAddress, txHash });

export const relay = (signed_delegate: string) => post<{ tx_hash: string; sender: string; receiver: string }>("/relay", { signed_delegate });

export async function uploadProof(file: File): Promise<{ blob_url: string; blob_sha256: string; size: number }> {
  const fd = new FormData();
  fd.append("file", file);
  return call("/proof-blob", { method: "POST", body: fd });
}

export const explorer = (tx: string) => `https://${current === "mainnet" ? "" : "testnet."}nearblocks.io/txns/${tx}`;
export const accountExplorer = (a: string) => `https://${current === "mainnet" ? "" : "testnet."}nearblocks.io/address/${a}`;

/* Live wiring endpoints (services/api, Lane G) and the trip inbox / card. */
export const INBOX = (import.meta.env.VITE_DIBS_INBOX as string | undefined)?.replace(/\/$/, "") ?? "";

/** Testnet: a friend's own EVM wallet pays test USDC on Base Sepolia to this address; the API verifies it and credits the bed. */
export const evmInfo = () => call<{ chainId: number; chain: string; usdc: string; address: string }>("/testnet/evm-info");
export const evmDeposit = (b: { trip: string; kind: "bed" | "wait"; n: number; txHash: string }) =>
  post<{ evm_tx: string; from: string; mint_tx: string; sweep_tx: string | null; status: string }>("/testnet/evm-deposit", b);
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

/** A one-time nonce and the exact text a booker's NEAR wallet signs (NEP-413) to start a trip as a named account. */
export const authNonce = () => call<{ nonce: string; recipient: string; message: string; erc191_message: string; expires_at: string }>("/auth/nonce");
type Nep413Auth = { accountId: string; publicKey: string; signature: string; nonce: string; message: string };
type Erc191Auth = { address: string; signature: string; nonce: string; message: string };
export const createTrip = (b: {
  place: string;
  stay: string;
  check_in: string;
  check_out: string;
  beds: number;
  price_usdc: number;
  booker: string;
  auth?: Nep413Auth | Erc191Auth;
}) =>
  post<{ code: string; url: string; tx_hash: string; hold_tx?: string; inbox?: string | null }>("/trips", b);
