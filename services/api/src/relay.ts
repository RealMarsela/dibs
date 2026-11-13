import { Hono } from "hono";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { provider, relayerAccount } from "./near";
import { txHashOf } from "./sweep";
import { checkPolicy, decodeDelegate, verifySignature } from "./policy";
import { rateLimit } from "./ratelimit";
import { relayBody } from "./schemas";

export const relayRoute = new Hono<{ Bindings: Env }>();

export const RELAY_PER_MINUTE = 20;

relayRoute.post("/relay", async (c) => {
  const env = c.env;
  const { signed_delegate } = parse(relayBody, await readJson(c));
  const sd = decodeDelegate(signed_delegate);

  // Cheap checks first: nothing below touches the relayer key or the RPC until the delegate passes.
  checkPolicy(env, sd);
  await verifySignature(sd);
  rateLimit(`relay:${sd.delegateAction.senderId}`, RELAY_PER_MINUTE, 60_000);

  let height: number;
  try {
    height = (await provider(env).viewBlock({ finality: "final" })).header.height;
  } catch {
    throw new ApiError(502, "E_RPC", "NEAR RPC unavailable");
  }
  if (BigInt(height) > sd.delegateAction.maxBlockHeight) throw new ApiError(409, "E_DELEGATE_EXPIRED", "delegate action has expired (max_block_height passed)");

  try {
    const res = await relayerAccount(env).relayMetaTransaction(sd);
    return c.json({ tx_hash: txHashOf(res), sender: sd.delegateAction.senderId, receiver: sd.delegateAction.receiverId });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_RELAY_FAILED", "relay transaction was rejected by the network");
  }
});
