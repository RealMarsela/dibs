import { ApiError } from "./errors";
import type { Env } from "./env";
import type { FromChain } from "./schemas";

/** Origin USDC asset ids (research/preflight/tokens.json). */
export const ORIGIN_ASSET: Record<FromChain, string> = {
  eth: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
  arb: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
  base: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  sol: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
  pol: "nep141:pol-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.omdep.near",
  op: "nep245:v2_1.omni.hot.tg:10_A2ewyUyDp6qsue1jqZsGypkCxRJ",
};

export const QUOTE_TTL_MS = 30 * 60 * 1000;

export interface OneClickQuote {
  quote: {
    depositAddress?: string;
    amountIn: string;
    minAmountIn?: string;
    amountOut: string;
    timeEstimate?: number;
    deadline?: string;
    refundFee?: string;
  };
  quoteRequest: { recipient: string; deadline?: string; originAsset: string };
}

function headers(env: Env): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (env.ONECLICK_JWT) h.authorization = `Bearer ${env.ONECLICK_JWT}`;
  return h;
}

async function call(env: Env, path: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(env.ONECLICK_URL + path, { ...init, headers: headers(env) });
  } catch {
    throw new ApiError(502, "E_ONECLICK_DOWN", "1Click is unreachable");
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (res.ok) return body;
  const msg = (body as { message?: string } | undefined)?.message;
  if (res.status === 400) throw new ApiError(422, "E_QUOTE_REJECTED", msg ? `1Click: ${msg.slice(0, 200)}` : "1Click rejected the quote");
  if (res.status === 404) throw new ApiError(404, "E_DEPOSIT_UNKNOWN", "1Click does not know this deposit address");
  throw new ApiError(502, "E_ONECLICK", `1Click returned HTTP ${res.status}`);
}

export interface QuoteInput {
  fromChain: FromChain;
  refundTo: string;
  recipient: string;
  amountOut: string;
  dry: boolean;
  now?: number;
}

export async function requestQuote(env: Env, i: QuoteInput): Promise<OneClickQuote> {
  const deadline = new Date((i.now ?? Date.now()) + QUOTE_TTL_MS).toISOString();
  const body = {
    dry: i.dry,
    depositMode: "SIMPLE",
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: ORIGIN_ASSET[i.fromChain],
    depositType: "ORIGIN_CHAIN",
    destinationAsset: `nep141:${env.USDC_CONTRACT}`,
    amount: i.amountOut,
    refundTo: i.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: i.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline,
  };
  const r = (await call(env, "/v0/quote", { method: "POST", body: JSON.stringify(body) })) as OneClickQuote | undefined;
  if (!r?.quote?.amountIn) throw new ApiError(502, "E_ONECLICK", "1Click returned an unreadable quote");
  return r;
}

export interface OneClickStatus {
  status: "PENDING_DEPOSIT" | "INCOMPLETE_DEPOSIT" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED" | string;
  quoteResponse?: OneClickQuote;
  swapDetails?: unknown;
}

export async function getStatus(env: Env, depositAddress: string): Promise<OneClickStatus> {
  const r = (await call(env, `/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`, { method: "GET" })) as OneClickStatus | undefined;
  if (!r?.status) throw new ApiError(502, "E_ONECLICK", "1Click returned an unreadable status");
  return r;
}

/** Tells 1Click which transaction paid a deposit address, so it verifies the deposit without waiting to find it. */
export async function submitDeposit(env: Env, depositAddress: string, txHash: string): Promise<void> {
  await call(env, "/v0/deposit/submit", { method: "POST", body: JSON.stringify({ depositAddress, txHash }) });
}
