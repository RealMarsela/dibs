# Dibs: build brief (agent-to-agent contract)

Owner: Opus coordinator session (UI + integration). Deadline: submit by Sun 15 Nov 05:29 IST
(2026-11-14T23:59Z). Code freeze for features: Sat 14 Nov 21:00 IST. Persona: RealMarsela
(git user already set in this repo; never change it). Repo root: this repository.

## Product in one line
Friends fund every bed of a group trip before anyone books; the booker is paid only against a
verified booking email; no refunds, a dropout exits only by reselling the bed at face value to a
pre-funded waitlist; no proof by the deadline refunds everyone.

## Hard rules (every lane)
- Never sign a mainnet tx, spend money, create accounts on mainnet, log in anywhere, or read the
  vault's master file. Testnet and near-workspaces sandbox only. Mainnet comes later, by the
  coordinator, with the team's approved cap.
- Files under 300 lines. No console.log in production code. zod at every API boundary. API errors
  are `{ error, code? }`. No secrets in git. Realistic sample data only.
- Commit only your own paths, by explicit path, with the trailer line
  `Claude-Session: https://claude.ai/code/session_01UimXU6aon2hXfHY1WYfzfV`. Do not push.
- Every "must" below gets a test that fails when the rule is broken.

## Accounts and names (testnet now, mainnet mirror later)
- `dibs` contract: one contract for all trips. Testnet: `dibs-<rand>.testnet` (create via faucet
  helper or `near account create-account sponsor-by-faucet-service`).
- Bed receipt accounts: sub-accounts `b<NN>-<trip>.<dibs>` e.g. `b03-lis0312.dibs-x.testnet`,
  created by the dibs contract with DeployContract(bed.wasm) and NO access keys. Waitlist receipt
  accounts: `w<NN>-<trip>.<dibs>`, same wasm.
- Crew DAO per trip via `sputnik-v2.testnet` / `sputnik-dao.near` factory `create`.
- USDC: testnet uses our own NEP-141 `usdc-<rand>.testnet` (6 decimals, open faucet `mint`).
  Mainnet uses `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`.

## Lane A: contracts/ (Sonnet) owns `contracts/**`
1. `contracts/bed` no_std raw-wasm (target <= 8 KB). One method `sweep(amount: U128)`:
   parses its own account id `b|wNN-<trip>.<dibs>`, calls `<usdc>.ft_transfer_call(receiver=<dibs>,
   amount, msg="{\"kind\":\"bed|wait\",\"trip\":\"<trip>\",\"n\":NN}")` with 1 yocto. USDC id
   is baked at build time per network (feature flag). No other method, no keys, no state.
2. `contracts/dibs` near-sdk 5.x, target <= 110 KB after `cargo near build` + `wasm-opt -Oz`.
   State per trip: price (U128), n_beds, book_by (ns), booker, dao, beds[n]{holder, status
   Open|Held|Paid|Listed, paid_from_chain: String}, waitlist[] {buyer, slot}, proof?, drawn order?,
   drawn_out bool, refunded bool.
   Methods (all panics carry a stable code string, e.g. `E_NO_REFUND`):
   - `create_trip(code, price, n_beds, book_by, booker, dao)` payable: creates bed + waitlist
     accounts (deploy bed.wasm), storage_deposit USDC for each bed, waitlist, dao.
   - `hold(trip, n, holder)` (relayer or holder) Open -> Held.
   - `ft_on_transfer(sender_id, amount, msg)`: only from USDC contract; `msg.kind=bed` requires
     sender_id == `bNN-<trip>.<self>` and amount == price. Held/Open -> Paid then forward USDC to
     DAO. If bed is Listed: this is a resale purchase -> pay previous holder price, set new holder.
     `kind=wait`: append waitlist buyer with funds held by dibs (not DAO).
     Anything else: return full amount (refund via FT standard).
   - `request_refund(trip, n)`: ALWAYS panics `E_NO_REFUND` (it exists so the demo can show it).
   - `list_for_resale(trip, n)` holder only, Paid -> Listed; if waitlist non-empty, fill at once:
     waitlist[0] funds pay the seller, holder := buyer.
   - `leave_waitlist(trip)` buyer gets funds back.
   - `request_draw(trip)` when all Paid: OutLayer `request_execution` {op:"vrf"} -> callback
     `on_draw(sig, output)` verifies ed25519 sig with pinned key, Fisher-Yates with output.
   - `submit_proof(trip, blob_url, blob_sha256)` booker only, before book_by: OutLayer
     {op:"booking", ...} -> callback `on_proof(message, signature)`: verify ed25519 over exact
     message (prefix `dibs-booking:v1:`), parse facts, require trip match, guests == n_beds,
     total <= pot, dkim_domain in allowlist, check_in/out == trip dates. Then Sputnik
     `add_proposal` Transfer(token=USDC, receiver=booker, amount=total) + `act_proposal`
     VoteApprove (role `trip`, threshold 1). Store proof facts.
   - `refund_all(trip)` anyone, after book_by with no accepted proof: DAO Transfer proposals back to
     each holder (batched), set refunded.
   - views: `get_trip`, `get_bed`, `get_waitlist`.
3. Tests (near-workspaces-rs or -js, sandbox): happy path + attacks, each asserting the exact
   error code: refund refused; pay wrong amount; bed sweep from a fake account; ft_on_transfer
   from non-USDC; booker draw without proof; forged OutLayer signature; proof with wrong dates /
   guests / total > pot / domain not allowed; proof after deadline; refund_all before deadline;
   double refund_all; resale above face (impossible by API: assert no price param); non-holder
   lists; draw before full; double draw.
   Output a JSON report `contracts/judge-report.json` {checks:[{name, expected_code, ok}]}.
4. Deploy scripts `contracts/scripts/deploy-testnet.sh` + a seed that creates the Lisbon trip.

## Lane B: outlayer/ (Sonnet) owns `outlayer/**`
Pattern to copy (read-only reference, do not edit): an earlier OutLayer stand-in app (not in this repo).
wasm32-wasip2 app `dibs-verifier`, ops by input JSON:
- `{"op":"public_key"}` -> project ed25519 key (path "dibs").
- `{"op":"vrf","trip":..,"n":..}` -> VRF output + signature over `dibs-vrf:v1:<canonical json>`.
- `{"op":"booking","trip":..,"blob_url":..,"blob_sha256":..,"expect":{check_in,check_out,
  guests,max_total}}`: fetch blob over HTTPS, check sha256, decrypt (AES-256-GCM, key from sealed
  secret `DIBS_BLOB_KEY`), verify DKIM (rsa-sha256, relaxed/relaxed; fetch key via
  DNS-over-HTTPS https://cloudflare-dns.com/dns-query) for d= in {booking.com, airbnb.com,
  hostelworld.com} plus a test domain allowed only on testnet; call NEAR AI Cloud
  `https://cloud-api.near.ai/v1/chat/completions` with a TEE model (secret `NEAR_AI_KEY`) to
  extract {stay, check_in, check_out, guests, total, currency, booking_ref_hash} as strict JSON;
  fetch `/v1/signature/{id}` and include it; sign `dibs-booking:v1:<canonical facts json>`.
  Never output names, address, card, raw email.
- Unit tests with fixture .eml files: one valid DKIM sample (self-signed test domain + local key),
  tampered body, wrong domain. Document mainnet cost (~0.007 NEAR/run) and deploy steps in README.

## Lane C: services/api (Sonnet) owns `services/api/**`
Cloudflare Worker (Hono + zod), TypeScript. Endpoints:
- `POST /quote` {trip, n, kind:"bed"|"wait", fromChain} -> 1Click dry:false EXACT_OUTPUT quote to
  the bed/waitlist account; returns {depositAddress, amountIn, token, expiresAt}. Testnet mode:
  returns a "testnet faucet pay" instruction instead (1Click has no testnet).
- `GET /status/:depositAddress` -> 1Click status; when SUCCESS calls `bed.sweep(price)` via relayer.
- `POST /relay` NEP-366 signed delegate action from a passkey account -> relayer submits.
- `POST /proof-blob` multipart .eml -> AES-256-GCM encrypt with `DIBS_BLOB_KEY`, store in R2,
  return {blob_url, blob_sha256}. Max 2 MB, content-type checked.
- `GET /trip/:code` -> merged view-call state for the UI (cache 2 s).
Secrets via `wrangler secret`. Relayer key never logged. Vitest tests with mocked 1Click.

## Coordinator (Opus): apps/web wiring, passkeys (WebAuthn PRF -> ed25519 implicit account),
README, JUDGES.md, threat model, video. Network switch: `?net=testnet|mainnet`.

## Handback (each lane)
A short note at `<lane>/HANDBACK.md`: what works (with test output), deployed testnet ids,
exact interfaces, known gaps. Mark anything unverified as unverified.
