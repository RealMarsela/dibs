# Lane C handback: services/api (Cloudflare Worker, Hono + zod, near-api-js 7.5.3)

Status: code complete, 53 Vitest tests pass, typecheck clean, `wrangler dev` smoke-tested against the real 1Click API
(dry only). NOT deployed; no R2 bucket created; no chain transaction of any kind sent. Deploy steps: `DEPLOY.md`.
Interface followed: `contracts/INTERFACE.md` v1 (1-based bed numbers, trip code 3-12 `[a-z0-9]`, sweep gas 300 Tgas).

## Test output
```
 Test Files  5 passed (5)
      Tests  53 passed (53)
```
Covered: zod rejection with `{error, code:"E_BAD_INPUT"}` (7 shapes plus bad JSON); relay refusing non-allowlisted receivers (5),
non-allowlisted methods (6), non-function-call actions, a smuggled second action, deposit and gas caps, tampered signature
(real ed25519 signing via near-api-js), expiry, per-sender rate limit, no key leak; sweep idempotence (sequential and 4-way
concurrent: exactly one on-chain call), failed-sweep retry, foreign recipient refused; blob size limit at exactly 2 MB and +1 byte,
content types, key length, AES-GCM round trip, sha256 of the ciphertext, 404 on bad ids. 1Click and RPC are mocked.

Smoke (`wrangler dev --env mainnet`, `dry:true`, recipient `app.near`): arb 0.25 -> amountIn 257006 / min 254480, eta 25s;
base 0.25 ok (eta 35s); sol 0.25 ok (refundFee 213406); base 0.10 -> 422 `E_QUOTE_REJECTED` "try at least 145556". Matches the preflight.
Local R2 blob upload then GET: served bytes hash equals the returned `blob_sha256`.

## Endpoints (errors are always `{ "error": string, "code"?: string }`; CORS from `ALLOWED_ORIGIN`)
- `GET /health` -> `{ok, network, contract, usdc, relayer}`
- `POST /quote` req `{trip, n, kind:"bed"|"wait", fromChain:"eth|arb|base|sol|pol|op", refundTo, dry?}` (`n` 1-based, strict, no extra keys;
  `dry_amount`/`dry_recipient` only with `dry:true`, which skips all chain reads). Price comes from `get_trip`, never the client.
  Checks the receipt account exists and has USDC storage (409 `E_RECEIPT_NOT_FOUND` / `E_RECEIPT_NOT_REGISTERED`).
  - testnet resp: `{mode:"testnet", depositAddress:"<bed account>", amountIn:"<price>", token:"<usdc>", expiresAt:null, instructions:[{step,text,call?}]}`
  - mainnet resp: `{mode:"oneclick", dry, depositAddress, amountIn, minAmountIn, amountOut, token:"<origin asset>", expiresAt, etaSeconds, refundFee, recipient}`
  - 1Click 400 -> 422 `E_QUOTE_REJECTED` (message carries the minimum); 5xx or network -> 502 `E_ONECLICK` / `E_ONECLICK_DOWN`.
- `GET /status/:depositAddress` takes a 1Click deposit address, or (testnet/direct) the receipt account itself.
  Resp `{mode:"oneclick"|"direct", status:"PENDING_DEPOSIT|PROCESSING|SUCCESS|REFUNDED|FAILED|...", recipient?, sweep:"not_ready|no_funds|in_progress|done|already_done", tx_hash?}`.
  On SUCCESS the recipient is read from 1Click and must match `^[bw]NN-<trip>.<dibs>$` (else 403 `E_NOT_OUR_RECEIPT`); price from `get_trip`;
  the receipt's USDC balance must be >= price; then the relayer calls `sweep{amount}`. Idempotence: create-only R2 marker
  `sweeps/<depositAddress>` plus an on-chain balance re-check. A failed sweep deletes its claim so the next poll retries; a stale claim (90 s) is taken over.
- `POST /relay` req `{signed_delegate:"<base64 borsh SignedDelegate, near-api-js encodeSignedDelegate>"}` -> `{tx_hash, sender, receiver}`.
  Policy: receiver is dibs or `[bw]NN-<trip>.<dibs>`; 1-4 function-call actions only; dibs methods `hold, reserve_wait, release_hold,
  list_for_resale, leave_waitlist, request_draw, submit_proof, refund_all, request_refund`; bed method `sweep`; deposit capped per method
  (hold/reserve_wait 0.01 NEAR, request_draw/submit_proof 0.1 NEAR, others 0); total gas <= 300 Tgas; sender != relayer;
  ed25519 signature verified before the relayer is touched; `max_block_height` checked; 20 relays/min per sender.
- `POST /hold` (EXTENSION, not in the brief) req `{trip, kind:"bed"|"wait", n, holder}` -> `{tx_hash, trip, kind, n, holder}`. The relayer calls `hold` /
  `reserve_wait` and pays the 0.00125 NEAR USDC-registration deposit, since a fresh passkey account has no NEAR. Rate limited per IP and per holder.
- `POST /proof-blob` multipart, field `file` (.eml; types message/rfc822, text/plain, application/octet-stream), max 2 MB ->
  `{blob_url, blob_sha256, size}`.
  **Stored layout (Lane B must decrypt this): `iv(12) || AES-256-GCM ciphertext || tag(16)`, no AAD, key = `DIBS_BLOB_KEY`
  (64 hex or base64, 32 bytes). `blob_sha256` is the sha256 of the stored ciphertext bytes (what GET /blob returns), not of the .eml.**
  `blob_url` = `<PUBLIC_BASE_URL>/blob/<64 hex from 32 random bytes>`. 10 uploads/min per IP.
- `GET /blob/:id` -> ciphertext bytes (`application/octet-stream`), else 404.
- `GET /trip/:code` -> `{code, network, contract, usdc, trip:<get_trip>, waitlist:<get_waitlist>, bed_accounts:[...], fetched_at}`; 2 s cache, `cache-control: public, max-age=2`.

## Open gaps / unverified
- UNVERIFIED on a real chain: `sweep`, `hold`, relay submission and the signed-delegate path were tested with mocks and local signing only; no testnet
  contract existed. First run after Lane A deploys: `/quote` (testnet) -> faucet pay -> `/status` -> trip shows Paid.
- Testnet faucet instruction step 1 assumes USDC `mint{amount}` (INTERFACE does not specify the faucet signature); fix in `src/quote.ts` if it differs.
- A delegate cannot carry NEAR for payable methods unless the sender holds NEAR: `submit_proof` and `request_draw` need >= 0.02 NEAR from the caller.
  A keyless passkey account has none, so fund the booker (~0.1 NEAR) or add a relayer-paid variant like `/hold`. Not built.
- Rate limits live in isolate memory: a best-effort brake only (no Durable Objects, by the cost rule).
- Relaying `ft_transfer` on USDC (pay from a NEAR-side balance) is deliberately not allowed (brief: receiver must be dibs or a bed account).
- `/hold` spends relayer NEAR for any caller (contract rules decide which holds succeed); bounded only by the rate limits.
- Relayer nonce handling is near-api-js's default; heavy concurrent relaying from one key may need a multi-key signer.
- Solana refunds cost about $0.21: the UI should warn (preflight decision); the API does not block.
- Repo-level: `pnpm-workspace.yaml` got `workerd: true` under `allowBuilds` (needed to install wrangler) and `pnpm-lock.yaml` changed. Both are outside Lane C
  paths and left uncommitted for the coordinator.
