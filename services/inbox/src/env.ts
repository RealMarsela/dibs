export interface Env {
  NEAR_NETWORK: string;
  NEAR_RPC_URLS: string;
  DIBS_CONTRACT: string;
  RELAYER_ACCOUNT_ID: string;
  MAIL_DOMAIN: string;
  PUBLIC_BASE_URL: string;
  ALLOWED_ORIGIN?: string;
  ALLOW_TEST_DOMAIN?: string;
  AUTO_SUBMIT?: string;
  // Preferred: service binding to dibs-api, so its POST /proof-blob encrypts and stores (one key, one place).
  API?: Fetcher;
  // Fallback when no binding: encrypt here (must equal the API and OutLayer secret).
  DIBS_BLOB_KEY?: string;
  RELAYER_PRIVATE_KEY?: string;
  BLOBS: R2Bucket;
}

export const MAX_EML_BYTES = 2 * 1024 * 1024;
export const TRIP_RE = /^[a-z0-9]{3,12}$/;
