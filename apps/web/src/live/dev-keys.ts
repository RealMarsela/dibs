import type { DeviceKey } from "@/live/passkey";
import { KeyPair } from "near-api-js";

/* Local development only (localhost): lets one browser act as a named testnet demo persona whose key was
   created for this project (e.g. ana.own-0eb9ae.testnet), so the film can show Ana listing her own bed with her
   own key. Production builds ignore this entirely; real visitors always use their passkey-derived key. */
const STORE = "dibs.dev.keys";

export const DEV = import.meta.env.DEV;

export function devAccounts(): string[] {
  if (!DEV) return [];
  try {
    return Object.keys(JSON.parse(localStorage.getItem(STORE) ?? "{}"));
  } catch {
    return [];
  }
}

export function devKey(account: string): DeviceKey | null {
  if (!DEV) return null;
  try {
    const secret = (JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, string>)[account];
    if (!secret) return null;
    const kp = KeyPair.fromString(secret as `ed25519:${string}`);
    const pub = kp.getPublicKey().data;
    return {
      accountId: account,
      publicKey: pub,
      kind: "device",
      sign: async (msg) => kp.sign(msg).signature,
      secret: () => secret,
    };
  } catch {
    return null;
  }
}
