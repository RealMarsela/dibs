# Dibs film: asset provenance

## Music (Mixkit Stock Music Free License, https://mixkit.co/license/#musicFree)
Downloaded 14 Nov 2026 from `assets.mixkit.co` (the URL listed on each track's Mixkit page JSON-LD, licence field
"Mixkit Stock Music Free License"). Free for commercial and personal video projects, no attribution required.

| File | Title | Artist | Source URL | Role |
|---|---|---|---|---|
| `public/audio/music/mixkit-1168.mp3` | Coffee or Tea | Michael Ramir C. | https://assets.mixkit.co/music/1168/1168.mp3 | **In the film** |
| `public/audio/music/mixkit-132.mp3` | Hazy After Hours | Alejandro Magaña (A. M.) | https://assets.mixkit.co/music/132/132.mp3 | Runner-up (swap: `MUSIC.file` in `src/audio/Mix.tsx`) |
| `public/audio/music/mixkit-135.mp3` | Sleepy Cat | Alejandro Magaña (A. M.) | https://assets.mixkit.co/music/135/135.mp3 | Runner-up |

## Sound effects (Gabriel's Drive library copies only)
Copied unchanged from `~/Documents/video-library/references/strehl-demo/public-demo/sfx/` (original names) and
`~/Documents/products/fine-print/film/public/sfx/` (prefixed `fp-`). Catalog: `~/Documents/video-library/catalogs/abel-socials/sound-effects-library.json`.
No Pixabay, no synthesized sounds.

## Voice
ElevenLabs Eleven v4 (`eleven_v4`), voice "Talia - Warm Confident Narrator" (`xt1AC3mKnyqJYvD3KK90`, ElevenLabs Voice
Library, added to Gabriel's account). Generated 14 Nov 2026 via `scripts/voice.py`; text in `voice/lines.json`;
characters used in `voice/usage.json`. Used under Gabriel's ElevenLabs Creator plan.

## Visuals
All visuals are drawn in Remotion from Dibs' own source: colours, glass, pills, badges, LetterFace (ported from
`apps/web/src/components/motion/face.tsx`), crowd layout, bed list, card and inbox from `apps/web/src`. App footage is
recorded from the live Dibs app by the coordinator. `pay-base.mp4` carries a label patch (coordinator's instruction, 14 Nov): the
live app now says "Test deposit sent by the faucet" / "No swap needed on testnet" on testnet, and those two labels were
re-rendered in Chrome at the recording's scale and composited only over those two rows (`scripts/patch-paybase.py`);
the untouched recording is `pay-base-orig.mp4`. Fonts: SF Pro via system-ui on macOS (render machine), Inter and
JetBrains Mono via `@remotion/google-fonts` (SIL OFL). No third-party logos; booking.com, Base, Solana, Lithic, Intel,
OutLayer and NEAR appear as plain text only. No generated images or video.
