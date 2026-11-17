import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "./env";
import { receiptAccount, rpcUrls } from "./env";
import { ApiError, parse, readJson } from "./errors";
import { recordActivity } from "./activity";
import { rateLimit } from "./ratelimit";
import { clientIp } from "./calls";
import { accountId, tripCode } from "./schemas";

/* A bed paid straight from a NEAR wallet moves USDC wallet -> bed account -> contract with no API call, so nothing
   wrote a receipt. The page reports the wallet's tx hash here; the receipt is written only after the chain confirms that
   this tx succeeded, was signed by `sender`, and transferred USDC (ft_transfer / ft_transfer_call on the trip's USDC
   contract) to exactly this bed's (or waitlist slot's) own account. */
export const walletReceiptRoute = new Hono<{ Bindings: Env }>();

const body = z
  .object({ trip: tripCode, kind: z.enum(["bed", "wait"]), n: z.number().int().min(1).max(12), tx_hash: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/), sender: accountId })
  .strict();

type Outcome = { status?: Record<string, unknown>; transaction?: { signer_id: string; receiver_id: string; actions: { FunctionCall?: { method_name: string; args: string } }[] } };

async function txStatus(env: Env, hash: string, sender: string): Promise<Outcome | null> {
  const req = JSON.stringify({ jsonrpc: "2.0", id: "dibs", method: "EXPERIMENTAL_tx_status", params: { tx_hash: hash, sender_account_id: sender, wait_until: "EXECUTED_OPTIMISTIC" } });
  for (const url of rpcUrls(env)) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: req });
      const j = (await r.json()) as { result?: Outcome };
      if (j.result) return j.result;
    } catch {
      // next RPC
    }
  }
  return null;
}

/** True when the tx is a successful USDC transfer from `sender` into `to`. */
export function paysInto(o: Outcome | null, usdc: string, sender: string, to: string): boolean {
  const t = o?.transaction;
  if (!t || !o?.status || "Failure" in o.status || t.signer_id !== sender || t.receiver_id !== usdc) return false;
  return t.actions.some((a) => {
    const fc = a.FunctionCall;
    if (!fc || !["ft_transfer", "ft_transfer_call"].includes(fc.method_name)) return false;
    try {
      return (JSON.parse(atob(fc.args)) as { receiver_id?: string }).receiver_id === to;
    } catch {
      return false;
    }
  });
}

const short = (a: string) => (/^[0-9a-f]{64}$|^0x[0-9a-f]{40}$/.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

walletReceiptRoute.post("/receipt/wallet-pay", async (c) => {
  const env = c.env;
  const b = parse(body, await readJson(c));
  rateLimit(`wallet-receipt:${clientIp(c)}`, 20, 60_000);
  const seen = ((await env.NAMES.get(`act/${b.trip}`, "json")) as { tx?: string }[] | null) ?? [];
  if (seen.some((a) => a.tx === b.tx_hash)) return c.json({ ok: true, recorded: false });
  const to = receiptAccount(env, b.kind, b.trip, b.n);
  if (!paysInto(await txStatus(env, b.tx_hash, b.sender), env.USDC_CONTRACT, b.sender, to))
    throw new ApiError(400, "E_NOT_A_PAYMENT", "that transaction did not pay USDC into this bed from that wallet");
  const what = b.kind === "bed" ? `Bed ${b.n}` : `Waitlist slot ${b.n}`;
  await recordActivity(env, b.trip, { kind: "deposit", text: `${what} paid from a NEAR wallet (${short(b.sender)})`, tx: b.tx_hash, chain: "near" });
  return c.json({ ok: true, recorded: true });
});
