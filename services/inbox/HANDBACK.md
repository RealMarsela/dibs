# Lane E handback: trip email inbox (services/inbox, Cloudflare Worker `dibs-inbox`)

Every trip has an address `<tripcode>@dibs.larinova.com`. The booker puts it in booking.com's guest contact email, so the
DKIM-signed confirmation arrives straight at the trip. A confirmation forwarded with Gmail "Forward as attachment" works too:
the inner message/rfc822 part is cut out byte for byte.

URL: https://dibs-inbox.gabrielaxy.workers.dev  (`GET /health`, `GET /inbox/:trip`). Testnet only. No email was sent by this lane.

## Flow (src/ingest.ts)
1. `email(message)`: recipient local part = trip code (`[a-z0-9]{3,12}`, `+tag` ignored); other addresses are rejected at SMTP.
2. `rawSize` and bytes limited to 2 MB, else `setReject`.
3. `get_trip` on testnet: an unknown trip is rejected at SMTP; an RPC outage keeps the mail (status `ready`).
4. `src/mime.ts` finds the first `message/rfc822` part (7bit/8bit/binary raw, base64 and QP decoded) and uses its bytes; otherwise the whole raw message.
   postal-mime is used only for From/Subject metadata: it rewrites CRLF to LF in 7bit parts, which changes the DKIM-covered bytes.
5. Encryption and storage: service binding `API` calls dibs-api `POST /proof-blob` (AES-256-GCM, iv(12)||ct||tag, key `DIBS_BLOB_KEY`, bucket
   `dibs-proof-blobs`, served by the API's `GET /blob/:id`). Reason: the key deployed on dibs-api is not the value in `services/api/.dev.vars`
   (checked: a blob from the deployed API does not decrypt with the local key), so the key stays in one place. Fallback without the binding:
   encrypt locally with a `DIBS_BLOB_KEY` secret in the same format (tested).
6. Index record `inbox/<trip>/<ms>-<hex>.json` in the same bucket: `{id, trip, blob_url, blob_sha256, received_at, from_domain,
   subject_hash, dkim_domain, wrapped, status, tx_hash?, note?}`. `GET /inbox/:trip` returns the latest 20 with no email content.
7. Auto-submit (`AUTO_SUBMIT=1`): only if a DKIM-Signature `d=` is booking.com / airbnb.com / hostelworld.com (or `dibs-test.example` when
   `ALLOW_TEST_DOMAIN=1`, testnet), every bed is `Paid`, no proof or pending proof, before `book_by`, and fewer than 3 relayer submits for the trip.
   Then the relayer calls `submit_proof{trip, blob_url, blob_sha256}` with 0.025 NEAR (contract needs >= 0.02, the rest returns). Statuses:
   `submitted` (tx_hash), `ready` (booker taps Release in the app; `note` says why), `submit_failed` (same; note has the chain error),
   `not_eligible` (no accepted DKIM domain, never spends NEAR). The proof stays the authority; payout still goes to the booker.

## Verifier change (outlayer/verifier)
`src/recipient.rs`: `addressed_to_trip(msg, trip)` is true when To, Delivered-To or X-Original-To holds exactly `<trip>@dibs.larinova.com`
(case-insensitive; not `...com.evil.example`, not `x<trip>@`, not a subdomain). `verify_booking` now returns `(Facts, Option<Attestation>, bool)`;
`main.rs` adds top-level `"to_trip": true|false` to the booking output. It is not in `facts` or the signed message, so the contract interface is unchanged.
Tests: `cargo test --release` 2 + 16 + 7 passed (new: `to_trip_is_set_only_when_...`, `to_trip_is_not_part_of_the_signed_message`, two in recipient.rs).
`cargo check --target wasm32-wasip2` is clean. The wasm was NOT rebuilt or redeployed (Lane D owns target/ and the OutLayer deploy); `to_trip` appears only after a rebuild.
Caveat: it is informational; `h=` coverage of the To header is not checked.

## Cloudflare changes (zone larinova.com, id bbaaf33c5998f5ebb76ea82164662d98)
Added by `POST /zones/{id}/email/routing/dns {"name":"dibs.larinova.com"}`:
- MX dibs.larinova.com -> route1.mx.cloudflare.net (71), route2.mx.cloudflare.net (1), route3.mx.cloudflare.net (52)
- TXT dibs.larinova.com `"v=spf1 include:_spf.mx.cloudflare.net ~all"`
- TXT cf2024-1._domainkey.larinova.com (Cloudflare's DKIM key at an apex name; added by the same call and locked by Email Routing, so it cannot be removed. It changes no MX or SPF.)

Side effect I reverted: the call also created an APEX `TXT larinova.com "v=spf1 include:_spf.mx.cloudflare.net ~all"`, which would have softfailed
Google Workspace mail. Deleted; the apex has only the Anthropic verification TXT again. Root MX (smtp.google.com) and every pre-existing record are
untouched (before/after diff of all 22 records shows only the additions above).
Zone-level Email Routing flag went `enabled:false` -> `enabled:true` (status `misconfigured` because the apex MX is Google; harmless).
Routing rules: the catch-all was `drop, disabled`; it is now `worker dibs-inbox, enabled`. New literal rule `lis0312@dibs.larinova.com` -> worker `dibs-inbox`.
IMPORTANT: Cloudflare documents catch-all as apex-only, so it probably does NOT cover `@dibs.larinova.com`. Each new trip address needs its own literal rule:
`services/inbox/scripts/add-trip-address.sh <trip> [...]` (needs CLOUDFLARE_API_TOKEN). Catch-all behaviour on the subdomain is unverified (no mail was sent).

## Deploy
`pnpm install` (workspace), then `cd services/inbox && pnpm test && pnpm typecheck && npx wrangler deploy`. Secrets on `dibs-inbox`: `RELAYER_PRIVATE_KEY`
(same as dibs-api; set). `DIBS_BLOB_KEY` only if the `API` service binding is removed. Vars live in wrangler.toml; `ALLOW_TEST_DOMAIN` must be `0` on mainnet.

## Contract dependency (Lane D)
submit_proof must accept the relayer. Lane D's working tree already carries it (`contracts/INTERFACE.md` v1.2 "booker or a relayer; payout only to the booker",
`oracle.rs` modified, uncommitted). Not verified on the deployed testnet contract. Needed on chain: `relayer.dao-0eb9ae.testnet` registered via `add_relayer`, and
enough NEAR on it (0.025 per submit, refunded minus the run fee). Until then a submit fails with `E_NOT_BOOKER` and the item shows `submit_failed`: the booker taps Release.

## Tests
`pnpm test`: 14 passed (unwrap 7bit and base64 byte-exact, direct mail, API binding, SMTP rejects for bad address / unknown trip / over 2 MB, no spend without
accepted DKIM, test domain off on mainnet, submit gating, E_NOT_BOOKER fallback, RPC outage, 3-submit cap, metadata-only listing).
Local e2e through the `wrangler dev` email endpoint with a real booking confirmation (private, never committed): direct, 7bit-wrapped and base64-wrapped all gave a
blob that decrypts to bytes identical to the original, and `dkimpy` `dkim.verify` on the decrypted bytes is True (the original also True). The same through the real
dibs-api code over the service binding (two workers in one `wrangler dev`).

## Live end-to-end test (needs a person to send mail; agents must not)
Pre: the trip exists on testnet and has its literal rule (lis0312 has one; others: `scripts/add-trip-address.sh <trip>`).
1. From any mailbox send an email to `lis0312@dibs.larinova.com`. Best: Gmail, open a real booking.com confirmation, More (three dots), "Forward as attachment", To `lis0312@dibs.larinova.com`.
2. Within seconds: `curl https://dibs-inbox.gabrielaxy.workers.dev/inbox/lis0312` shows one item. Expect `wrapped:true`, `dkim_domain:"booking.com"`,
   and `status` `submitted` (tx_hash) if all beds are Paid and the contract allows relayers, else `ready` or `submit_failed` with a `note`.
3. Logs: `npx wrangler tail dibs-inbox`. A mail to an unknown trip bounces at SMTP ("unknown trip").
4. Chain: `near view dibs-0eb9ae.testnet get_trip '{"trip":"lis0312"}'` shows `proof_pending`, then `proof` and `payout`. The booking must match the trip's dates and guest
   count (the seeded trip is 2027-03-12..15), otherwise the verifier refuses (`last_error`). A real mail refused for dates is the correct outcome.
5. Mail not DKIM-signed by booking.com, airbnb.com or hostelworld.com is stored as `not_eligible` and never auto-submitted.

## Known gaps
- No live inbound mail test, so MX and Worker routing are verified only by API readback and DNS lookups, not by delivery.
- Catch-all on the subdomain: see above.
- The index listing is an R2 prefix scan (fine for a demo, not for thousands of items per trip). The API's `/proof-blob` rate limit (10/min, shared for service-binding calls) applies.
- `pnpm-lock.yaml` changed with this package's install (shared file, left uncommitted).
