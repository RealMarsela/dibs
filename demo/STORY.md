# Dibs demo film: story plan (draft for the team, Sat 14 Nov, IST)

Contract: the team's film brief (not in this repo) (house quality, plan-first, parallel scenes,
voice rules, Mixkit + Drive SFX, -14 LUFS, 1920x1080 30 fps). References: Pine Labs P3P and Grok
recreations (earlier internal studies), Local Edition and Wallspace finals
(location to confirm), vibrant.design launch videos. UI: the Hoy-based app (dark, glass, letter faces).

Look rule (team, 14 Nov): the film wears Dibs' own theme and vibe end to end (near-black #0e0e0e, warm
off-white type, frosted glass, pill buttons, blinking letter faces, the status colours, SF/Inter type).
The references teach only how visuals are constructed: camera travel, shot handoffs, transitions and
animation timing. Never their colours, fonts or style.

## Rules that bind the film
- NEAR HACKATHON: a public X post with the video, built at NEAR HACKATHON, @NEARProtocol, #NEARHackathon.
  First line understandable to a stranger; one complete moment from user action to visible result;
  NEAR's role named concretely; no long intro or architecture slides (HACKATHON.md, "The demo post").
- Length: 2:00 target, hard cap 2:15 (X's native limit for non-Premium accounts is 2:20).
- No third-party logos (booking.com, Visa, Gmail named in text only). Every number traceable to the
  repo or chain. One plain line of honest limits (card rails are Lithic sandbox).

## Story in one paragraph
Every group trip has one friend who books the place and then chases everyone for weeks. Dibs makes the
trip itself a NEAR contract: every bed is its own keyless account, friends pay from any chain, and nobody
can book until every bed is paid. Drop out and you cannot get a refund; you sell your bed at face value to
someone already waiting. Then the trip books itself: it gets its own hotel-only card from a NEAR-triggered
enclave, and when the booking confirmation lands in the trip's own inbox, an enclave checks it is really
from booking.com, NEAR AI reads it privately, and the money moves. Nobody holds the money.

## Hook (0:00-0:08)
Phone group chat, Hoy-style: "pay me later", "pay me later", "pay me later" stack around the booker's face
while a counter climbs to $600. VO: "Every group trip has one friend who books the place, and then spends
weeks chasing everyone for the money."

## Magic moment (one)
The booking.com confirmation lands in lis0312@dibs.larinova.com, three checks light up (DKIM in Intel TDX,
private read in NEAR AI, signature on-chain), and the DAO pays on its own. Nobody else has a real email as
the release condition (research/competition: 0 of ~600 entries).

## Beats (2:00)
| t | Beat | On screen | NEAR / external doing real work |
|---|---|---|---|
| 0:00 | Hook | chat bubbles, $600 counter | - |
| 0:08 | The flip | landing hello -> Lisbon trip, 8 beds, battery 7/8 | trip contract, keyless bed accounts, crew Sputnik DAO |
| 0:20 | Pay from any chain | passkey sheet, USDC on Base, "Swapped by NEAR Intents", lands in bed 03, MAINNET receipt | NEAR Intents 1Click, passkeys + gasless relay |
| 0:38 | Can't make it | refund -> REFUSED (E_NO_REFUND), tear the stub, Priya (pre-funded) takes bed 04, Ana paid on Solana | contract rules, waitlist |
| 0:56 | Fair draw | beds shuffle, settle; "OutLayer VRF" proof chip | OutLayer VRF |
| 1:06 | The trip gets a card | card issued in an enclave, sealed to Maya's passkey; hotel charge APPROVED, electronics DECLINED | OutLayer sealed key + Lithic (sandbox) |
| 1:24 | Prove it (magic) | confirmation lands in the trip inbox; DKIM / NEAR AI / on-chain checks; friends see dates, guests, total only; DAO pays | Cloudflare Email Workers, OutLayer TDX, NEAR AI Cloud, Sputnik DAO |
| 1:44 | Try to cheat | forged email -> refused; "46 attacks, 0 got through" | sandbox judge suite |
| 1:52 | Close | stack lockup, dibs wordmark, repo + live trip URL, honest line | - |

## Proof callouts (traceable)
- Mainnet (deploy/mainnet.json): trip `lismain` on `dibsapp.near`. Bed 2 paid with real USDC on NEAR, swept into the crew DAO (sweep GKYgYFwf…). Bed 1 held via the app (7T8DCg3j…) with a live 1Click quote from Base, 0.252579 USDC in for exactly 0.25 out; the Base deposit and its sweep are pending. The film shows bed 01's real sheet, so a claim of "bed 03" on mainnet is wrong.
- Testnet: VRF draw tx gADA3SGt..., refusals E_NO_REFUND / E_BAD_SIG (DEPLOY-HANDBACK.md).
- "46 of 46" from contracts/judge-report.json; real booking.com DKIM PASS (dkimpy True).
- Lithic sandbox approve/decline request ids (card lane handback).

## Voice-over
ElevenLabs, at most 4,000 characters including retries; the team's rules (full sentences, "so", "now",
problem first, product before numbers, no taglines). Voice to choose (see questions).

## Generated media
None planned: pure motion graphics plus real app footage (Hoy look), no Higgsfield. Optional later, only
with your approval and credit cost: none required.

## Production (after the product is filmable)
Remotion in near-dibs/film; shared tokens.ts + timeline.ts from word timings; one Opus sub-agent per beat
in parallel; footage recorded from the live app with agent-browser at 1920x1080 @2x; Mixkit track + Drive SFX.
Target v1 23:00 IST, final 02:30 IST, X post + submission by 04:30 IST.
