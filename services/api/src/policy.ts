import { decodeSignedDelegate, encodeDelegateAction } from "near-api-js";
import type { SignedDelegate } from "near-api-js";
import { ApiError } from "./errors";
import { type Env, receiptRegex } from "./env";

/** Methods the relayer will forward, per receiver kind. Anything else is refused. */
const NEAR = 10n ** 24n;
/** Max deposit (yoctoNEAR, paid by the delegate sender, never the relayer) per allowlisted method. */
export const DIBS_METHODS = new Map<string, bigint>([
  ["hold", NEAR / 100n],
  ["reserve_wait", NEAR / 100n],
  ["release_hold", 0n],
  ["list_for_resale", 0n],
  ["leave_waitlist", 0n],
  ["request_draw", NEAR / 10n],
  ["submit_proof", NEAR / 10n],
  ["refund_all", 0n],
  ["request_refund", 0n], // always panics E_NO_REFUND; kept so the demo can show the refusal
]);
export const BED_METHODS = new Map<string, bigint>([["sweep", 0n]]);

export const MAX_GAS_TOTAL = 300_000_000_000_000n;

export function decodeDelegate(b64: string): SignedDelegate {
  try {
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(norm);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return decodeSignedDelegate(bytes);
  } catch {
    throw new ApiError(400, "E_BAD_DELEGATE", "signed_delegate is not a borsh-encoded SignedDelegate");
  }
}

/** Throws unless every action is an allowlisted, capped-deposit function call to dibs or a receipt. */
export function checkPolicy(env: Env, sd: SignedDelegate): void {
  const da = sd.delegateAction;
  const receiver = da.receiverId;
  const isDibs = receiver === env.DIBS_CONTRACT;
  const isReceipt = receiptRegex(env).test(receiver);
  if (!isDibs && !isReceipt) throw new ApiError(403, "E_RECEIVER_NOT_ALLOWED", `receiver ${receiver} is not the dibs contract or a receipt account`);
  if (da.senderId === env.RELAYER_ACCOUNT_ID) throw new ApiError(403, "E_SENDER_NOT_ALLOWED", "sender may not be the relayer");
  if (da.actions.length === 0 || da.actions.length > 4) throw new ApiError(400, "E_BAD_DELEGATE", "delegate must carry 1 to 4 actions");

  const allowed = isDibs ? DIBS_METHODS : BED_METHODS;
  let gas = 0n;
  for (const a of da.actions) {
    const fc = a.functionCall;
    if (!fc) throw new ApiError(403, "E_ACTION_NOT_ALLOWED", "only function-call actions are relayed");
    const cap = allowed.get(fc.methodName);
    if (cap === undefined) throw new ApiError(403, "E_METHOD_NOT_ALLOWED", `method ${fc.methodName} is not relayed for ${receiver}`);
    if (BigInt(fc.deposit) > cap) throw new ApiError(403, "E_DEPOSIT_NOT_ALLOWED", `deposit above the relay cap for ${fc.methodName}`);
    gas += BigInt(fc.gas);
  }
  if (gas > MAX_GAS_TOTAL) throw new ApiError(403, "E_GAS_TOO_HIGH", "attached gas exceeds the relay cap");
}

/** NEP-366: signature is over sha256 of the NEP-461-prefixed borsh delegate action. */
export async function verifySignature(sd: SignedDelegate): Promise<void> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", encodeDelegateAction(sd.delegateAction)));
  const sig = sd.signature.ed25519Signature?.data;
  if (!sig || !sd.delegateAction.publicKey.verify(hash, sig)) {
    throw new ApiError(401, "E_BAD_SIGNATURE", "delegate signature does not verify");
  }
}
