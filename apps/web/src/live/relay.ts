import { KeyPair, KeyPairSigner, actions, buildDelegateAction, encodeSignedDelegate } from "near-api-js";
import { network, relay } from "@/live/api";
import { nearRpc } from "@/live/near-rpc";
import type { DeviceKey } from "@/live/passkey";

/* Gasless calls: the friend's passkey key signs a NEP-366 delegate action; the API's relayer submits it and pays
   the gas. The relayer only forwards calls to the dibs contract or a bed account, with an allowlist of methods. */
async function rpc<T>(method: string, params: unknown): Promise<T> {
  const j = await nearRpc<T>(network(), method, params);
  if (j.error) throw new Error(j.error?.cause?.name ?? j.error?.message ?? "rpc error");
  return j.result as T;
}

export async function gasless(key: DeviceKey, receiverId: string, method: string, args: Record<string, unknown>, gasTgas = 100, depositYocto = 0n) {
  const signer = new KeyPairSigner(KeyPair.fromString(key.secret() as `ed25519:${string}`));
  const publicKey = await signer.getPublicKey();
  const ak = await rpc<{ nonce: number; block_height: number }>("query", {
    request_type: "view_access_key",
    finality: "final",
    account_id: key.accountId,
    public_key: publicKey.toString(),
  });
  const da = buildDelegateAction({
    senderId: key.accountId,
    receiverId,
    actions: [actions.functionCall(method, args, BigInt(gasTgas) * 1_000_000_000_000n, depositYocto)],
    nonce: BigInt(ak.nonce) + 1n,
    maxBlockHeight: BigInt(ak.block_height) + 120n,
    publicKey,
  });
  const { signedDelegate } = await signer.signDelegateAction(da);
  const b64 = btoa(String.fromCharCode(...encodeSignedDelegate(signedDelegate)));
  return relay(b64);
}
