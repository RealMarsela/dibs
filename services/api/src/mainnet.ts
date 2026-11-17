import type { Env } from "./env";

/*
 * Mainnet rides on the same worker under /mainnet/*. It is deliberately narrow: reading trips, holding a bed,
 * a real NEAR Intents 1Click quote, telling 1Click which wallet transaction paid it, and the status poll that sweeps a funded bed. Everything that would spend the
 * relayer's NEAR on anything else (trip creation, proofs, draws, cards, account bootstraps, gasless relays) stays
 * on testnet and is refused here with E_MAINNET_SCOPE.
 */
export interface MainnetVars {
  MAINNET_RPC_URLS?: string;
  MAINNET_DIBS_CONTRACT?: string;
  MAINNET_USDC_CONTRACT?: string;
  MAINNET_RELAYER_ACCOUNT_ID?: string;
  MAINNET_RELAYER_PRIVATE_KEY?: string;
}

const ALLOWED: [string, RegExp][] = [
  ["GET", /^\/health$/],
  ["GET", /^\/trip\/[a-z0-9]{3,12}$/],
  ["GET", /^\/trip\/[a-z0-9]{3,12}\/activity$/],
  ["GET", /^\/names$/],
  ["PUT", /^\/names$/],
  ["POST", /^\/hold$/],
  ["POST", /^\/quote$/],
  ["GET", /^\/status\/[^/]+$/],
  ["POST", /^\/deposit\/submit$/],
  ["POST", /^\/receipt\/wallet-pay$/],
];

export const mainnetAllowed = (method: string, path: string): boolean =>
  method === "OPTIONS" || ALLOWED.some(([m, re]) => m === method && re.test(path));

export const isMainnetPath = (path: string): boolean => path === "/mainnet" || path.startsWith("/mainnet/");

/** The testnet env with every network-specific value swapped for its mainnet twin. Null when not configured. */
export function mainnetEnv(env: Env & MainnetVars): Env | null {
  if (!env.MAINNET_DIBS_CONTRACT || !env.MAINNET_USDC_CONTRACT || !env.MAINNET_RELAYER_ACCOUNT_ID || !env.MAINNET_RPC_URLS) return null;
  return {
    ...env,
    NEAR_NETWORK: "mainnet",
    NEAR_RPC_URLS: env.MAINNET_RPC_URLS,
    DIBS_CONTRACT: env.MAINNET_DIBS_CONTRACT,
    USDC_CONTRACT: env.MAINNET_USDC_CONTRACT,
    RELAYER_ACCOUNT_ID: env.MAINNET_RELAYER_ACCOUNT_ID,
    RELAYER_PRIVATE_KEY: env.MAINNET_RELAYER_PRIVATE_KEY ?? "",
    PUBLIC_BASE_URL: env.PUBLIC_BASE_URL ? `${env.PUBLIC_BASE_URL}/mainnet` : "",
    TRIP_DAO: undefined,
    VERIFIER_PUBLIC_KEY: undefined,
    CF_EMAIL_TOKEN: undefined,
    LITHIC_SIM_KEY: undefined,
  };
}
