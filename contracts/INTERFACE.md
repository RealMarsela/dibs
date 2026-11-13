# Dibs contract interface (Lane A, v1.1)

Binding for Lane B (outlayer verifier) and Lane C (api). All JSON; u128 and u64 as decimal strings.
Stable error codes start with `E_`. A panic in a direct call carries the code as its message
(`Smart contract panicked: E_NO_REFUND`). Rejections inside OutLayer callbacks never panic (so the
caller's deposit refunds); they are stored in `get_trip().last_error` and logged as
`EVENT_JSON:{"event":"proof_refused"|"draw_refused","trip":"..","code":"E_.."}`.
A failed `ft_on_transfer` makes the USDC contract refund the sender, so funds are never lost; the code
shows in the failed receipt.

## Signed messages (one pinned ed25519 key, set by owner-only `set_verifier_key{key_hex}`)

The verifier signs the exact UTF-8 bytes of `message` (no prehash). The contract verifies the signature
over `message` exactly as received, then parses the JSON after the prefix.

```
booking: "dibs-booking:v1:" + {"trip","stay","check_in","check_out","guests","total","currency","dkim_domain","eml_sha256","booking_ref_hash"}
vrf:     "dibs-vrf:v1:"     + {"trip","output_hex"}
```

Canonical JSON: keys in exactly that order, no whitespace, strings JSON-escaped.

| field | type | rule |
|---|---|---|
| trip | string | equals the trip code |
| stay | string | free text, shown in UI |
| check_in, check_out | string `YYYY-MM-DD` | must equal the trip's dates |
| guests | number | must equal `n_beds` |
| total | string, USDC base units (6 dec) | integer, must be <= price * n_beds. The verifier expresses the total in micro-USD; `currency` is the original currency (informational) |
| currency | string | 1-8 chars |
| dkim_domain | string | the DKIM `d=` that verified; must be in the contract allowlist (`get_config().domains`) |
| eml_sha256, booking_ref_hash | string | 64 hex. A `booking_ref_hash` is accepted once, across all trips (`E_REPLAY`) |
| output_hex | string | exactly 64 hex; seeds the Fisher-Yates draw |

Check order (first failure wins): key set `E_NO_KEY`, prefix `E_BAD_PREFIX`, signature `E_BAD_SIG`, JSON
`E_BAD_FACTS`, trip `E_TRIP_MISMATCH`, hex fields `E_BAD_FACTS`, guests `E_GUESTS`, total `E_TOTAL`,
domain `E_DOMAIN`, dates `E_DATES`, replay `E_REPLAY`. No output from OutLayer: `E_NO_RESULT`.

Golden vectors (fixed test key, byte-exact messages and signatures): `contracts/fixtures/golden-vectors.json`,
produced by `tests/tests/golden.rs`; the sandbox suite signs with the same builders, so the contract provably
accepts exactly these bytes.

## What the contract sends to OutLayer

`<outlayer>.request_execution`, 150 Tgas, the caller's deposit (>= 0.02 NEAR) attached:
```
{"source":{"Project":{"project_id":"<owner>/dibs-verifier","version_key":null}},
 "input_data":"<JSON string>","resource_limits":{"max_instructions":2000000000,"max_memory_mb":128,"max_execution_seconds":30|60},
 "response_format":"Json"}
```
input_data:
- vrf: `{"op":"vrf","trip":"lis0312","n":8}`
- booking: `{"op":"booking","trip":"lis0312","blob_url":"https://...","blob_sha256":"<64 hex>","expect":{"check_in":"2026-12-04","check_out":"2026-12-07","guests":8,"max_total":"2000000"}}`
  (`max_total` is a decimal string; accept string or number).

The app's JSON output must contain `"message"` (the full signed string) and `"signature"` (128 hex);
extra fields are ignored. A failed run (exit 1 or timeout) reaches the contract as `null`.
Deposit handling: the callback returns `deposit - run_fee` (default 0.003 NEAR) to the caller; OutLayer
refunds its unused part to the contract.

## Accounts

- dibs `dibs-<rand>.testnet`; bed `b<NN>-<trip>.<dibs>`, waitlist `w<NN>-<trip>.<dibs>`, NN = 01..99.
  All run `bed.wasm` (no keys, no state). `sweep{amount}` is open to anyone; give it 300 Tgas. It calls
  `<usdc>.ft_transfer_call(<dibs>, amount, {"kind":"bed"|"wait","trip":"<trip>","n":NN})` with 1 yocto.
  The bed account must hold the USDC (1Click delivers it, or testnet `mint`). Extra USDC beyond `price`
  stays in the bed account (it cannot be recovered).
- The dibs account must be registered in USDC once (`storage_deposit`); `deploy-testnet.sh` does it.
  `create_trip` registers beds, waitlist, DAO and booker; `hold` / `reserve_wait` register the holder or buyer
  (paid from the dibs balance, so these two are not payable).
- Trip code: 3-12 chars `[a-z0-9]`.
- Crew DAO (Sputnik v2): create it first (`scripts/dao-policy.json`: role `trip` = Group[<dibs>] with
  `transfer:AddProposal` and `transfer:VoteApprove`, RoleWeight, threshold 1, bond 0; crew may only reject).
  The factory min deposit on testnet is 6 NEAR.
- Flow: `create_trip` -> `hold(n, holder)` -> deliver exactly `price` USDC to the bed -> `bed.sweep(price)`
  -> Paid and the USDC moves to the DAO.

## Methods (dibs)

Init (owner): `new{owner, usdc, outlayer, project_id, domains, run_fee}`. Owner only (`E_NOT_OWNER`):
`set_verifier_key{key_hex}`, `set_outlayer{outlayer, project_id}`, `set_domains{domains}`,
`add_relayer{account}`, `set_run_fee{run_fee}`. The owner is also a relayer.

| method | caller | gas | notes |
|---|---|---|---|
| `create_trip{code, price, n_beds, n_wait?=2, book_by:U64 ns, booker, dao, check_in, check_out, stay?}` | anyone, payable | 300 T | additions to the brief: `n_wait`, `check_in`, `check_out`, `stay`. Deposit >= `create_cost(n_beds,n_wait)` (about 0.027 NEAR per account plus 0.055), excess refunded. `n_beds` 1..16, `n_beds+n_wait` <= 18 (about 11 Tgas per account; 14+4 burns 205 Tgas) |
| `hold{trip, n, holder}` | holder or relayer | 60 T | Open -> Held. On a Listed bed: reserves it for a resale buyer |
| `release_hold{trip, n}` | the reserver | | Held -> Open (or drops a resale reservation) |
| `ft_on_transfer{sender_id, amount, msg}` | usdc only | | see below |
| `request_refund{trip, n}` | anyone | | always `E_NO_REFUND` |
| `list_for_resale{trip, n}` | bed holder | 300 T | Paid -> Listed (no price parameter exists: resale is at face). With a funded waitlist the head fills the bed at once and the seller is paid `price` |
| `reserve_wait{trip, slot, buyer}` | buyer or relayer | 60 T | reserves `w<slot>-<trip>.<dibs>` |
| `leave_waitlist{trip}` | buyer | 100 T | funded entry: `price` returned in USDC; bare reservation: freed |
| `request_draw{trip}` | anyone, deposit >= 0.02 NEAR | 300 T | all beds Paid. Sets `drawn` (permutation of 1..n) and `drawn_out` |
| `submit_proof{trip, blob_url, blob_sha256}` | booker, deposit >= 0.02 NEAR, before `book_by` | 300 T | all beds Paid. On acceptance stores `proof`, then DAO `add_proposal` Transfer(booker, total) and `act_proposal` VoteApprove; `payout` goes `None -> Added(id) -> Acted(id) -> Done` (Done only after the proposal reads back Approved) |
| `retry_payout{trip}` | anyone | 300 T | re-runs a stuck payout step |
| `refund_all{trip, limit?=2}` | anyone | 300 T | after `book_by`, no proof, none pending. `limit` 1..3 per call: DAO Transfer proposal per bed holder, then waitlist buyers directly. Call until `refunded` is true |
| `set_paid_from{trip, n, chain}` | relayer | | display label only |

Views: `get_trip{trip}` (full state: price, n_beds, n_wait, book_by, booker, dao, dates, `beds[{holder, buyer,
status Open|Held|Paid|Listed, paid_from_chain}]`, `wait_res`, `waitlist[{buyer, slot}]`, `proof`, `payout`,
`proof_pending`, `draw_pending`, `drawn`, `drawn_out`, `refunded`, `refund_cursor`, `last_error`),
`get_bed{trip,n}`, `get_waitlist{trip}`, `get_config`, `create_cost{n_beds,n_wait}`,
`check_proof{trip, message, signature}` (returns `"OK"` or the code `on_proof` would store).

`ft_on_transfer` (msg `{"kind","trip","n"}`): `E_NOT_USDC` (caller), `E_BAD_MSG`, `E_BAD_SENDER` (sender must be
exactly `b|wNN-<trip>.<dibs>`), `E_WRONG_AMOUNT` (must equal `price`), `E_REFUNDED`. Bed: Held -> Paid and the
price is forwarded to the DAO (`E_NOT_HELD` if Open, `E_ALREADY_PAID` if Paid). A Listed bed with a reserved
buyer is a resale purchase: the previous holder is paid `price`, the buyer becomes holder. Waitlist: slot must
be reserved (`E_NOT_HELD`), unfunded (`E_ALREADY_PAID`); funds stay in dibs; a Listed bed with no reserved
buyer is filled at once.

Callbacks (`on_*`) are private: a foreign caller gets `E_PRIVATE`.

## Error codes

E_NO_REFUND E_NOT_OWNER E_NOT_USDC E_BAD_SENDER E_BAD_MSG E_WRONG_AMOUNT E_NOT_HELD E_ALREADY_PAID E_ALREADY_HELD
E_NOT_PAID E_NOT_HOLDER E_NOT_BOOKER E_NO_TRIP E_TRIP_EXISTS E_BAD_ARGS E_BAD_BED E_DEPOSIT E_NOT_FULL E_DRAWN
E_PENDING E_DEADLINE E_BEFORE_DEADLINE E_PROOF_EXISTS E_REFUNDED E_PRIVATE E_NO_KEY E_BAD_SIG E_BAD_PREFIX
E_BAD_FACTS E_TRIP_MISMATCH E_GUESTS E_TOTAL E_DOMAIN E_DATES E_REPLAY E_NO_RESULT E_NO_SLOT E_SLOT_TAKEN
E_NOT_RELAYER E_PAYOUT E_FORWARD (the last two are stored in `last_error` when a transfer or DAO step fails).
