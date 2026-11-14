# Judges: a five-minute path

Dibs is live on NEAR **testnet**. Contract `dibs-0eb9ae.testnet`, trips `lis0312`, `lis0314`, `sin1025`, `drw0001`.
All ids and transaction hashes: `deploy/testnet.json`. Explorer: https://testnet.nearblocks.io

## 1. Verify the live deployment (about 10 seconds, read-only)

```bash
pnpm verify        # or: node scripts/verify.mjs   (Node 20+, no install needed)
```

It reads testnet RPC (three fallback endpoints, retries on 429) and the public API, prints a table of check marks with
evidence and tx links, and exits non-zero if any check fails. It proves, against the chain and not against this repo:

| check | what it proves |
|---|---|
| a | the deployed contract's code hash equals the wasm sha256 recorded in `deploy/testnet.json` |
| b | each trip exists with the right number of beds, its waitlist, and its own Sputnik DAO |
| c | `sin1025`: a booking.com DKIM-verified proof is stored (dates, guests match the trip), the payout state is `Done`, the DAO's USDC fell by exactly the booking total and the booker holds it |
| d | `lis0312`: the VRF draw is a permutation of 1..8, from a recorded `request_draw` tx |
| e | `check_proof` with a forged signature returns `E_BAD_SIG` (wrong prefix: `E_BAD_PREFIX`) |
| f | a recorded `request_refund` tx failed with `E_NO_REFUND` (it is a call, not a view, so the proof is the failed tx) |
| g | the verifier key pinned in the contract equals the OutLayer project key in `deploy/testnet.json` |
| h, i | the API answers, and the trip card on `lis0312` shows last4 and MCC 7011, approved at a hotel and declined at an electronics store (Lithic sandbox) |

Key transactions it cites: booking proof accepted `54g9Y2qgKPNFamFeN6tQUgpR1AqU322F1J184LB8mYKr`, VRF draw
`3RDs4qUK27Jfthi1NhNz7hsoYJtmh5N6j5o1BtjQfBSV`, refusal `J6aDm4oGLZmdghs1ewZ5ttMXpY9Q6qUCm7ZHZN9jnRrR`.

## 2. Open the app

https://preview.dibs-trips.pages.dev/t/lis0312

## 3. What to look at

- The trip board: eight beds, each a real keyless account (`b01-lis0312.dibs-0eb9ae.testnet` ...). Paid state is read from the chain.
- The pay sheet: a bed is paid by sending exactly the price in USDC to its account; the contract then forwards it to the crew DAO.
- The draw (VRF) result, the waitlist, resale at face value only (there is no price field).
- The booking proof sheet and the trip card (last4 0810): the card is issued only when every bed is Paid, limited to the pot, lodging only.
- There is no refund button on purpose: `request_refund` always refuses. Money only moves to a booker who proves a booking.
- Open any tx link from step 1 to compare the app with the chain.

## 4. Contract sandbox suite (heaviest step; needs a toolchain)

```bash
cd contracts && scripts/fetch-sputnik.sh && scripts/build.sh sandbox && cd tests && cargo test
```

Requirements: Rust via rustup (the repo pins `1.86.0` for the contracts and `nightly-2026-08-21` for `contracts/tests`, installed
automatically by rustup), the `wasm32-unknown-unknown` target, `wasm-opt` (binaryen), and about 10 GB of disk for the build.
`fetch-sputnik.sh` downloads the real Sputnik v2 DAO wasm from a live testnet DAO. The suite runs in near-workspaces
against the real DAO contract with a mock OutLayer. It proves **46 checks, 35 of them attacks** that must be refused with an
exact error code and leave the pot untouched (`contracts/judge-report.json` is regenerated). Plus the happy path
(fund, draw, prove, payout), gas limits for the largest trip, golden signed-message vectors, and the relayer path.

## 5. Verifier tests

```bash
cd outlayer/verifier && cargo test --release
```

No network. Proves the OutLayer app refuses a tampered body or header, a missing or unknown DKIM key, a non-allowlisted
domain, an amount over the cap, wrong dates, guests or currency, facts the model invented, a wrong blob hash or key; that it
accepts a valid DKIM email; that the ed25519 verdict signature breaks if one digit of `total` changes; and the trip card
op (single use, lodging only, sealed to the booker, refuses unless every bed is Paid).

## 6. API tests

```bash
cd services/api && pnpm install && pnpm test
```

Vitest, with 1Click, RPC and Lithic mocked. Proves the relayer only forwards allowlisted calls (receiver, method, deposit
and gas caps, signature, expiry, rate limit), sweeps are idempotent, blobs are encrypted and hash-checked, errors are always
`{error, code}`, and the card routes accept only messages signed by the pinned verifier key.

## Honest limits

- **Testnet only.** No mainnet run has been done (`deploy/mainnet.json` does not exist).
- **1Click is mainnet-only**, so a USDC faucet (open `mint` on a test token) stands in for cross-chain deposits on testnet. The 1Click quote path is exercised against its real API in dry mode only.
- **The card is the Lithic sandbox.** No real money moves, and the card's limit is a number equal to the pot, not funded from the DAO.
- **No FX conversion.** The booking total is compared 1:1 with the USDC cap; `currency` is recorded but not converted (the live proof is SGD 226.60 treated as 226.60).
- **The OutLayer VRF is verifiable but not provably unpredictable.** The contract checks the TEE signature, not that nobody could have predicted the output.
- **NEAR AI extraction latency is 10 to 49 seconds**, so a proof is not instant. The facts must also appear literally in the DKIM-verified text.
- **Each trip address is its own Email Routing rule** (`<trip>@dibs.larinova.com`), added automatically when a trip is created from the app.
- **Dev persona keys exist on localhost only**, never in the deployed app.
- The `dibs-test.example` domain, whose private key is in the repo, is allowlisted on testnet only and must not be on mainnet.
- `create_trip` does not read the DAO policy back on chain; DAOs are created from `contracts/scripts/dao-policy.json`.
- The dibs wasm is 283 KB (target was 110 KB), costing about 2.8 NEAR in locked storage.
