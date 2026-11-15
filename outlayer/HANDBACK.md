# Lane B handback: outlayer/

## What works (verified)
- `cargo test --release` in `outlayer/verifier`: 21 passed, 0 failed, 1 ignored (the fixture generator). No network.
  Covered refusals, each asserted by exact code: tampered body (E_DKIM), tampered signed header (E_DKIM), From/signature
  misalignment (E_DKIM), no signature (E_DKIM), unknown DNS key (E_DKIM), domain not allowlisted (E_DOMAIN),
  amount over cap (E_OVER_CAP), wrong dates (E_DATES), wrong guests (E_GUESTS), wrong currency (E_CURRENCY),
  model facts not in the email (E_FACTS x3), blob hash (E_BLOB_HASH), wrong key / flipped tag (E_DECRYPT),
  bad trip / http url (E_INPUT). Passing: valid email, relaxed whitespace changes in transit, committed `valid.eml`.
  Signature test: ed25519 over `message` verifies, and fails for a one-digit change of `total`.
- Independent check: dkimpy verifies `tests/fixtures/valid.eml` True and `tampered_body.eml` False.
- wasm32-wasip2 builds clean (no warnings): testnet 595,229 bytes sha256
  `b2fcbd05ecffd31548b83f4a5b47352c1b888b881f09725ef02723e2ab13cef6`; mainnet 594,885 bytes sha256
  `2f147d7558110a748c8cd08dca40107f5357a5965c2136b38f3d11e0dbddaa49` (hashes change with any rebuild on another toolchain).
  Mainnet wasm contains no fixture domain (checked with `strings`). Manifest is embedded in the `outlayer.manifest` section.

## Not deployed (needs the team or the coordinator)
Deploy needs an OutLayer owner account with a key and about 0.1 NEAR testnet (`outlayer login testnet`, upload to
FastFS, `outlayer deploy dibs-verifier <url>`). No account was created or logged into. So **no public key yet**:
after deploying, `outlayer run <owner>/dibs-verifier '{"op":"public_key"}'` returns the key for `set_verifier_key`.
Also needed for a live booking run: `DIBS_BLOB_KEY` (same value as `services/api`) and a `NEAR_AI_KEY`, stored with
`outlayer secrets set ... --project <owner>/dibs-verifier`. Project id for the contract: `<owner>/dibs-verifier`.

## Interfaces
JSON shapes, error codes and the pipeline are in `outlayer/README.md`. Matches `contracts/INTERFACE.md`
(`max_total` string or number, `total` decimal string in 6-decimal units, top-level `message` and `signature`).

## Decisions and deviations
- `total` has no FX: the email amount is scaled by 10^6 and `currency` records the original code. `expect.currency` is
  optional; set it if the contract should refuse other currencies. A EUR booking is compared 1:1 against a USDC cap.
- Blob layout for Lane C: `iv(12) || ciphertext || tag(16)` AES-256-GCM, `blob_sha256` = hash of that stored blob.
- Test domain: `dibs-test.example` only in the `test-domain` feature build (testnet), with its public key built in (no DNS).
  Anyone can mint proofs for it (private test key is in the repo); the contract's domain allowlist must not include it on mainnet.
- `booking_ref` and `total` must literally appear in the DKIM-verified text, in addition to the model's extraction.
- Model `Qwen/Qwen3.8-27B` was chosen from `near_ai_tee_probe.json` (ed25519 signatures available). Unverified: no live
  NEAR AI call was made (no key); the request/response signature check is tested against a mock only.

## Known gaps (unverified)
- No run inside OutLayer (host imports for vrf/signing keys are unavailable locally), so the `public_key` and `vrf` ops,
  instruction counts and wasi-http calls to DoH, the blob host and cloud-api.near.ai are untested live.
- Real booking.com/airbnb emails were not available; DKIM is checked on generated fixtures and one independent verifier.
  Multipart/quoted-printable text extraction is lightly tested (plain text only in fixtures).
- DKIM `x=` expiry and `i=` are ignored; only rsa-sha256 (no ed25519-sha256, no rsa-sha1).
