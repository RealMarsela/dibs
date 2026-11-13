# Dibs contract interface (Lane A, v1)

Binding for Lane B (outlayer verifier) and Lane C (api). All JSON, u128 and u64 as decimal strings.
Error codes are stable strings that start with `E_`. A panic in a direct call carries the code as its
message (`Smart contract panicked: E_NO_REFUND`). Rejections inside OutLayer callbacks never panic
(so deposits refund); they are stored in `get_trip().last_error` and logged as
`EVENT_JSON:{"event":"proof_refused"|"draw_refused","code":"E_..."}`.

## Signed messages (the one pinned ed25519 key, set by owner-only `set_verifier_key`)

The verifier signs the exact UTF-8 bytes of `message` (no prehash). The contract checks the signature
over `message` exactly as received, then parses the JSON after the prefix.

```
booking: "dibs-booking:v1:" + {"trip","stay","check_in","check_out","guests","total","currency","dkim_domain","eml_sha256","booking_ref_hash"}
vrf:     "dibs-vrf:v1:"     + {"trip","output_hex"}
```

Canonical JSON: keys in exactly that order, no whitespace, strings JSON-escaped.

| field | type | rule |
|---|---|---|
| trip | string | equals the trip code (`lis0312`) |
| stay | string | free text (property name), shown in UI |
| check_in, check_out | string `YYYY-MM-DD` | must equal the trip's dates |
| guests | number | must equal `n_beds` |
| total | string, USDC base units (6 dec) | integer, must be <= price * n_beds. The verifier expresses the booking total in micro-USD; `currency` is the original currency code (informational) |
| currency | string | informational, 1-8 chars |
| dkim_domain | string | the DKIM `d=` that verified; must be in the contract allowlist |
| eml_sha256 | string | 64 hex, sha256 of the decrypted email |
| booking_ref_hash | string | 64 hex, hash of the booking reference (never the reference) |
| output_hex | string | exactly 64 hex chars; seeds the Fisher-Yates draw |

## What the contract sends to OutLayer (`<outlayer>.request_execution`, 150 Tgas, deposit attached by caller)

```
{"source":{"Project":{"project_id":"<owner>/dibs-verifier","version_key":null}},
 "input_data":"<JSON string>","resource_limits":{"max_instructions":2000000000,"max_memory_mb":128,"max_execution_seconds":30|60},
 "response_format":"Json"}
```
input_data:
- vrf: `{"op":"vrf","trip":"lis0312","n":8}`
- booking: `{"op":"booking","trip":"lis0312","blob_url":"https://...","blob_sha256":"<64 hex>","expect":{"check_in":"2026-03-12","check_out":"2026-03-15","guests":8,"max_total":"2000000"}}`
  (`max_total` is a decimal string; accept string or number).

The app's JSON output must contain `"message"` (the full signed string) and `"signature"` (128 hex).
Extra fields are ignored. A failed run (exit 1) reaches the contract as `null` and is treated as refused.

## Accounts

- dibs: `dibs-<rand>.testnet`; bed `b<NN>-<trip>.<dibs>` and waitlist `w<NN>-<trip>.<dibs>`, NN = 01..99, 1-based.
  Beds and waitlist accounts run the same `bed.wasm` (no keys). `bed.sweep(amount: U128)` is callable by
  anyone; give it 300 Tgas. It calls `<usdc>.ft_transfer_call(<dibs>, amount, msg)` with 1 yocto and
  msg `{"kind":"bed"|"wait","trip":"<trip>","n":NN}`.
- Trip code: 3-12 chars `[a-z0-9]`.
- Order of use: `create_trip` -> `hold(n, holder)` (holder is USDC-registered by the contract) -> deliver exact
  `price` USDC to bed account (1Click or faucet) -> `bed.sweep(price)` -> status Paid.
- Waitlist: `reserve_wait(trip, slot, buyer)` -> deliver `price` to `w<slot>-<trip>.<dibs>` -> `sweep(price)`.
- Crew DAO (Sputnik v2): created by the caller beforehand (`sputnik-v2.testnet` or `sputnik-dao.near` `create`)
  with a policy that has role `trip` = Group[<dibs>] holding `transfer:AddProposal` and `transfer:VoteApprove`
  (RoleWeight, quorum 0, threshold 1). `contracts/scripts/dao-policy.json` is the template.

## Methods (dibs)

Owner init: `new{owner, usdc, outlayer, project_id, domains:[string], run_fee:U128}`.
Owner only (`E_NOT_OWNER`): `set_verifier_key{key_hex}`, `set_domains{domains}`, `add_relayer{account}`, `set_run_fee{run_fee}`.

| method | caller | notes |
|---|---|---|
| `create_trip{code, price, n_beds, n_wait?=2, book_by:U64 ns, booker, dao, check_in, check_out, stay?}` | anyone, payable | creates accounts, registers USDC storage for beds, waitlist and dao. Deposit must be >= `create_cost(n_beds,n_wait)`; excess refunded. `n_beds` 1..=16, `n_beds+n_wait` <= 20. NOTE: `check_in`, `check_out`, `n_wait`, `stay` are additions to the brief |
| `hold{trip, n, holder}` | holder or relayer, payable 0.00125 NEAR | Open -> Held, registers holder in USDC (excess refunded) |
| `release_hold{trip, n}` | holder | Held -> Open |
| `ft_on_transfer{sender_id, amount, msg}` | usdc only | see below |
| `request_refund{trip, n}` | anyone | always `E_NO_REFUND` |
| `list_for_resale{trip, n}` | bed holder | Paid -> Listed; fills at once from the waitlist head |
| `reserve_wait{trip, slot, buyer}` | buyer or relayer, payable 0.00125 NEAR | reserves a waitlist account |
| `leave_waitlist{trip}` | buyer | funded entry: price returned by USDC; reservation freed |
| `request_draw{trip}` | anyone, payable >= 0.02 NEAR | all beds Paid; OutLayer vrf; callback sets `drawn` |
| `submit_proof{trip, blob_url, blob_sha256}` | booker, payable >= 0.02 NEAR, before `book_by` | all beds Paid; OutLayer booking; callback pays booker through the DAO |
| `refund_all{trip, limit?=2}` | anyone | after `book_by`, no accepted proof; one DAO Transfer proposal per bed holder, then waitlist buyers directly; call until `refunded` is true |

Views: `get_trip{trip}`, `get_bed{trip,n}`, `get_waitlist{trip}`, `get_config`, `create_cost{n_beds,n_wait}`,
`check_proof{trip, message, signature}` (returns `"OK"` or the `E_` code the callback would store).

`ft_on_transfer` (msg `{"kind","trip","n"}`): requires predecessor == usdc (`E_NOT_USDC`), `sender_id` ==
`b|w<NN>-<trip>.<dibs>` (`E_BAD_SENDER`), `amount == price` (`E_WRONG_AMOUNT`), bed state Held (`E_NOT_HELD`),
bed not already paid (`E_ALREADY_PAID`). On a Listed bed it is a resale purchase: the previous holder is paid
`price`, holder becomes the new holder (the `holder` slot is the one reserved with `hold`). Because every
`ft_on_transfer` failure makes USDC refund the sender, funds are never lost; codes show in the failed receipt.

## Error codes

E_NO_REFUND E_NOT_OWNER E_NOT_USDC E_BAD_SENDER E_BAD_MSG E_WRONG_AMOUNT E_NOT_HELD E_ALREADY_PAID E_NOT_PAID
E_NOT_HOLDER E_NOT_BOOKER E_NO_TRIP E_TRIP_EXISTS E_BAD_ARGS E_DEPOSIT E_NOT_FULL E_DRAWN E_PENDING E_DEADLINE
E_BEFORE_DEADLINE E_PROOF_EXISTS E_REFUNDED E_PRIVATE E_NO_KEY E_BAD_SIG E_BAD_PREFIX E_BAD_FACTS E_TRIP_MISMATCH
E_GUESTS E_TOTAL E_DOMAIN E_DATES E_NO_RESULT E_NOT_LISTED E_NO_SLOT E_NOT_RELAYER E_BAD_BED
