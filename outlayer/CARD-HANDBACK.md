# Lane F handback: trip virtual card (Lithic sandbox, issued by the TEE)

When every bed is Paid, the dibs-verifier TEE issues ONE single-use virtual card for the trip: limit = the pot, declines
everything but lodging (MCC 7011), details sealed to the booker's passkey key. The booker books with the trip's card and never
touches the crew's money. The issuer key (`LITHIC_API_KEY`) is an OutLayer sealed secret; the API holds a separate sandbox key
(`LITHIC_SIM_KEY`) used ONLY to run the demo card terminal.

## Real sandbox results (fake trip state, real Lithic; `outlayer/verifier/examples/card_live.rs`)
Trip `live5539`, 4 beds x 250 USDC = $1,000.00 -> spend_limit 100000 cents, card last4 8087. Lithic request ids (x-correlation-id):
- issue: `POST /v1/cards` 43c73b65-f0ec-4f2a-a73e-cee6f62e6a58; `POST /v2/auth_rules` 403ea1d9-3b58-4efe-a6ee-bc8aef87a7dc; promote 61f9ee70-ebce-4a72-9386-3397d7942d2f
- VOLTCITY ELECTRONICS, MCC 5732, $1,000: **DECLINED**, rule result `PROGRAM_USAGE_RESTRICTION` (our lodging-only auth rule). simulate cd0b0034-91cc-40dc-b630-f1fc5544209e
- CARLTON CITY HOTEL SG, MCC 7011, $1,000: **APPROVED**. simulate 9714f4d9-ee82-4f58-ab32-fd30c713d2ec
Further live runs:
- Retry of the same trip (idempotence): the same card token is returned (no second card), both further charges **CARD_CLOSED** (single use is consumed after the approved hotel charge). simulate f6f94555-1702-4a1c-a2b7-69543a3fa9f2, a06a3b81-ce92-4a1d-80e3-101d64f5edc0
- Trip `over0001`, hotel MCC 7011 for pot + $0.01: **USER_TRANSACTION_LIMIT** (limit enforced). simulate b89d360a-ee94-4f9b-af16-019e54765625 (card issue ae83d2a7-30d2-43cf-9f56-92cac9340637)
Only last4 was ever printed; the PAN was opened from the sealed box with the booker's key inside the example and never logged.

## Tests
- `cd outlayer/verifier && cargo test --release`: all green (existing 21 + `tests/card.rs` 8 new). New tests: signed message bytes and ed25519 verify, only the booker's key
  opens the box, no PAN/CVV in the output, Lithic request shapes (SINGLE_USE, spend_limit = pot, lodging-only IS_NOT_ONE_OF [7011] + promote), refusal when any bed is Open/Held/Listed,
  payout started or proof stored, refunded, non-implicit booker (no card minted), non-testnet network, off-allowlist contract, issuer failure, retry adopting the existing card and ACTIVE rule, rounding of the pot, libsodium golden vector.
- `node --test outlayer/card-compat/card.test.ts`: 5 pass (RFC 7748 X25519 vector; a box made by libsodium via PyNaCl and a box made by the Rust verifier both open in TypeScript from the `DeviceKey.secret()` string; wrong key and tampered box refused). Vector: `outlayer/verifier/tests/fixtures/card-golden.json`.
- `cd services/api && npx vitest run`: 61 pass (53 old + 8 card). `npx tsc --noEmit` clean.
- `cargo build --target wasm32-wasip2 --release --features test-domain` builds (651,189 bytes, sha256 3a92763d...b595, unsigned dev build, not uploaded).

## Op `card` (outlayer/verifier/src/{card,lithic,seal}.rs)
Input `{"op":"card","trip":"<code>","network":"testnet","contract":"<optional, must be on the allowlist>"}`. Contract default and allowlist: `dibs-0eb9ae.testnet` (`ALLOWED_TESTNET` in card.rs; add a redeployed id there).
Flow: view `get_trip` over NEAR RPC (test.rpc.fastnear.com) -> require all beds `Paid`, `payout == "None"`, no proof, not refunded, booker is an implicit account -> pot = price x n_beds, cents = pot / 10,000 ->
Lithic card + Auth Rule -> seal -> sign. Output: `{trip, card_token, last4, spend_limit, mcc, sealed_hex, message, signature, public_key}`, where
`message = "dibs-card:v1:" + {"trip","card_token","last4","spend_limit","mcc","sealed_hex"}` (that key order, no whitespace), ed25519 by the project key like the other ops.
Errors `{error, code}`: E_INPUT E_NETWORK E_CONTRACT E_SECRET E_RPC E_NO_TRIP E_TRIP_STATE E_NOT_FULL E_PAYOUT_STARTED E_REFUNDED E_POT E_BOOKER E_ISSUER E_SEAL E_SIGN E_KEY.
- Seal: libsodium `crypto_box_seal` to the booker's ed25519 key converted to X25519 (`epk || XSalsa20-Poly1305`, nonce blake2b-24(epk||pk)). The ephemeral key is derived from sha256(LITHIC key, trip, card token), so no RNG is needed in the wasm guest and a retry yields identical bytes.
- Idempotence: Lithic `Idempotency-Key = dibs-card-<trip>`. Observed live: a replay after the card was modified (rule attached) returns 409 `conflicts_with` the card; the op reads that card back, checks memo `dibs <trip>` and the limit, and adopts it; the rule 409 is adopted the same way. wasm HTTP errors now carry up to 300 chars of the response body for this.
- Lodging lock: Lithic v2 Auth Rules work in the sandbox: `CONDITIONAL_ACTION`, event_stream `AUTHORIZATION`, DECLINE when `MCC IS_NOT_ONE_OF ["7011"]`, attached by `card_tokens`, created as a draft and then `/promote`d to ACTIVE.
  (The brief's `CONDITIONAL_BLOCK` and `spend_limit_duration:"TRANSACTION"` do not exist/apply: Lithic rejects the type, and SINGLE_USE cards come back with duration FOREVER, which is fine because the card closes after one approval.)
- Booker must be an implicit account (64 hex ed25519 key = the passkey account). The three seeded testnet trips use named bookers (`maya.own-0eb9ae.testnet`), so `card` refuses them with E_BOOKER. The card demo trip must be created with the booker set to a passkey account id.

## Frontend: apps/web/src/live/card.ts (only file touched in apps/web)
`openCard(sealedHex, key.secret()) -> {pan, cvv, exp:"MM/YYYY"}` (also accepts a raw 32-byte seed or 64 hex), `groupPan(pan)`. Dependency-free (X25519, XSalsa20, Poly1305 written out; BLAKE2b and SHA-512 from the already-installed @noble/hashes), so no package.json change.

## API (services/api/src/card.ts, cardsim.ts; env.ts and index.ts touched minimally)
- `POST /card/:trip/issued` body `{message, signature}` (the OutLayer `card` output). Verifies the ed25519 signature against `VERIFIER_PUBLIC_KEY`, prefix, strict zod facts, `trip` equals the path. Stored once in R2 `cards/<trip>.json`.
  200 `{last4, spend_limit, mcc, sealed_hex, issued_at, simulations, stored}`; 400 E_BAD_INPUT/E_BAD_PREFIX/E_BAD_FACTS/E_TRIP_MISMATCH; 403 E_BAD_SIG; 409 E_CARD_EXISTS (a different card); 503 E_VERIFIER_UNCONFIGURED. Same card posted again: 200 `stored:false`.
- `GET /card/:trip` -> `{last4, spend_limit, mcc, sealed_hex, issued_at, simulations[]}`; 404 E_NO_CARD. The card token is not exposed.
- `POST /card/:trip/simulate` body `{"merchant":"carlton"|"electronics"}` -> `{merchant, descriptor, mcc, amount, approved, result, reason, lithic_request_id, at}`. Carlton = `CARLTON CITY HOTEL SG` MCC 7011, electronics = `VOLTCITY ELECTRONICS` MCC 5732, amount = spend_limit. 12/min per IP.
  Lithic caps descriptors at 25 chars, so it is `CARLTON CITY HOTEL SG`, not `... SINGAPORE`. 404 E_NO_CARD, 503 E_SIM_UNCONFIGURED, 502 E_ISSUER / E_ISSUER_DOWN. Results are appended to `simulations` (last 20).
- Sandbox-only shortcut: `simulate/authorize` needs the card number, so the API reads the sandbox card by token with `LITHIC_SIM_KEY` (the sandbox returns PAN on GET). It never returns or stores the PAN (tested). A real issuing program has no such call.

## Deploy / secret commands (NOT run: the new wasm is not deployed; `secrets set` would overwrite, so use `update`)
Lane D's testnet exists (`deploy/testnet.json`: project `own-0eb9ae.testnet/dibs-verifier`, api https://api.dibs.larinova.com, verifier key `706445d7...06bf`). Needed, in order, by whoever owns deploys:
```bash
# 1. new verifier version containing op "card" (tests first), then upload + deploy as Lane D did for v4
cd outlayer/verifier && ./build.sh testnet            # -> target/dibs-verifier-testnet.wasm
# upload and `outlayer deploy dibs-verifier <url>` per outlayer/README.md; re-check `{"op":"public_key"}` still equals the pinned key
# 2. issuer key as a sealed secret (merge, keeps DIBS_BLOB_KEY); value from .secrets/lithic.env
set -a; . .secrets/lithic.env; set +a
outlayer secrets update "{\"LITHIC_API_KEY\":\"$LITHIC_SANDBOX_KEY\"}" --project own-0eb9ae.testnet/dibs-verifier
# 3. API worker: sim key + pinned verifier key + redeploy
cd services/api
printf %s "$LITHIC_SANDBOX_KEY" | wrangler secret put LITHIC_SIM_KEY
# add to [vars] in wrangler.toml: VERIFIER_PUBLIC_KEY = "706445d7daa364e38ea0f410fc3279c83b6200c5cfd89983546b8fecbb3706bf"
wrangler deploy
# 4. issue for a real trip (booker must be a passkey/implicit account), then post the output to the API
outlayer run own-0eb9ae.testnet/dibs-verifier '{"op":"card","trip":"<code>","network":"testnet"}'
curl -X POST https://api.dibs.larinova.com/card/<code>/issued -H 'content-type: application/json' -d '{"message":"...","signature":"..."}'
```
Also check: the manifest `author_secrets.profile "default"` must be the profile `LITHIC_API_KEY` is stored under (it is the one DIBS_BLOB_KEY uses).

## Honest limits
- Lithic SANDBOX only: no real money moves, the card is not usable at a real merchant, simulate/authorize is a sandbox tool. Real issuing needs a Lithic (or other BIN-sponsor) card program, KYB, and a funding source; a PCI-scoped reveal of the PAN would replace the sandbox read-back.
- The pot is not actually held at the issuer: the sandbox card limit is a number equal to the pot, not funded by the DAO's USDC. In production the DAO payout would fund the issuer account (a stablecoin on-ramp to the program), which is not built.
- The card flow runs beside the existing "pay the booker on a verified email" payout, it does not replace it; the `card` op refuses once a payout has started, but the contract does not itself block payout after a card is issued (no card state on chain).
- Not yet run inside OutLayer itself (no deploy): the TEE path (HostSigner, wasi-http to NEAR RPC and Lithic) is untested live; the logic is covered natively and the wasm builds. Wasm HTTP idempotency headers are untested there.
- `get_trip` is read at `final` finality; a bed that flipped back (resale listing) between the read and issue is not caught. The check rules out refunded and payout-started trips.
- The API trusts the verifier signature, not the chain, on `/issued`; simulations are public per trip code (rate limited per isolate, best effort). No mainnet, no logins, no spending beyond the sandbox.
