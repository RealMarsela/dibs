import { ApiError } from "./errors";
import type { Env } from "./env";
import type { CardRecord } from "./card";

/* Lithic sandbox only. `simulate/authorize` takes the card number, so the simulation reads the sandbox card back
   by token. A real issuing program has no such endpoint (a real merchant terminal supplies the number) and
   the API would never see a PAN. Descriptors are limited to 25 characters by Lithic. */

export const MERCHANTS = {
  carlton: { descriptor: "CARLTON CITY HOTEL SG", mcc: "7011" },
  electronics: { descriptor: "VOLTCITY ELECTRONICS", mcc: "5732" },
} as const;

export interface SimResult {
  merchant: keyof typeof MERCHANTS;
  descriptor: string;
  mcc: string;
  amount: number;
  approved: boolean;
  result: string;
  reason: string;
  lithic_request_id: string | null;
  at: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lithic(env: Env, method: string, path: string, body?: unknown): Promise<{ status: number; json: any; id: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${env.LITHIC_BASE ?? "https://sandbox.lithic.com"}${path}`, {
      method,
      headers: { authorization: env.LITHIC_SIM_KEY!, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(502, "E_ISSUER_DOWN", "card issuer is unreachable");
  }
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json, id: res.headers.get("x-correlation-id") ?? json?.debugging_request_id ?? null };
}

export async function simulate(env: Env, rec: CardRecord, merchant: keyof typeof MERCHANTS): Promise<SimResult> {
  const m = MERCHANTS[merchant];
  const card = await lithic(env, "GET", `/v1/cards/${rec.card_token}`);
  if (card.status !== 200 || typeof card.json.pan !== "string") throw new ApiError(502, "E_ISSUER", "card could not be read at the issuer");
  const auth = await lithic(env, "POST", "/v1/simulate/authorize", { pan: card.json.pan, amount: rec.spend_limit, descriptor: m.descriptor, mcc: m.mcc });
  if (auth.status !== 201 && auth.status !== 200) throw new ApiError(502, "E_ISSUER", "issuer refused the simulated authorization");
  let txn = await lithic(env, "GET", `/v1/transactions/${auth.json.token}`);
  for (let i = 0; i < 3 && txn.status === 404; i++) {
    await sleep(700);
    txn = await lithic(env, "GET", `/v1/transactions/${auth.json.token}`);
  }
  if (txn.status !== 200) throw new ApiError(502, "E_ISSUER", "issuer did not return the transaction");
  const ev = txn.json.events?.[0];
  const result: string = txn.json.result ?? ev?.result ?? "UNKNOWN";
  return {
    merchant,
    descriptor: m.descriptor,
    mcc: m.mcc,
    amount: rec.spend_limit,
    approved: result === "APPROVED",
    result,
    reason: ev?.rule_results?.[0]?.result ?? ev?.result ?? result,
    lithic_request_id: auth.id,
    at: new Date().toISOString(),
  };
}
