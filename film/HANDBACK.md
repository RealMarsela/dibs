# Dibs demo film: handback (FINAL, 15 Nov 2026, 02:23 IST)

| | |
|---|---|
| Final | `film/out/dibs-film-FINAL.mp4` (+ `dibs-film-FINAL.srt`, 39 caption cues); identical to `out/dibs-film-v6.mp4` |
| Duration | 2:08.1 (3,840 frames at 30 fps); hard cap 2:15 |
| Composition | `Film` (scenes `Scene01`-`Scene09`, seam poses `Handoffs`) |
| Studio | http://localhost:3017 |
| Technical QA (ffprobe + full decode + ebur128) | 1920x1080, H.264 yuv420p, tv range, BT.709 primaries/transfer/matrix, AAC 48 kHz stereo; 0 decode errors; -14.3 LUFS integrated, true peak -1.8 dBTP, LRA 3.1; 1.44 Mb/s; all 8 seams identical across the cut (b-6, b-2, b, b+2, b+6) |
| Not checked | I cannot listen: the mix (narration ~11 dB over the ducked bed, SFX levels) needs Gabriel's ear |

## Story as cut
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
from Gabriel's Drive library copies (`public/audio/sfx/`, cue sheet `src/audio/cues.ts`). Provenance: `PROVENANCE.md`.

## Footage (all real; `python3 -I scripts/footage-ready.py` gates every clip)
| Slot / clip | Used for |
|---|---|
| `s03-wallet-first` | S03 first step (live testnet trip lisiwutm): "This bed is yours", tap Connect a NEAR wallet; frozen at 6.0 s before NEAR Connect's picker (third-party logos) |
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
- `out/bundle` (61 MB) is deleted once the coordinator accepts the FINAL.
