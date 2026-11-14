# dibs-verifier (OutLayer TEE app)

Rust `wasm32-wasip2` app run by OutLayer inside an Intel TDX enclave. It signs with the project's
ed25519 key (manifest path `dibs`, `caller: none`), which `contracts/dibs` pins with `set_verifier_key`.
Signed formats are the ones in `contracts/INTERFACE.md`; the code is in `verifier/`.

## Ops (stdin JSON in, one JSON object out; failure prints `{"error","code"}` and exits 1)

```
{"op":"public_key"}
  -> {"public_key":"<64 hex>"}

{"op":"vrf","trip":"lis0312","n":8}
  -> {"trip","n","output_hex":"<64 hex>","message":"dibs-vrf:v1:{\"trip\":..,\"output_hex\":..}",
      "signature":"<128 hex>","public_key":"<64 hex>","vrf_signature","vrf_alpha"}

{"op":"booking","trip":"lis0312","blob_url":"https://..","blob_sha256":"<64 hex>",
 "expect":{"check_in":"2026-12-03","check_out":"2026-12-07","guests":4,"max_total":"2000000000","currency":"EUR"}}
  -> {"facts":{trip,stay,check_in,check_out,guests,total,currency,dkim_domain,eml_sha256,booking_ref_hash},
      "message":"dibs-booking:v1:<facts, canonical order, no spaces>","signature":"<128 hex>",
      "public_key":"<64 hex>","near_ai":{model,chat_id,signature_kind,signing_algo,signing_address,text,signature,verified}}
```

- `max_total` accepts a decimal string or a number. `expect.currency` is optional (absent: any ISO currency).
- `total` in facts is a decimal string in 6-decimal base units of the email's currency, no FX: an email total
  of `1,480.00` becomes `"1480000000"`. `max_total` is on the same scale.
- Error codes: `E_INPUT E_SECRET E_BLOB_FETCH E_BLOB_HASH E_DECRYPT E_EML E_DKIM E_DOMAIN E_EXTRACT E_FACTS
  E_DATES E_GUESTS E_CURRENCY E_OVER_CAP E_KEY E_SIGN E_VRF`.
- VRF: `vrf::random(trip)` returns OutLayer's VRF output (alpha `vrf:{request_id}:{sender}:{trip}`); the app
  re-signs `{trip, output_hex}` with the project key so the contract pins one key. Disclosed caveat from
  OutLayer's VRF.md: verifiable (no re-roll), not provably unpredictable while the DAO holds the master.

## Booking pipeline (each step is a refusal point, each has a test)

1. fetch `blob_url` (https only, max 3 MB) and check `sha256(blob) == blob_sha256`;
2. AES-256-GCM decrypt, blob layout `iv(12) || ciphertext || tag(16)` (WebCrypto layout), key = secret
   `DIBS_BLOB_KEY` (64 hex or base64 of 32 bytes). Lane C must encrypt exactly like this;
3. DKIM (`src/dkim.rs`, pure Rust, `rsa` + `sha2`): v=1, rsa-sha256, simple or relaxed canonicalization,
   `h=` must cover From, From domain must align with `d=`, body hash, `l=`, RSA key via DoH TXT
   (`https://cloudflare-dns.com/dns-query`), key >= 1024 bits. Signature expiry (`x=`) is not checked;
4. `d=` must be `booking.com`, `airbnb.com`, `hostelworld.com` (or a subdomain). The fixture domain
   `dibs-test.example` is compiled in only with `--features test-domain` (the testnet wasm), its key record is built in;
5. NEAR AI Cloud `POST /v1/chat/completions` (model `Qwen/Qwen3.8-27B`, TEE, temperature 0, JSON object,
   canonical id, `x-no-aliasing`), strict JSON facts (unknown or missing keys refuse); then
   `GET /v1/signature/{id}?signing_algo=ed25519`, verified over `<model>:<sha256(req)>:<sha256(resp)>`
   (`near_ai.verified`; a missing signature does not refuse the run, the project signature is the verdict);
6. grounding: the booking reference and the total must literally appear in the DKIM-verified text, so a
   model hallucination or injection cannot move money;
7. dates equal `expect`, guests equal `expect.guests`, total <= `max_total`, optional currency match.
   Output carries only the facts above: never names, address, card, or the raw email.

## Build, test, deploy

```bash
cd verifier
./build.sh testnet   # tests + wasm with the fixture domain   -> <repo>/target/dibs-verifier-testnet.wasm
./build.sh mainnet   # tests + wasm without it                -> <repo>/target/dibs-verifier-mainnet.wasm
```

Tests: `cargo test --release` (21 tests, no network). `tests/fixtures/*.eml` are signed with the committed
**test-only** key `dibs_test_dkim_key.pem` (published on purpose; the testnet wasm trusts it).
Regenerate: `cargo test --release --test misc regenerate_fixtures -- --ignored`. The valid fixture was also
verified by an independent implementation (dkimpy 1.x), and its tampered twin was rejected.

Deploy (same flow as `near-standin/outlayer`, needs a funded testnet account, not done by this lane):

```bash
outlayer login testnet                       # key of the owner account
outlayer upload <repo>/target/dibs-verifier-testnet.wasm
outlayer deploy dibs-verifier <FastFS URL>   # ~0.1 NEAR attached, unused refunded
outlayer run <owner>/dibs-verifier '{"op":"public_key"}'    # the key for set_verifier_key
outlayer secrets set '{"DIBS_BLOB_KEY":"<64 hex>","NEAR_AI_KEY":"<key>"}' --project <owner>/dibs-verifier
```

Secrets: runs read them as env vars. For the contract path, add `"author_secrets":{"profile":"default"}` to
`verifier/manifest.json` (a profile nobody stored refuses the run, so add it only after storing) or have the
caller name a secrets profile in `request_execution`. Use the same `DIBS_BLOB_KEY` as `services/api`.

## Cost and limits

OutLayer mainnet: 0.001 NEAR base + 1e-4 NEAR per 1M instructions + 1e-7 NEAR per ms; an estimated
2B-instruction, 60 s run is about 0.007 NEAR (~$0.025). Attach 0.02 NEAR, the rest is refunded. Booking runs
make 4 to 5 outbound calls (blob, DoH, completion, signature); ask for `max_execution_seconds` 60.
RSA verification in wasm is pure Rust, expected well under 2B instructions (unmeasured here).
