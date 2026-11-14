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

## Live wiring (Lane G, testnet, deployed as dibs-api; 78 tests pass, tsc clean)
New bindings: KV `NAMES` (namespace DIBS_NAMES, id 80abbc4f...; display names and the per-trip activity log). New var `VERIFIER_PUBLIC_KEY`; secret `LITHIC_SIM_KEY`.
Endpoints (errors are `{error, code}`):
- `POST /testnet/fund {trip, kind:"bed"|"wait", n}` -> `{mint_tx, sweep_tx, status}`. 404 on mainnet; 409 E_NOT_HELD; 8 per 10 min per IP.
- `POST /account/bootstrap {account:<64 hex>}` -> `{account, created, tx_hash, exists}`; 0.01 NEAR exactly, only if the account is missing. `/hold` does the same first and adds `bootstrap_tx`.
- `PUT /names {account, name, ts, sig}` (sig hex or base64 over `dibs-name:v1:<account>:<name>:<ts>`; 401 E_BAD_SIG, 400 E_STALE) -> `{account, name}`; `GET /names?accounts=a,b` -> `{account: name}`; the nine demo friends are fixed.
- `POST /proof/submit {trip, blob_url, blob_sha256}` -> `{tx_hash}` (0.025 NEAR, 300 Tgas; blob_url must be one of our /blob URLs).
- `POST /draw {trip}` -> `{tx_hash}` (request_draw, 0.025 NEAR, 3 per min per trip). `POST /refund-check {trip, n}` -> `{code:"E_NO_REFUND", error, tx_hash, refused:true}`.
- `GET /trip/:code` now also has top-level `proof_pending, proof, payout, last_error`.
- `GET /trip/:code/activity` -> up to 20 `{at, kind, text, tx, chain?}`, newest first, 15 s cache, `[]` on failure. The dibs contract only logs refusals, and nearblocks gives no call arguments, so the feed is the API's own KV log of hold, deposit, proof, draw and refund-check calls plus contract-state events (refusal, proof accepted, payout done). Txs sent by users directly (not through the API) do not appear.
- `POST /card/:trip/issue` -> `{last4, spend_limit, mcc}`: relayer calls `outlayer.testnet request_execution` (0.02 NEAR, waits FINAL), decodes the op result, stores it through the /issued verification. Refusals pass through (E_NOT_FULL 409 etc.).
Verifier v5 (`dibs-verifier-testnet-v5.wasm`, sha256 d18d2946...da1c9) deployed; `public_key` op still 706445d7...06bf (tx 8QqWtkb1nok4n789UGxeztoa3g9GwfmrXh74KxS4Vw7x). Card op now seals a named booker (maya...) to its first FullAccess ed25519 key via view_access_key_list (tests added). Secrets: `LITHIC_API_KEY` added with `secrets update` (profile default, DIBS_BLOB_KEY kept).
Live txs: bootstrap a792f927... `95e88L62edHLgkYDDU8fpDUkkMfwC62Ug4SLup6vf995` (second call created:false); hold wait 1 sin1025 `13wPsJRCaHxrxKqWxoeRmzzi1hk7TVpTFikt2LhosJMU`; fund mint `DM3gJJ7iT8xiPoe6QizzZP5NBGmuH6nAe5XzieEeHTbW`, sweep `Fbs3M4gzqZMrVgMTKV14TjjHUXNdCobcGUbxJneVK2nB`; refund-check `J6aDm4oGLZmdghs1ewZ5ttMXpY9Q6qUCm7ZHZN9jnRrR` (E_NO_REFUND); submit_proof `GCqrapGpUEehTdPo73ufvSVq9pw2XXzM2BhtSK3X9jzt` (reached the verifier, stored E_NO_RESULT: no NEAR_AI_KEY yet); names PUT 200; /draw on drw0001 refused (already drawn), not proven with a new tx.
Card on drw0001 (limit $2.00, last4 3218, mcc 7011): electronics DECLINED PROGRAM_USAGE_RESTRICTION, Lithic id c76438be-c51e-4394-a4ce-c7918f75a175; carlton APPROVED, id c683d858-1459-4a49-85f2-236e0ccd8b23.
Bug fixed: `accountExists` misread RPC UNKNOWN_ACCOUNT as an RPC failure (now a raw view_account query).
Left: NEAR_AI_KEY (no .secrets/near-ai.env, inbox for sin1025 empty, so no accepted booking proof); /draw live success needs an undrawn paid trip.

## Trip creation (Lane I, testnet, deployed as dibs-api; 105 tests pass, tsc clean)
`POST /trips` lets a stranger create a real small trip. Body (zod, strict): `{place 2-40, stay 2-60, check_in, check_out (YYYY-MM-DD, out after in, both within 2 years, not in the past), beds 2-6, price_usdc 1-50 (integer dollars), booker (64-hex implicit account)}`. Control characters and `<>` are refused. Errors are `{error, code}`.
Returns `{code, url:"/t/<code>", tx_hash, hold_tx, inbox}`. Steps: view checks, then quota spend, then relayer `create_trip` (deposit = `create_cost{n_beds, n_wait:2}` + 0.02 NEAR margin, excess refunded by the contract, 300 Tgas), bootstrap the booker account if missing, relayer `hold` bed 1 for the booker, KV meta, activity log, Cloudflare Email Routing rule.
- Code: first 3 letters of the place (accents folded, padded with `x`) + 5 random `[a-z0-9]`, re-rolled if `get_trip` finds it. `book_by` = now + 3 days. `n_wait` fixed at 2.
- Money: every trip uses the SHARED demo crew DAO `lis0312-0eb9ae.sputnik-v2.testnet` (var `TRIP_DAO`; mainnet has none, so `POST /trips` answers 503 `E_NOT_CONFIGURED` there). Its policy gives dibs the trip role, and lis0314 already reuses it. The contract keeps the ledger per trip (each trip's own price, beds, paid state, payout and `refund_all` are by trip code), so trips sharing a DAO do not mix accounting; the only shared thing is the DAO's USDC balance. Trade-off: a payout or refund for one trip draws on that one balance, fine for a demo; production would use a DAO per trip (6 NEAR each).
- Meta: KV NAMES `trip/<code>` = `{code, place, stay, created_at, creator}`. `GET /trips/:code/meta` -> `{place, stay}` (404 E_NOT_FOUND without it; no country field is stored). `GET /trip/:code` now includes `meta:{place, stay}` when present.
- Inbox: Cloudflare API `POST /zones/<CF_ZONE_ID>/email/routing/rules`, literal rule `<code>@dibs.larinova.com` -> worker `dibs-inbox`, same as `services/inbox/scripts/add-trip-address.sh`. Wrangler secret `CF_EMAIL_TOKEN` (the vault Cloudflare token Lane E used; Email Routing edit scope verified by the live rule below). Vars `CF_ZONE_ID`, `MAIL_DOMAIN`. Missing token or Cloudflare refusal -> `inbox:null`, trip still created.
- Guardrails: 2 trips per IP per UTC day (E_RATE_LIMIT, 429) and 20 per day globally (E_DAILY_CAP, 429), KV counters with a 2 day TTL (KV is not atomic, so a burst can overshoot by a few). Quota is spent only after the cheap reads pass, so E_BAD_INPUT and RPC failures cost nothing. Relayer balance below 1 NEAR -> 503 `E_RELAYER_LOW`, checked before the quota is spent.
- Bug fixed on the way: `view` used the failover provider, which hides a contract panic, so `GET /trip/<unknown>` answered 502 E_RPC instead of 404. `view` now uses raw JSON-RPC with failover and maps the `E_NO_TRIP` panic to "not found" (3 tests).
- Test script: `node scripts/live-create-trip.mjs [api]` (throwaway ed25519 key as the booker, then `get_trip`).

Live (testnet): `POST /trips` for "Porto", 2 beds, 3 USDC, booker `c63b56f04e09afbd3be548c021bc65bf3edac39427e60f65da787f387d098bb4` (throwaway key) -> code `porp2te3`, create_trip tx `HtVsh8RWMWJRELQyQjQzeyWtxvJKQxJSYEuUGTNqPccY`, hold tx `GnQbN91cLW7ZLZuyUriNWT4Yfpgajaw3cJNo4WrdocGr`, inbox `porp2te3@dibs.larinova.com` (rule present in the zone). `get_trip porp2te3`: dao lis0312-0eb9ae..., booker matches, bed 1 `Held` by the booker. `GET /trips/porp2te3/meta` -> `{"place":"Porto","stay":"Ribeira river flat"}`. Live guardrail: a third request from the same IP -> 429 `{"error":"2 trips per person per day","code":"E_RATE_LIMIT"}` (the first attempt of the day failed on the RPC bug above, before the quota reorder, and still counted). The 20 per day cap and E_RELAYER_LOW are proven only by unit tests (mocked).
Relayer balance after the test: about 1.22 NEAR (a trip costs about 0.18 NEAR: 0.158 create_cost + 0.01 bootstrap + gas; the 0.02 margin comes back). Limits: only about one more trip before the 1 NEAR floor trips E_RELAYER_LOW, so top the relayer up with testnet NEAR before judging; one IP is capped at 2 trips a day.
