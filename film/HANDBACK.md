# Dibs demo film: handback (FINAL v10 full-screen journey, 15 Nov 2026, IST)

## v10 (team notes 04:25 and 04:40): composition `FilmJ`, `src/journey/FilmJ.tsx`
- Final: `out/dibs-film-FINAL.mp4` (+ `.srt`) = `out/dibs-film-v10.mp4`. Kept: `dibs-film-FINAL-v9.mp4` (near.rocks, zoomed
  crops), `-v8` (RPC logs), `-v7` (cropped journey), `-v6`.
- Opening S01+S02 (19.0 s), then journey-testnet-meteor.mp4 full screen (1440x810 -> 1920x1080), in order, holds on the
  ~2 fps app frames, Meteor Sign/Approve at speed. Overlay cursor moves to each real click target (positions read from the
  footage frames) with a ripple only on real clicks: Sign Message, Pay $40 from any chain, Connect a NEAR wallet, Get my
  NEAR address, Pay with a NEAR wallet, Approve 40.00 test USDC, Meteor Approve, and the "Sent from Meteor Wallet · DSX9…"
  link. "Sign in and create the trip" is below the fold in every recorded frame, so no click is drawn for it.
- Proofs, each 2.5-3 s, full 1920x1080 page under a thin browser bar with the real URL: near.rocks create J3UJBx8x… (no
  click: no tx link on the trip frame), near.rocks pay DSX9QnWA… (after the link click on "You're in", then back to it),
  NEAR Intents explorer (Base deposit 0x6141…b973bf -> swap -> withdrawn to b01-lismain), near.rocks sweep 9nPPmuaZ….
  Blockscout dropped (sponsored ad on every load, tabs syncing).
- Resale, draw and attacks cut. Existing VO only (L01, L02, L03A, L06, L07, L09). Captions written by an inline script from
  the FilmJ placement.


| | |
|---|---|
| Final | `film/out/dibs-film-FINAL.mp4` (+ `.srt`, 35 cues) = `out/dibs-film-v7.mp4`; previous FINAL kept as `dibs-film-FINAL-v6.mp4` |
| Duration | 2:09.2 (3,872 frames at 30 fps); hard cap 2:15 |
| sha256 | FINAL.mp4 `c92d982f6a6f05a5a0dcbf4d6eebec0175c83f08942a9b94a921dccac6532295`; FINAL.srt `1dd18f0e4b7fd151da51998d2db87f5bbed5b047e397288c4dff6ebf1bd3128e`; 23,712,227 bytes |
| Composition | `Film` (scenes `Scene01`-`Scene09`, seam poses `Handoffs`) |
| Studio | http://localhost:3017 |
| Technical QA (ffprobe + full decode + ebur128) | 1920x1080, H.264 yuv420p, tv range, BT.709 primaries/transfer/matrix, AAC 48 kHz stereo; 0 decode errors; -14.2 LUFS integrated, true peak -1.1 dBTP, LRA 5.9; all 8 seams identical across the cut (b-6, b-2, b, b+2, b+6) |
| Not checked | I cannot listen: the mix (narration ~11 dB over the ducked bed, SFX levels) needs a human ear |

## v7 journey (the team's rules, 15 Nov 02:27)
S03 is the real app journey on NEAR testnet with the real Meteor wallet (journey-testnet-meteor.mp4, realmarsela.testnet), in
order: Meteor Sign Message (start the trip as the booker) -> new trip page -> This bed is yours -> Pay from any chain (NEAR)
-> Meteor Approve Transaction (Send 40 tUSDC) + Executing -> You're in (Sent from Meteor Wallet DSX9QnWA…) -> every bed
paid ($240 in the crew's DAO), then the real mainnet receipts. Music only over the journey (no VO go by 03:35). Gaps: the
Invite stage is not shown; explainers (resale, draw, attacks) hand off through the MG bed list instead of returning to the
exact journey frame.

## Story as cut (v6, before the journey)
Hook (owed $280) → the trip is a contract on NEAR, keyless bed accounts, 7 of 8 paid → Leo pays: wallet-first dialog
(real, testnet), chain list (real), NEAR Intents coin, then **real NEAR mainnet**: the 1Click deposit sheet (0.252579 USDC
on Base), the NEAR Intents explorer (Withdrawn to b01-lismain), the paid mainnet trip ($0.50 in the crew's DAO) →
refund refused E_NO_REFUND (real) and resale to Priya → OutLayer VRF draw → the trip's own card from an OutLayer enclave
(real: Carlton approved, VoltCity declined, Lithic sandbox) → a real booking.com confirmation on trip SIN-1025 verified
on chain (real proof footage: crew DAO paid Maya 226.60 USDC) → a forged email refused (real tx) and 35 attacks refused,
46 of 46 checks → close on dibs.larinova.com/t/lis0312.

## Voice
ElevenLabs **Eleven v4** (`eleven_v4`, newest flagship; with-timestamps confirmed for v4), voice **Talia - Warm Confident
Narrator** (Voice Library, added to the account), stability 0.5, similarity 0.75, one `[warm, conversational]` tag per
line. **2,574 of 4,000 characters used**, no retries (`voice/usage.json`). In the cut: L01, L02, L03W (wallet-first),
L03A (mainnet), L04-L06, L07 (real-booking version), L08, L09. Unused takes kept: L03 (passkey), L03B (testnet line),
the Lisbon L07 (`voice/raw/`).

## Music and sound
Mixkit **"Coffee or Tea"** by Michael Ramir C. (Mixkit Stock Music Free License; ends on the last frame). Runners-up
"Hazy After Hours" and "Sleepy Cat" on disk (`public/audio/music/`, swap = `MUSIC.file` in `src/audio/Mix.tsx`). SFX only
from the team's Drive library copies (`public/audio/sfx/`, cue sheet `src/audio/cues.ts`). Provenance: `PROVENANCE.md`.

## Footage (all real; `python3 -I scripts/footage-ready.py` gates every clip)
| Slot / clip | Used for |
|---|---|
| `s03-wallet-first` (recorded by the coordinator on dibs.larinova.com, 15 Nov) | S03 first step (live testnet trip lisiwutm): "This bed is yours", tap Connect a NEAR wallet; frozen at 6.0 s before NEAR Connect's picker (third-party logos) |
| `pay-base` (label-patched, see PROVENANCE) | S03 chain list (variant A never shows its testnet tracking steps) |
| `mainnet-pay-a`, `mainnet-receipt-intents`, `mainnet-lismain-paid` | S03 mainnet back face (crops avoid the explorer logo, incident banner, sender wallet and "Bed 01" eyebrow) |
| `resale` (take 2) | S04 refund refused, E_NO_REFUND from chain |
| `card` | S06 Approved / Declined (Lithic sandbox) |
| `proof` | S07 sin1025 facts + DAO payout |
Unused: `mainnet-receipt-sweep` (third-party explorer branding), `wallet-near-testnet-take1`, `*-take1`, `pay-base-orig`.

## One-line swaps
- Narration: `voice/placement.json` → `"variant"` (A mainnet / B testnet tail) and `"head"` (L03W wallet-first / L03 passkey); then `python3 -I scripts/build-timeline.py`.
- End-card URL: `FACTS.liveUrl` in `src/tokens.ts` (`dibs.larinova.com/t/lis0312`).
- Proof honesty switch: `PROOF_ACCEPTED` in `src/tokens.ts` (true: sin1025 accepted on chain, tx 54g9Y2qg…).
- Re-render: `scripts/render.sh vN` (disk check, one shared bundle in `out/bundle`, machine-wide render slot, master, captions); QA: `python3 -I scripts/qa.py out/dibs-film-vN.mp4`.

## Known gaps
- Mix not listened to by me.
- S03 shows a $40 Lisbon story trip (testnet UI) and then the real $0.25 mainnet payment on trip lismain; the narration says "We ran this same payment on NEAR mainnet, with real money."
- The proof beat is a different real trip (SIN-1025); the narration and a chip say so. SGD is compared 1:1 to the USDC cap (no FX); the film claims no conversion.
- Kept until the team accepts FINAL: `out/bundle` (61 MB) and the review renders (v1-v6, raw-*); then the bundle is deleted and the
  superseded renders go to off-machine storage, keeping only FINAL locally.
- The wallet-first VO line (193 characters) was generated at 02:08 IST, before the coordinator's go reached me; the team had approved
  ~130 characters at 01:32. One generation, no retries. No further paid generation without an explicit go with its size.
