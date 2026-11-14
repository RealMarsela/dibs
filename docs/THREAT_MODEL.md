# Threat model: who could cheat, and what refuses them

Money is the crew's USDC in a Sputnik DAO. It leaves in exactly two ways: to the booker after a verified booking, or back to
funders after the deadline with no proof. Every row names the enforcing code and a test. Contract tests are in
`contracts/tests/tests/judge.rs` (check names quoted from `contracts/judge-report.json`), other tests as noted.

| attempt | refused by | enforced in | test |
|---|---|---|---|
| Forged email (not really from booking.com) | DKIM verification inside the TEE; the domain must be in the contract allowlist | `outlayer/verifier/src/dkim.rs`; `E_DOMAIN` in `contracts/dibs/src/oracle.rs` | `outlayer/verifier/tests/booking.rs`: `wrong_domain_is_refused`, `unknown_dns_key_and_bad_input_are_refused`; judge.rs "proof from a domain that is not allowed" |
| Tampered email (edited amount, dates or headers) | DKIM body and header signature fail (`E_DKIM`); the verdict signature fails if one digit changes | `outlayer/verifier/src/dkim.rs`; `E_BAD_SIG` in oracle.rs | `tampered_body_fails_dkim`, `tampered_signed_header_fails_dkim`; judge.rs "forged OutLayer booking signature", "check_proof view rejects a forged message"; live: `pnpm verify` check e |
| Facts the AI model invented | amount and reference must literally appear in the DKIM-verified text | `outlayer/verifier/src/verify.rs` (`E_FACTS`) | `outlayer/verifier/tests/booking.rs`: `model_facts_must_be_grounded_in_the_verified_email` |
| Replayed booking (same confirmation on another trip) | `booking_ref_hash` accepted once across all trips: `E_REPLAY`; a second proof on the same trip: `E_PROOF_EXISTS` | `contracts/dibs/src/oracle.rs` (`used_refs`) | judge.rs "same booking reference replayed on another trip", "second proof for the same trip" |
| Wrong booking (other dates, guests, trip, or total above the pot) | `E_DATES`, `E_GUESTS`, `E_TRIP_MISMATCH`, `E_TOTAL` | oracle.rs | judge.rs "proof with wrong dates", "wrong guests", "another trip", "total above the pot" |
| Booker paid without a proof | impossible: the DAO only accepts transfer proposals from the dibs contract, and dibs creates one only inside the proof callback; a booker adding one directly gets `ERR_PERMISSION_DENIED` | `contracts/scripts/dao-policy.json` (role `trip`); `submit_proof`/`on_proof` | judge.rs "booker adds a DAO transfer directly", "submit proof before all beds paid"; "valid proof pays the booker through the DAO" |
| Payout redirected to someone else (a relayer submits the proof) | payout goes only to the booker field of the trip | oracle.rs | `contracts/tests/tests/relayer_proof.rs` (relayer gets no USDC, stranger gets `E_NOT_BOOKER`); judge.rs "non-booker submits proof" |
| Proof after the deadline | `E_DEADLINE` | oracle.rs | judge.rs "proof after the deadline" |
| A refund on demand | `request_refund` always panics `E_NO_REFUND`; the only refund path is `refund_all` after `book_by` with no proof | `request_refund` in `contracts/dibs/src/trip.rs` (line 139), `refund_all` in `contracts/dibs/src/refund.rs` | judge.rs "request_refund always refused", "refund_all before the deadline", "double refund_all"; live recorded tx via `pnpm verify` check f |
| Resale above face value | there is no price parameter; paying anything but `price` is `E_WRONG_AMOUNT` | `list_for_resale`, `ft_on_transfer` in `contracts/dibs/src/pay.rs` | judge.rs "resale above face value is refused", "resale at face: seller gets exactly price" |
| Fake bed sweep (a different account pretends to be a bed) | sender must be exactly `b|wNN-<trip>.<dibs>`: `E_BAD_SENDER` | `contracts/dibs/src/pay.rs` line 17 | judge.rs "sweep from a fake (non-bed) account" |
| Paying with a worthless token | `ft_on_transfer` only trusts the configured USDC contract: `E_NOT_USDC` | pay.rs | judge.rs "ft_on_transfer from non-USDC caller" |
| Wrong or double payment of a bed | `E_WRONG_AMOUNT`, `E_ALREADY_PAID`, `E_NOT_HELD`; a failed transfer is refunded by the token contract | pay.rs | judge.rs "pay wrong amount (price - 1)", "pay an already-paid bed again", "pay a bed nobody holds" |
| Squatting a bed for someone else, or listing a bed you do not hold | `E_NOT_RELAYER`, `E_NOT_HOLDER` | pay.rs, trip.rs | judge.rs "stranger holds a bed for someone else", "non-holder lists a bed" |
| Calling the contract's private callbacks directly | `E_PRIVATE` | `#[private]` callbacks | judge.rs "booker calls private callback on_proof / on_draw / on_forward" |
| Swapping the verifier key or domains | owner only: `E_NOT_OWNER`; the key is pinned on chain | `set_verifier_key` | judge.rs "non-owner replaces verifier key"; live: `pnpm verify` check g |
| Rigged draw (forged or missing randomness) | draw output must carry a valid signature from the pinned key; no output stores `E_NO_RESULT`; a second draw is `E_DRAWN` | `contracts/dibs/src/oracle.rs` (`on_draw`) | judge.rs "forged draw signature", "OutLayer returns nothing for the draw", "double draw"; live: `pnpm verify` check d. Limit: verifiable, not provably unpredictable |
| Trip card used at a non-lodging merchant | issuer Auth Rule declines every MCC except 7011 | `outlayer/verifier/src/lithic.rs` (`LODGING_MCC`, `IS_NOT_ONE_OF`) | `outlayer/verifier/tests/card.rs`: `lithic_gets_a_single_use_card_and_a_lodging_only_rule`; live: electronics store DECLINED `PROGRAM_USAGE_RESTRICTION` (`pnpm verify` check i) |
| Card reused, or charged above the pot | `SINGLE_USE` card, spend limit equal to the pot; a retry adopts the same card, never mints a second | lithic.rs, `card.rs` | `card.rs`: `lithic_gets_a_single_use_card...`, `retry_is_idempotent_same_card_same_sealed_bytes`, `retry_adopts_the_existing_card...` |
| Card minted before the crew has paid, or after payout | refused unless every bed is Paid and no payout or proof exists | verifier `card` op | `card.rs`: `refuses_unless_every_bed_is_paid_and_no_payout_started` |
| Someone else reads the card number | details sealed to the booker's key (crypto_box_seal); the API never returns or stores the PAN | `outlayer/verifier/src/seal.rs`; `services/api/src/card.ts` | `card.rs`: `issues_signs_and_seals_to_the_booker`; `outlayer/card-compat/card.test.ts`; `services/api/test/card.test.ts` "never returns or stores the card number" |
| Fake card record posted to the API | `/card/:trip/issued` verifies the ed25519 signature against the pinned verifier key | `services/api/src/card.ts` | `services/api/test/card.test.ts` "refuses a forged signature, a foreign key, a tampered message and a wrong prefix" |
| The relayer abusing its gas or key | relay accepts only allowlisted receivers and methods, 1 to 4 function calls, per-method deposit caps, gas cap 300 Tgas, valid signature, expiry, per-sender rate limit; sender must not be the relayer | `services/api/src/relay.ts` | `services/api/test/relay.test.ts` (non-allowlisted receiver and method, smuggled second action, caps, tampered signature, expiry, rate limit, no key leak) |
| Sweep abuse (double sweep, foreign recipient) | idempotent create-only claim plus on-chain balance check; recipient must match the receipt pattern | `services/api/src/sweep.ts` | `services/api/test/sweep.test.ts` (idempotent under concurrency, refuses a recipient that is not a dibs receipt) |
| Bad or oversized input to the API | zod validation, `{error, code}` bodies, 2 MB blob limit | `services/api/src` | `relay.test.ts` "rejects garbage and bad shapes", `blob.test.ts` |

## Not covered (stated so nobody assumes it is)

- `create_trip` does not read the DAO policy back: a trip created with a weaker DAO would be weaker. DAOs come from `dao-policy.json`.
- The testnet test domain `dibs-test.example` accepts self-minted proofs (its key is in the repo); it must stay off the mainnet allowlist.
- The OutLayer and NEAR AI services are trusted for execution and extraction; DKIM plus literal-text checks limit, but do not remove, that trust.
- The draw is verifiable, not provably unpredictable. No FX conversion: totals compare 1:1 with the USDC cap.
- The card is a Lithic sandbox card; no real funds back it.
