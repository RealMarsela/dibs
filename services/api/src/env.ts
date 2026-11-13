export interface Env {
  NEAR_NETWORK: string;
  NEAR_RPC_URLS: string;
  ONECLICK_URL: string;
  DIBS_CONTRACT: string;
  USDC_CONTRACT: string;
  RELAYER_ACCOUNT_ID: string;
  ALLOWED_ORIGIN?: string;
  PUBLIC_BASE_URL?: string;
  // secrets
  RELAYER_PRIVATE_KEY: string;
  DIBS_BLOB_KEY: string;
  ONECLICK_JWT?: string;
  BLOBS: R2Bucket;
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
