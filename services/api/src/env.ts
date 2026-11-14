export interface Env {
  NEAR_NETWORK: string;
  NEAR_RPC_URLS: string;
  ONECLICK_URL: string;
  DIBS_CONTRACT: string;
  USDC_CONTRACT: string;
  RELAYER_ACCOUNT_ID: string;
  ALLOWED_ORIGIN?: string;
  PUBLIC_BASE_URL?: string;
  /** Hex ed25519 public key of the dibs-verifier project (`outlayer run ... '{"op":"public_key"}'`). */
  VERIFIER_PUBLIC_KEY?: string;
  /** Shared crew DAO every API-created trip pays into (its policy gives dibs the trip role). */
  TRIP_DAO?: string;
  /** Cloudflare zone and mail domain for per-trip inbox rules. */
  CF_ZONE_ID?: string;
  MAIL_DOMAIN?: string;
  /** Override for tests; default https://sandbox.lithic.com */
  LITHIC_BASE?: string;
  // secrets
  RELAYER_PRIVATE_KEY: string;
  DIBS_BLOB_KEY: string;
  ONECLICK_JWT?: string;
  /** Lithic SANDBOX key, used only by POST /card/:trip/simulate. */
  LITHIC_SIM_KEY?: string;
  /** Cloudflare API token with Email Routing edit scope (per-trip inbox rules). Optional: without it inbox is null. */
  CF_EMAIL_TOKEN?: string;
  BLOBS: R2Bucket;
  /** Display names and the per-trip activity log. */
  NAMES: KVNamespace;
}

export const isTestnet = (env: Env): boolean => env.NEAR_NETWORK !== "mainnet";

export const rpcUrls = (env: Env): string[] =>
  env.NEAR_RPC_URLS.split(",").map((s) => s.trim()).filter(Boolean);

/** Bed receipt account: b03-lis0312.<dibs>; waitlist: w02-lis0312.<dibs>. */
export function receiptAccount(env: Env, kind: "bed" | "wait", trip: string, n: number): string {
  const nn = String(n).padStart(2, "0");
  return `${kind === "bed" ? "b" : "w"}${nn}-${trip}.${env.DIBS_CONTRACT}`;
}

export function receiptRegex(env: Env): RegExp {
  const dibs = env.DIBS_CONTRACT.replace(/[.]/g, "\\.");
  return new RegExp(`^([bw])(\\d{2})-([a-z0-9]{3,12})\\.${dibs}$`);
}
