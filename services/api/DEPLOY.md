# Deploy dibs-api (coordinator runs this; Lane C did not deploy or create anything)

## 1. Fill `wrangler.toml` vars
`DIBS_CONTRACT`, `USDC_CONTRACT`, `RELAYER_ACCOUNT_ID` (testnet at top level, mainnet under `[env.mainnet.vars]`).
`NEAR_NETWORK` = `testnet|mainnet`, `NEAR_RPC_URLS` = comma list (first is primary, failover in order).
`PUBLIC_BASE_URL` = the Worker's public URL, no trailing slash (blob capability URLs are built from it; empty = request origin).

## 2. R2 bucket binding (`BLOBS`)
`wrangler r2 bucket create dibs-blobs-testnet` (and `dibs-blobs-mainnet`). One bucket holds both encrypted blobs (`blobs/<id>`)
and sweep idempotence markers (`sweeps/<depositAddress>`). Optionally add an R2 lifecycle rule to expire `blobs/` after 30 days.

## 3. Secrets (per env: add `--env mainnet` for mainnet)
| secret | what |
|---|---|
| `RELAYER_PRIVATE_KEY` | `ed25519:...` key of `RELAYER_ACCOUNT_ID`. Never logged. Fund it (sweeps, relays, holds cost NEAR). |
| `DIBS_BLOB_KEY` | 32 bytes, 64 hex chars (or base64). MUST equal the OutLayer sealed secret `DIBS_BLOB_KEY` (Lane B decrypts with it). `openssl rand -hex 32` |
| `ONECLICK_JWT` | optional; a partner JWT lowers the 0.25% unauthenticated fee. Omit to run keyless. |

Set with `wrangler secret put <NAME>`.

## 4. On-chain prerequisites
- Relayer account exists and the dibs owner called `add_relayer(relayer)` (needed for `POST /hold`).
- Receipt accounts exist and are USDC storage-registered before `/quote` (`create_trip` does this).

## 5. Deploy
```
cd services/api && pnpm install
pnpm test && pnpm typecheck
wrangler deploy                 # testnet
wrangler deploy --env mainnet   # mainnet, only with Gabriel's approved cap
```
Local: put the two secrets in `.dev.vars` (git-ignored) and run `wrangler dev` (`--env mainnet` for real 1Click quotes).
