import { Hono } from "hono";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { getTrip, provider, relayerAccount } from "./near";
import { txHashOf } from "./sweep";
import { checkPolicy, decodeDelegate, verifySignature } from "./policy";
import { rateLimit } from "./ratelimit";
import { relayBody } from "./schemas";
import { recordActivity } from "./activity";

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
    const tx_hash = txHashOf(res);
    await noteResale(env, sd.delegateAction.actions, tx_hash);
    return c.json({ tx_hash, sender: sd.delegateAction.senderId, receiver: sd.delegateAction.receiverId });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "E_RELAY_FAILED", "relay transaction was rejected by the network");
  }
});

/** A relayed list_for_resale goes on the trip's receipts: resold to the waitlist at once, or listed at face value. */
async function noteResale(env: Env, actions: { functionCall?: { methodName: string; args: Uint8Array } }[], tx: string | null): Promise<void> {
  const fc = actions.find((a) => a.functionCall?.methodName === "list_for_resale")?.functionCall;
  if (!fc) return;
  try {
    const { trip, n } = JSON.parse(new TextDecoder().decode(fc.args)) as { trip: string; n: number };
    const beds = (await getTrip(env, trip))?.beds as { status?: string }[] | undefined;
    const bed = beds?.[n - 1];
    const text = bed?.status === "Listed" ? `Bed ${n} listed for resale at face value` : `Bed ${n} resold at face value to the waitlist`;
    await recordActivity(env, trip, { kind: "resale", text, tx });
  } catch {
    // A receipt line is best effort; the relay itself already succeeded.
  }
}
