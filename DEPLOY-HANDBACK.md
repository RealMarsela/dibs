# Lane D handback: testnet deploy and integration

Testnet only. No mainnet signature, no real money, no site login (only the anonymous faucet form was opened).
Machine-readable ids and every tx hash: `deploy/testnet.json` (same file mirrored at `contracts/deploy/testnet.json`).
Explorer: `https://testnet.nearblocks.io/txns/<hash>`.

## What is live

| item | id |
|---|---|
| dibs contract (v1.2, relayer may submit_proof) | `dibs-0eb9ae.testnet` (deploy `2YFYeopF4bRAcRD9qf6bReGcUd4GbksAzWgQM9pvVotu`, redeploy v1.2 `5qGhwTG9DYtDK8mXca3HL4tXrtSC9Hjbj16oCqAJuCCv`) |
| test USDC (NEP-141, open mint) | `usdc.own-0eb9ae.testnet` |
| OutLayer project | `own-0eb9ae.testnet/dibs-verifier`, active wasm sha256 `546edf70...2680` (testnet build, test-domain feature) |
| verifier public key (pinned via `set_verifier_key`, tx `HYQWZp2N...`) | `706445d7daa364e38ea0f410fc3279c83b6200c5cfd89983546b8fecbb3706bf` |
| `set_outlayer` | tx `BZFfVVGP...` |
| API worker | `https://dibs-api.gabrielaxy.workers.dev` (R2 bucket `dibs-proof-blobs`, relayer `relayer.dao-0eb9ae.testnet`, added with `add_relayer`) |
| trip lis0312 | DAO `lis0312-0eb9ae.sputnik-v2.testnet`; 8 beds at 40 USDC; beds 1,2,4-8 Paid, bed 3 (Leo) Held and unpaid; Priya funded on waitlist slot 1; DAO holds 280 USDC |
| trip sin1025 | DAO `sin1025-0eb9ae.sputnik-v2.testnet`; 2 beds at 120 USDC, 2025-10-25..26, "Carlton City Hotel Singapore"; both Paid |
| trip drw0001 | DAO `drw0001-0eb9ae.sputnik-v2.testnet`; 2 beds at 1 USDC; both Paid; VRF draw done |
| friends | `maya sam leo ana tomas jun chloe kofi priya` `.own-0eb9ae.testnet` |

Fresh faucet accounts: `dibs-0eb9ae`, `dao-0eb9ae`, `own-0eb9ae` (all `.testnet`; no pre-existing credentials used).
book_by is about 3 days out (lis 1794900093174841088 ns, sin 1794900578535385088 ns).

## Proven live

- Deploy, trip creation with real Sputnik DAOs, hold + test-USDC mint + bed `sweep`: Paid and USDC forwarded to the DAO (lis DAO balance 280000000).
- Waitlist funding with funds held by dibs (Priya).
- OutLayer: `public_key` op run live; secrets profile `default` (DIBS_BLOB_KEY, allow-all) attached via manifest `author_secrets`.
- VRF draw on `drw0001`: tx `gADA3SGtrGjsmTVJNZUaWLsxJSUuZdxkhQ7dVGe7c6w`; callback verified the TEE signature against the pinned key; `drawn = [2,1]`, `drawn_out = true`.
- API smoke (all against the deployed worker):
  - `GET /health` -> `{"ok":true,"network":"testnet","contract":"dibs-0eb9ae.testnet","usdc":"usdc.own-0eb9ae.testnet","relayer":"relayer.dao-0eb9ae.testnet"}`
  - `GET /trip/lis0312` -> beds `Paid,Paid,Held,Paid,Paid,Paid,Paid,Paid`, network testnet.
  - `POST /quote` (lis0312 bed 3, testnet mode) -> depositAddress `b03-lis0312.dibs-0eb9ae.testnet`, amountIn 40000000.
  - `POST /hold` sin1025 bed 1 -> tx `HGKDJNAU...`; then mint to the bed and `GET /status/b01-sin1025...` -> `sweep:"done"` (tx `9HfbjeMG...`), second poll `already_done`, bed Paid.
  - `POST /relay` with a delegate signed by a fresh implicit account (`6721cf22...`): hold on sin1025 bed 2 -> 200, tx `8BjV9Jko5K8DwX2Btv7qPQ7A397us6Qd21nVPHA3MQJC`; mint + `/status` -> `done` (tx `FZg9U91C...`).
  - `POST /proof-blob` (valid and tampered fixtures) -> `blob_url` + `blob_sha256`; GET of the blob hashes to the returned sha256.
- Refusals seen live on chain:
  - `request_refund` -> `E_NO_REFUND`.
  - `check_proof` with a forged signature -> `E_BAD_SIG`; with a wrong prefix -> `E_BAD_PREFIX`.
  - Tampered-body `.eml` submitted by the booker (tx `93AJG9P2g7ZaTQacNb6dS1csZZRLpX8gxAFy1imTrBFF`): contract stored `proof_refused E_NO_RESULT`, no payout, DAO untouched.
  - A relayer call to `submit_proof` is accepted by v1.2 (tx `9yvxadwsAWrexVWjsd7gSwNEVW15YEpsKpKa8j7ACuDW`, reached OutLayer).

## Contract change folded in (coordinator request 1)

`submit_proof` accepts the booker or a relayer; anything else gets `E_NOT_BOOKER`. Payout still goes only to the booker.
Sandbox test `contracts/tests/tests/relayer_proof.rs` passes (relayer submits, booker paid exactly `total`, relayer gets no USDC, stranger refused).
Re-ran happy and judge suites: all pass. INTERFACE.md updated to v1.2. Live dibs redeployed in place (state intact, bed.wasm hash unchanged).

## What failed and why

1. **Accepted live booking proof NOT run.** `.secrets/near-ai.env` does not exist, so `NEAR_AI_KEY` was never set. The verifier cannot extract facts without it, so no valid proof was accepted and no payout to the booker happened on testnet. Nothing was spent on NEAR AI (zero live calls). Once the file exists: `outlayer secrets set` overwrites the whole profile, so set `DIBS_BLOB_KEY` (kept in the scratch dir, same value as the worker secret) and `NEAR_AI_KEY` together, plus `LITHIC_API_KEY` later. Then call `submit_proof` on `sin1025` (or `lis0312` after Leo pays) with `valid.eml`-style fixtures whose facts match the trip.
2. **Tampered case code.** The live tampered run returned `E_NO_RESULT` (OutLayer exit 1 reaches the contract as null). The specific `E_DKIM` code is only in the verifier's own tests; OutLayer reported a wasm trap for blob runs that pass the hash check, which I could not diagnose (no stderr; local wasmtime cannot satisfy the signing-keys host import). Bisect attempt left the project on the clean v4 wasm. Treat the E_DKIM path inside OutLayer as unverified live.
3. **FastFS upload fails for the 595 KB verifier** (gas for the args; limit is somewhere between 420 and 500 KB). The wasm is hosted from R2 public dev URL (`dibs-wasm-testnet` bucket) instead. R2 dev URLs are rate-limited; fine for testnet.
4. **API bugs found and fixed live:** `/hold` attached a deposit but `hold` is not payable (now 0); testnet `/quote` mint instruction lacked `account_id` (fixed); `ALLOWED_ORIGIN` comma list did not work with Hono CORS (now a list). 53 API tests pass.
5. **RPC rate limits** (fastnear and the deprecated rpc.testnet.near.org) slowed every step; the NEAR CLI retried in loops. The helper faucet was limited for about an hour before the first accounts.
6. **Faucet accounts `dao2-`, `dao3-`, `rel-0eb9ae` never created** (poller still running in the scratch dir; harmless). I used a DAO funder, then dibs, to cover three 6 NEAR DAOs.
7. `usdc` deploy tx hash not recorded (explorer API rate limited).

## Testnet NEAR left (N)

dibs-0eb9ae 3.4 (2.85 locked as storage, so about 0.6 spare), dao-0eb9ae 1.5, own-0eb9ae 2.1, relayer 1.4, maya about 0.8. A fourth DAO costs 6 NEAR: need about 6 more N plus about 1 for relay and OutLayer runs.

## Other notes

- Spend guard from the coordinator is in place; verifier now fetches `NEAR_AI_KEY` lazily so DKIM/domain refusals fire before any key use (testnet wasm v4).
- One Rust target dir per repo: `.cargo/config.toml`, build scripts and README updated; contract wasm hashes verified identical after the move; old per-crate target dirs removed.
- OutLayer owner key and relayer key live only in `~/.near-credentials` and the Cloudflare secret store; no secrets in the repo.
