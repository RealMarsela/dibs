import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { z } from "zod";
import { consumeNonce, authFail, erc191Message } from "./nep413";
import type { Env } from "./env";

/** ERC-191 personal_sign proofs: an EVM wallet (NEAR Connect "Ethereum Wallets") proves control of its eth-implicit account. */
export const erc191ProofSchema = z
  .object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "0x + 40 hex"),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "0x + 130 hex (r, s, v)"),
    nonce: z.string().regex(/^[0-9a-f]{64}$/, "64 hex chars"),
    message: z.string().max(300),
  })
  .strict();
export type Erc191Proof = z.infer<typeof erc191ProofSchema>;

const hexToBytes = (h: string): Uint8Array => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** keccak256("\x19Ethereum Signed Message:\n" + utf8 byte length + message). */
export function erc191Hash(message: string): Uint8Array {
  const body = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${body.length}`);
  const all = new Uint8Array(prefix.length + body.length);
  all.set(prefix, 0);
  all.set(body, prefix.length);
  return keccak_256(all);
}

/** Recovers the lowercase 0x address that signed the message, or null when the signature is malformed. */
export function recoverErc191Address(message: string, signature: string): string | null {
  try {
    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return null;
    const raw = hexToBytes(signature.slice(2));
    const v = raw[64]!;
    const recovery = v >= 27 ? v - 27 : v;
    if (recovery !== 0 && recovery !== 1) return null;
    const pub = secp256k1.Signature.fromCompact(raw.slice(0, 64)).addRecoveryBit(recovery).recoverPublicKey(erc191Hash(message)).toRawBytes(false);
    return "0x" + toHex(keccak_256(pub.slice(1)).slice(-20));
  } catch {
    return null;
  }
}

/** Verifies an ERC-191 proof end to end and returns the proven lowercase address. Consumes the nonce. */
export async function verifyErc191(env: Env, proof: Erc191Proof): Promise<string> {
  if (proof.message !== erc191Message(proof.nonce)) throw authFail("E_AUTH_MESSAGE", "signed message does not match");
  await consumeNonce(env, proof.nonce);
  const addr = recoverErc191Address(proof.message, proof.signature);
  if (!addr || addr !== proof.address.toLowerCase()) throw authFail("E_AUTH_SIG", "signature does not verify");
  return addr;
}
