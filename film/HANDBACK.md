# Dibs demo film: handback

Status: **v3 internal check render; final render held for Gabriel's taste notes** (coordinator, 14 Nov). This file is
updated at final delivery.

| | |
|---|---|
| Final path | `film/out/dibs-film-FINAL.mp4` (pending; latest: `film/out/dibs-film-v3.mp4`) |
| Duration | 2:08.4 (3,851 frames at 30 fps), voice variant B |
| Composition | `Film` (scenes `Scene01`-`Scene09`, seam poses `Handoffs`) |
| Studio | http://localhost:3017 |
| Captions | `film/out/dibs-film-vN.srt` (from the narration word timings) |
| Delivery spec (checked by ffprobe + full decode) | 1920x1080, 30 fps, H.264 yuv420p, tv range, BT.709 primaries/transfer/matrix, AAC 48 kHz stereo, 0 decode errors, -14.3 LUFS integrated, true peak -1.7 dBTP |

## Voice
ElevenLabs **Eleven v4** (`eleven_v4`, newest flagship; with-timestamps confirmed for v4), voice **Talia - Warm Confident
Narrator** (Voice Library, added to the account), stability 0.5, similarity 0.75, one `[warm, conversational]` tag per
line. **2,381 of 4,000 characters used** (`voice/usage.json`). Lines: `voice/lines.json`; placement and variants:
`voice/placement.json`.

## Music and sound
Mixkit **"Coffee or Tea"** by Michael Ramir C. (Mixkit Stock Music Free License); runners-up "Hazy After Hours" and
"Sleepy Cat" on disk (`public/audio/music/`, swap = one field in `src/audio/Mix.tsx`). SFX only from Gabriel's Drive
library copies (`public/audio/sfx/`, cue sheet `src/audio/cues.ts`). Provenance: `PROVENANCE.md`.
**Not listened to**: levels were set by measurement (narration ~11 dB over the ducked bed; short-term loudness flat
around -14 LUFS); Gabriel's ear is the check.

## Footage slots
| Slot | Status |
|---|---|
| `pay-base` | real, live testnet payment (trip lis0314), 3 segments with hard cuts |
| `resale` | real (new take, pointer parked), E_NO_REFUND read from chain |
| `card` | real (OutLayer enclave issue, Lithic sandbox approve/decline) |
| `proof` | real (sin1025 booking accepted on chain, DAO paid Maya 226.60 USDC) |
| `mainnet-receipt` | variant A only; not in the cut (mainnet not run) |
| `forged` | optional; not used (MG shows the real tampered-proof refusal on sin1025) |
A clip is used only after `python3 -I scripts/footage-ready.py` has probed it complete.

## One-line swaps
- Voice variant A (mainnet line + receipt): `"variant": "A"` in `voice/placement.json`, then `python3 -I scripts/build-timeline.py`.
- End-card URL: `FACTS.liveUrl` in `src/tokens.ts` (currently `preview.dibs-trips.pages.dev/t/lis0312`, provisional).
- Proof honesty switch: `PROOF_ACCEPTED` in `src/tokens.ts` (true: accepted on chain, tx 54g9Y2qg...).
- Re-render: `scripts/render.sh vN` (disk check, machine-wide render slot, master, captions), QA: `python3 -I scripts/qa.py out/dibs-film-vN.mp4`.

## Known gaps
- Mix not listened to by me.
- Variant B narration says the testnet faucet stands in for 1Click; the bed list still labels Leo's bed "USDC on Base" (the chain he chose).
- The proof beat is a different real trip (SIN-1025) from the Lisbon story; the narration says so ("one of our own trips") and a chip labels it.
