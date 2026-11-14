import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { accountExists, relayerAccount } from "./near";
import { txHashOf } from "./sweep";
import { clientIp } from "./calls";
import { rateLimit } from "./ratelimit";

export const bootstrapRoute = new Hono<{ Bindings: Env }>();

/** Exactly 0.01 NEAR, the only amount a bootstrap ever sends. */
export const BOOTSTRAP_YOCTO = 10n ** 22n;
export const isImplicit = (a: string): boolean => /^[0-9a-f]{64}$/.test(a);

/**
 * Create an implicit account on chain by sending it 0.01 NEAR (it then has an access key and a nonce,
 * so it can sign NEP-366 delegates). Idempotent: an existing account is never funded again.
 */
export async function ensureImplicitAccount(env: Env, account: string): Promise<{ created: boolean; tx_hash: string | null }> {
  if (!isImplicit(account)) return { created: false, tx_hash: null };
  if (await accountExists(env, account)) return { created: false, tx_hash: null };
  try {
    const res = await relayerAccount(env).transfer({ receiverId: account, amount: BOOTSTRAP_YOCTO });
    return { created: true, tx_hash: txHashOf(res) };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_BOOTSTRAP_FAILED", "could not create the account on chain");
  }
}

const body = z.object({ account: z.string().regex(/^[0-9a-f]{64}$/, "account must be a 64-hex implicit account") }).strict();

bootstrapRoute.post("/account/bootstrap", async (c) => {
  const { account } = parse(body, await readJson(c));
  rateLimit(`boot:ip:${clientIp(c)}`, 10, 60_000);
  rateLimit(`boot:${account}`, 3, 60_000);
  const r = await ensureImplicitAccount(c.env, account);
  return c.json({ account, ...r, exists: true });
});
