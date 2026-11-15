# Dibs demo film: PLAN (Sat 14 Nov 2026, IST)

Film lead: Claude (Opus 5.5). Approved story: `../demo/STORY.md` (team, 14 Nov). Contract: the team's film brief (not in this repo).
Delivery: 1920x1080, 30 fps, H.264 yuv420p limited-range BT.709, AAC 48 kHz, about -14 LUFS, true peak <= -1 dBTP.
Length (v2): **128.37 s (3,851 frames) with voice variant B** (126.0 s with variant A), target 2:00, hard cap 2:15. Milestones: v1 by 23:00 IST, final by 02:30 IST.
Studio: `http://localhost:3017` (composition `Film`; one composition per scene `Scene01`..`Scene09`; seam reference `Handoffs`).

## 1. Story, audience, aha, closing line

**Story.** Every group trip has one friend who books the place and then chases everyone for weeks. Dibs makes the trip
itself a NEAR contract: every bed is its own keyless account, friends pay from any chain (NEAR Intents 1Click,
passkeys, no gas), and nobody can book until every bed is paid. Drop out and there is no refund: you sell your bed at
face value to someone already waiting. A fair OutLayer VRF draw decides who sleeps where. Then the trip gets its own
hotel-only card from an OutLayer enclave, sealed to the booker's passkey (Lithic sandbox), and when the booking.com
confirmation lands in the trip's own inbox, an enclave checks booking.com really signed it, NEAR AI reads it privately,
the contract verifies the signed result on chain, and the crew's DAO releases the money on its own. Nobody holds it.

**Audience.** NEAR HACKATHON judges and X viewers (often muted autoplay, strangers to the product): first line must make
sense to a stranger; NEAR's role named concretely; one complete moment from user action to visible result.

**The 30-second aha.** By 0:30 Leo has paid from Base with a passkey and NEAR Intents has landed it in bed 03's own
account: "the trip collects its own money; nobody fronts it". The magic moment (one) is at 1:20-1:42: a real
booking.com email in the trip's inbox releases the money with three visible checks.

**Closing line (spoken).** "So nobody fronts the money, and nobody has to chase anyone. The Lisbon trip is live on NEAR
testnet, and the link is right below." (No tagline; the lockup shows the wordmark, the live trip URL and the repo.)

## 2. Narration (verbatim, as generated)

Voice: **ElevenLabs Eleven v4 (`eleven_v4`)**, voice **Talia - Warm Confident Narrator** (`xt1AC3mKnyqJYvD3KK90`,
Voice Library, added to the account as "Talia - Dibs narrator"; its `high_quality_base_model_ids` include `eleven_v4`).
Settings: stability 0.5, similarity 0.75 (v4 has only these two; style/speed sliders and SSML are not available), one
inline audio tag `[warm, conversational]` per line, seed 3120, `previous_text`/`next_text` for continuity.
Endpoint: `POST /v1/text-to-speech/{voice}/with-timestamps` with `model_id: eleven_v4`: **confirmed working** (L01 test
returned audio plus character alignment; the tag's characters are aligned at ~0 s and stripped by `scripts/voice.py`).
So no forced-alignment fallback was needed; trade-off recorded in section 9.
Why: v4 is ElevenLabs' newest flagship (launched 28 Sep 2026; "most emotive", audio tags followed more reliably than v3)
and the with-timestamps endpoint gives the per-word cue frames the timeline is built on. Talia is an American, warm,
conversational narrator (the team's "across a table" register) with native v4 support; the account's own warm female
voices are Polish- or Tamil-native or a Gen-Z social read.
Docs: https://elevenlabs.io/docs/overview/models , https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 ,
https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps , https://elevenlabs.io/blog/eleven-v4 ,
https://elevenlabs.io/blog/elevenlabs-audio-tags-list
Budget: 4,000 characters including retries. **Used: 2,381 characters sent** (v2 adds the re-voiced L07, 376) (9 lines + the testnet variant line, no retries;
the API's `character-cost` header reported less). Quota before: 115,047 / 220,149 used. Script: `scripts/voice.py` (refuses past 4,000).

Placement is `voice/placement.json`; every word's absolute frame is in `src/timeline.generated.ts` (`scripts/build-timeline.py`).
**Variants (coordinator, 14 Nov):** the mainnet run is not confirmed, so the cut uses **B** (testnet line). A is a
one-field swap: `"variant": "A"` in `voice/placement.json`, then `python3 -I scripts/build-timeline.py`. With B every line
from L04 on, and every scene from S04 on, starts **+71 frames** later (`SHIFT`); the table below lists L04-L09 at their
variant-A frames: add 71 for the cut.

| Line | Start-end (s) | Frames | Lands on | Text |
|---|---|---|---|---|
| L01 | 0.50-6.82 | 15-205 | "money" @181 | Every group trip has one friend who books the place, and then spends weeks chasing everyone for the money. |
| L02 | 7.60-18.24 | 228-547 | "NEAR" @336, "paid" @532 | So we built Dibs, where the trip itself is a contract on NEAR. Every bed gets its own account with no keys, and nobody can book until every bed is paid. |
| L03 | 19.00-31.50 | 570-945 | "Intents" @868, "three" @928 | Now Leo pays for his bed. A passkey on his phone is his only key, so there's no wallet and no gas. He pays with USDC on Base, NEAR Intents swaps it, and it lands in bed three. |
| **L03B** (variant B, default) | 31.80-38.12 | 954-1144 | "faucet" @992, "mainnet" @1118 | On testnet, a faucet stands in for that deposit, because NEAR Intents only runs on mainnet. |
| L03A (variant A, only if the mainnet run is real) | 31.55-35.96 | 947-1079 | "mainnet" @1009 | We ran this same payment on NEAR mainnet, with real money. (cut from the original L03 take) |
| L04 | 36.80-49.84 | 1104-1495 | "refuses" @1243, "Priya" @1404 | Say Ana can't make it anymore. She asks for a refund, and the contract refuses, because that would leave the trip short. So she sells her bed at face value to Priya, who's already waiting with her money in. |
| L05 | 50.70-58.54 | 1521-1756 | "randomness" @1622 | Once all eight beds are paid, OutLayer's verifiable randomness decides who sleeps where, so nobody argues over the double room. |
| L06 | 59.40-79.08 | 1782-2372 | "card" @2008, "declined" @2245, "sandbox" @2350 | Now Maya books, but not with her own money. An OutLayer enclave, called from NEAR, issues the trip its own card, sealed to Maya's passkey, and it only works at hotels. So the hotel charge goes through, and the electronics store is declined. For now, that card runs on Lithic's sandbox. |
| L07 (v2, re-voiced) | 82.47-106.55 (B) | 2474-3196 (B) | "inbox" +180, "privately" +385, "chain" +602, "releases" +658 | Here's a real booking.com confirmation from one of our own trips, landing in that trip's own inbox. An Intel TDX enclave checks that booking.com really signed it, and NEAR AI reads it privately, so friends only see the dates, the guests and the total. When the contract verifies that signed result on chain, the crew's DAO releases the money on its own. |
| L08 | 103.10-111.90 | 3093-3357 | "refuses" @3172, "refused" @3326 | If someone forges that email, the contract refuses it. We threw thirty-five attacks at the contracts, and every one was refused. |
| L09 | 112.70-121.26 | 3381-3638 | "chase" @3471, "below" @3621 | So nobody fronts the money, and nobody has to chase anyone. The Lisbon trip is live on NEAR testnet, and the link is right below. |

Rules kept: problem first; product before numbers; "so"/"now"; full sentences; one plain honest line (Lithic sandbox);
NEAR's role named concretely (contract, keyless bed accounts, NEAR Intents, mainnet payment, DAO, testnet).

## 3. Numbers and where they come from (every on-screen number)

| On screen | Source |
|---|---|
| $40 a bed, 8 beds, $320 pot, 7 of 8 paid, $280 owed in the hook | `apps/web/src/data/sample.ts`; DEPLOY-HANDBACK.md (lis0312: 8 beds at 40 USDC, bed 3 Held, DAO holds 280 USDC) |
| 12 Mar - 15 Mar, 3 nights, Alfama flat with a roof terrace | `sample.ts` |
| b01-lis0312 ... b08-lis0312 (bed accounts) | DEPLOY-HANDBACK.md (`b03-lis0312.dibs-0eb9ae.testnet` form) |
| lis0312@dibs.larinova.com | services/inbox/HANDBACK.md, `outlayer/verifier/src/recipient.rs` |
| E_NO_REFUND | contract; live refusal in DEPLOY-HANDBACK.md; judge-report.json |
| VRF draw tx gADA3SGt...7c6w (testnet, trip drw0001) | DEPLOY-HANDBACK.md |
| Card: hotels only, MCC 7011, limit = pot, Carlton City Hotel SG approved, VoltCity Electronics (MCC 5732) declined, last4 8087 in the preview | outlayer/CARD-HANDBACK.md, `apps/web/src/components/trip/card-sheet.tsx` |
| Forged email refused: proof_refused E_NO_RESULT, tx 93AJG9P2... | DEPLOY-HANDBACK.md; deploy/testnet.json "submit_proof_sin1025_tampered" (DAO untouched) |
| **Proof beat (v2): the REAL booking** on trip sin1025: booking.com, 25 Oct - 26 Oct 2025, 1 night, 2 guests, total SGD 226.60 (cap $240; compared 1:1, no FX conversion), DKIM d=booking.com, inbox sin1025@dibs.larinova.com; **accepted on chain** tx 54g9Y2qgKPNFamFeN6tQUgpR1AqU322F1J184LB8mYKr (verifier v7); payout done: DAO paid Maya 226.60 USDC | coordinator (14 Nov), DEPLOY-HANDBACK.md (sin1025: 2 beds at 120 USDC, 2025-10-25..26). Redacted: no name, address, booking ref. Coordinator confirmed acceptance on chain (14 Nov), so `PROOF_ACCEPTED = true`; the payoff is the real `proof` footage. |
| 35 attacks refused; 46 of 46 checks pass | `contracts/judge-report.json`: 46 checks all ok; 35 expect a refusal code (the 36th code entry is "OK", a genuine accept) |
| Mainnet: Leo's payment from Base via 1Click into bed 03 | **footage slot** `mainnet-receipt`; amount and tx come from the coordinator's mainnet run (STORY plans $0.25). Narration says no amount. |

Corrections to STORY.md: (1) STORY's "46 attacks, 0 got through" is wrong: judge-report has 46 checks of which 35 are
attacks. The film says "thirty-five attacks... every one was refused" and shows "46 of 46 checks pass". (2) The hook
counter climbs to **$280** (7 friends x $40 owed to Maya), not $600, so it traces to the trip.

## 4. Brand tokens (from the live product, `src/tokens.ts`)

- Canvas `#0e0e0e`; panel `#191918`; raise `#232322`; glass `rgba(40,40,39,.74)` + `blur(24px) saturate(1.2)`, hairline
  `rgba(255,255,255,.08)`, inset sheen, drop shadow `0 24px 60px -24px rgba(0,0,0,.7)`; radius 24 (glass), 28 (sheet), pill 999.
- Type `#ececea`, grey `#73736f`, dim `#585855`. Status: paid `#34d399`, due `#fb923c`, resale `#38bdf8`, refused `#fb7185`, you `#facc15`.
- Faces: LetterFace port (initials as eyes, cheeks, mouth from seed, blink on the shared 2.2 s beat = 66 frames), colours
  Maya #fb923c, Sam #38bdf8, Leo #4ade80, Ana #f472b6, Tomás #facc15, Jun #a78bfa, Chloé #2dd4bf, Kofi #fb7185, Priya #c084fc.
- Font: SF Pro (system-ui on this Mac; verified rendering) with Inter fallback; headlines weight 600, tracking -0.024em,
  line-height 1.12, two tones (white statement, grey continuation). Mono: JetBrains Mono. Wordmark "dibs" 700, -0.04em.
- Motion: arrivals `cubic-bezier(.2,.7,.2,1)`; word sweep (opacity, blur 8 px, y 8 px over 0.55 s, `cubic-bezier(0,0,.58,1)`);
  spring ~8% overshoot; faces rise from below then bob and sway on their own clocks.
- Film scale: app UI is shown at about 1.4-2x its CSS px so the smallest text is >= 17 px and body text >= 24 px at 1080p.
- No third-party logos anywhere: booking.com, Base, Solana, Lithic, Intel, OutLayer, NEAR named in plain text only.

## 5. Construction

One continuous world: the same near-black `World` background (soft drifting warm lift, fine grain, vignette) under
every scene. CSS 3D `Stage` camera (perspective 2000) for push-ins, trucks and tilts; app footage lives in `AppWindow`s in
that space; MG objects lift out of windows and become the next scene. Scenes hard-cut only on identical frames: scene N
ends exactly on handoff pose Hn and scene N+1 starts exactly on it (`src/handoffs.tsx`), so the cut is invisible.

Purposeful 3D: the OutLayer enclave is a glass cube (CSS 3D, six frosted faces, edge light) that the pot flows into and
the card rises out of; the card turns in 3D (S06); footage windows tilt in and out of depth; the attack grid flips (S08).

## 6. Shot list (30 fps, absolute frames)

### S01 Hook: pay me later (0-228) - motion graphics
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 0-15 | Frame 0 already shows Maya's face (160 px, orange, centre ~ (960,470)) and the first glass chat bubble "Booked the Alfama flat. It's $40 each, send when you can" from Maya. No title, no logo. | Starts close (scale 1.3 on the bubble), begins pulling back at once | - |
| 15-150 | Friends' replies pop in around Maya in a loose ring, each a glass bubble with the sender's LetterFace (44 px) and real-sounding text: Sam "I'll pay you later", Leo "pay you friday", Ana "can I pay after payday?", Tomás "who do I send it to again?", Jun "I'll pay you later", Chloé "doing it tonight, promise", Kofi "sending soon". Stagger ~14 frames, words 30 px weight 500. Counter under her: "$0" climbs in $40 steps to **$280** (120 px, 600, tabular) with "owed to Maya" (due orange, 30 px). | Continuous slow pull-back (scale 1.3 -> 1.0, ease out), tiny drift | - |
| 150-200 | Hold while "chasing everyone for the money" plays: the bubbles drift and keep stacking slightly (no new idea); counter settles at $280. | Gentle drift | - |
| 200-228 | Bubbles pop away in reverse order (scale 0.85, blur, opacity), counter sweeps out, Maya's face eases to **H1** (132 px at (960,420), orange glow, void ring). | Settle | **H1 Maya's face** |
Type: chat 30 px; counter 120 px. Colour: only faces + due orange. SFX: pops on bubble arrivals (quiet, varied).

### S02 The flip: the trip is a contract (228-570) - motion graphics (app components ported)
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 228-262 | From H1: Maya bobs; the landing's crowd rises from below around her (seeded layout from `landing/crowd.tsx`, far faces smaller and blurred). | Static | H1 in |
| 252-290 | "dibs" wordmark (110 px) sweeps in under her at y=600 on "Dibs" @252. | - | - |
| 283-345 | Wordmark lifts away; "The trip itself" (white) "is a contract on NEAR." (grey) sweeps in word by word on the narration (trip@283 ... NEAR@336), 64 px, y=600. | Slow push (scale 1 -> 1.04) | - |
| 345-380 | Crowd drifts out of frame; headline sweeps out; the 7 crew faces fly in to join Maya in a row of eight (72 px) at y=380; above them "Lisbon" (88 px white) + "Alfama flat with a roof terrace. 12 Mar - 15 Mar, 3 nights." (grey 30 px) sweep in. | Truck begins: ry 8deg -> -8deg over the row, x pan | faces |
| 365-450 | "Every bed gets its own account with no keys": under each face a glass tile drops in: mono "b01-lis0312" ... "b08-lis0312" (26 px), and on "no keys" @422-440 a key glyph appears on each tile and is struck through (stagger 3 frames). | Truck continues left -> right, slight 3D depth | tiles |
| 451-532 | "nobody can book until every bed is paid": faces lift and fade; tiles compress into the funding meter (8 cells, 1200 x 22, gap 12). Cells fill white one by one, cell 03 (Leo) stays hatched orange and gets the ring. "7 of 8 paid." (white) "1 to go before anyone can book." (grey) sweeps in at 60 px on y=500. | Camera returns to neutral | meter |
| 532-570 | Settle exactly on **H2**. | Neutral | **H2 meter + line** |
SFX: soft rise for the crowd; tick per tile; key strike pencil; meter fill.

### S03 Pay from any chain (570-1104) - footage `pay-base` + `mainnet-receipt` with MG lift-outs
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 570-600 | From H2: the line sweeps out; cell 03 grows (morph) into Leo's bed row (BedRow: face, "Leo · you · bed 03 · Held, not paid yet", "Pay $40" pill) centred at 1.4x. | Push toward cell 03 | H2 in |
| 600-628 | The "Pay $40" pill presses (scale .96) on "pays" @595-605 and expands into an AppWindow (about 1000 x 820) that tilts up from rx 14deg to 0. | Push in | pill -> window |
| 628-940 | **FootageSlot `pay-base`** (crop follows the sheet so its 14.5 px text reads at ~26 px). Story: passkey step on "passkey" @640 ("A passkey on this phone becomes the only key bed 03 listens to. No wallet, no seed phrase, no gas."), chain list with Base selected on "Base" @842, tracking steps "Deposit seen on your chain / Swapped by NEAR Intents / Landed in your bed's own account / Counted in the crew DAO" ticking on "Intents" @868 and "three" @928. Placeholder = the app's PaySheet steps rebuilt with `SheetFrame` + `Steps`. | Window drifts; crop pans within the sheet | - |
| 860-935 | Lift-out: a "40.42 USDC · Base" chip rises out of the window, passes through a rotating "NEAR Intents" ring, flips to "40.00 USDC · NEAR" and drops into a "b03-lis0312" tile that lights white. | Slight pull back to show both | coin |
| 945-1079 | The window turns over (ry 0 -> 180, back face) to the mainnet receipt: **FootageSlot `mainnet-receipt`** with a yellow pill "NEAR mainnet · real money" on "mainnet" @1009. Placeholder: a Dibs-styled receipt summary (Success, from NEAR Intents 1Click deposit, to bed 03, amount from the run). | Push in to the receipt | - |
| 1079-1104 | The receipt shrinks into row 03 of "The beds" list, which assembles around it: all eight paid, Leo "USDC on Base". Settle on **H3**. | Pull back | **H3 bed list** |
SFX: pill press click; passkey tech blip; coin swoosh + cash ting on landing; card flip paper slide for the window turn.

### S04 Can't make it (1104-1521) - footage `resale` + MG
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 1104-1150 | From H3: other rows dim to 30%; push into Ana's row (bed 04) on "Ana" @1121. | Push in | H3 in |
| 1170-1300 | Ana's row opens into an AppWindow with **FootageSlot `resale`**: "Plans change." and the two pills; "Get my $40 back" pressed on "refund" @1200; the app's refused card (rose border, "Refused" badge) shows. On "refuses" @1243 a large rose stamp "Refused · E_NO_REFUND" (mono code) lands on the window. | Hold, small drift | - |
| 1270-1330 | "because that would leave the trip short": under the window the 8-cell meter shows cell 04 empty and pulsing (a hole), then refills when the idea resolves. | - | - |
| 1330-1400 | Window slides away left; the app's tear ticket (port of `vendor/tear-ticket`: "BED 04 / LISBON / 12 Mar - 15 Mar", Ana's face; stub "FACE VALUE $40 tear to sell") centred at ~900 x 340; on "sells" @1350 the stub tears along the perforation and swings free. | - | ticket |
| 1400-1470 | Priya's face (purple) arrives from the right with a green "$40 ready" chip on "Priya" @1404; the stub flies to her and her $40 flies to Ana (green "+$40" on Ana). Priya's face slides into the ticket's face spot. | Slight truck right | Priya |
| 1470-1521 | Pull back: the ticket becomes row 04 of "The beds": Priya in bed 04 ("Bought from Ana at $40, face value"). Settle on **H4**. | Pull back | **H4** |
SFX: soft click on the button; stamp on the refusal; paper tear (paper slide); cash ting for Ana.

### S05 Fair draw (1521-1782) - motion graphics (DrawSheet look)
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 1521-1565 | From H4: on "eight beds are paid" the Paid badges brighten in a quick green wave; a chip rises above the list: dice icon + "OutLayer VRF". | Slight pull back | H4 in |
| 1570-1690 | The draw: each row's sub-line cycles bed names (DrawSheet rolling: grey, slightly blurred, slowing ticks) on "verifiable randomness decides" @1600-1655; then names lock in white top to bottom by "where" @1677. | Static | - |
| 1691-1750 | "so nobody argues over the double room": Leo's row "Double room, window side" gets a brief yellow ring; below the list a mono proof chip "VRF draw verified on NEAR testnet · gADA3SGt...7c6w". | - | - |
| 1750-1782 | Chip and ring fade; settle on **H5** (drawn list). | - | **H5** |
SFX: decelerating ticks; a small win sound when it settles.

### S06 The trip gets a card (1782-2403) - MG + footage `card`
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 1782-1830 | From H5: rows fold up; Maya's face stays and moves left of centre; the other seven gather behind her; a glass "$320 · crew DAO" pill sits at centre. "Maya books." (white) "Not with her own money." (grey) sweeps in at the bottom (y=900) on "books" @1806 and "not" @1837. | - | H5 in |
| 1885-1960 | The OutLayer enclave: a frosted glass cube (CSS 3D, ~300 px, slowly turning) with chip "OutLayer · Intel TDX"; a small pill "called from NEAR" slides into it on "NEAR" @1949; the $320 pill flows in. | Orbit slightly (ry -10 -> 10) | cube |
| 1967-2030 | On "issues" @1967 / "card" @2008 the TripCard (640 px) rises out of the cube's top and turns from rx 60 / ry -25 to flat; glossy sheen sweeps once. | Push to the card | card |
| 2029-2075 | "sealed to Maya's passkey": Maya's face (72 px) docks at the card's corner with a fingerprint + lock; chip "Sealed to Maya's passkey". | - | - |
| 2078-2125 | "only works at hotels": the card's "Hotels only" chip glows; the cube fades. | - | - |
| 2140-2275 | Card moves to x=620; an AppWindow slides in at right with **FootageSlot `card`** cropped on "Try it": "Carlton City Hotel SG · Hotel · MCC 7011 · Charge $320" -> **Approved** (green) on "through" @2191, then "VoltCity Electronics · Electronics · MCC 5732" -> **Declined** (rose) on "declined" @2245. Placeholder rebuilds those rows. | Truck right | - |
| 2276-2372 | Honest line under the card (fg2, 28 px): "Lithic sandbox: the card network is simulated; the rules are real." (the app's own sentence) on "sandbox" @2350. | - | - |
| 2372-2403 | Window and line leave; card recentres flat on **H6**. | Neutral | **H6 card** |
SFX: soft whoosh into the cube; card rise; approve chime (quick-win); decline punch.

### S07 Prove it, the magic moment (2403-3093) - MG + footage `proof`
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 2403-2440 | From H6: the card swipes off right-up ("Maya books"). | - | H6 in |
| 2410-2480 | From the right an email card flies in: "booking.com" (plain text), "Your booking is confirmed", to "lis0312@dibs.larinova.com". | Follow it | email |
| 2475-2540 | It lands in the trip inbox (InboxPanel assembles: "The trip's own inbox", address row in mono) on "inbox" @2509, as a row "Checking…". | Settle | - |
| 2545-2840 | Three check tiles light in sequence beside/below the email (glass, slight 3D tilt): 1 "DKIM: booking.com really signed it" sub "Intel TDX enclave · OutLayer" on "signed" @2657; 2 "Read privately by NEAR AI" sub "GPU enclave · nobody sees the email" on "privately" @2721 (the email body blurs to unreadable as a sheen passes); 3 "Signed result verified on chain" sub "ed25519 · dibs contract" on "chain" @2828. Green check discs, quiet pings. | Push into the email, then pull to show all three | checks |
| 2859-2960 | "Friends only see the dates, the guests and the total": the blurred email dissolves and three fact chips lift out: "Dates 12 Mar - 15 Mar", "Guests 8", "Total $320" (on "dates" @2890, "guests" @2920, "total" @2941); a dim strike line "Hidden: names, address, card, booking reference". | - | facts |
| 2965-3050 | **FootageSlot `proof`** window rises with the real facts card ("What every friend sees", Verified) and the green line "The crew DAO paid Maya $320. The proposal passed because the contract proved the booking; no vote needed." on "releases" @3003. The eight faces pop up along the bottom edge and bob (cheer). | Push in | - |
| 3050-3093 | Window recedes; the inbox panel returns with the email row now **Verified**. Settle on **H7**. | - | **H7 inbox** |
SFX: email arrive (paper slide), three distinct soft confirms (not repeated), release cash ting.

### S08 Try to cheat (3093-3381) - MG (+ optional footage `forged`)
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 3093-3140 | From H7: a second email enters; inside it, "Total $320" is retyped to "Total $3,200" with a caret (the forgery) on "forges" @3112. | Push in | H7 in |
| 3140-3200 | It lands as row 2, "Checking…" then **Refused** (rose) with a small shake on "refuses" @3172; chip in mono: "DKIM doesn't match · proof_refused E_NO_RESULT · tx 93AJG9P2… · DAO untouched". | - | - |
| 3210-3330 | Inbox recedes; a 7 x 5 grid of 35 small glass tiles flips in (one frame stagger), each showing one real refusal code from judge-report (E_NO_REFUND, E_WRONG_AMOUNT, E_BAD_SENDER, E_NOT_USDC, E_PRIVATE, E_BAD_SIG, E_DATES, E_GUESTS, E_TOTAL, E_DOMAIN, E_REPLAY, E_DEADLINE ...); on "refused" @3326 they flip to rose in a wave. Caption mono fg3: "contracts/judge-report.json · 46 of 46 checks pass". | Slow push, slight tilt | grid |
| 3330-3381 | Tiles collapse to centre and vanish while "35 attacks." (white) "Every one refused." (grey) sweeps in, 72 px. Settle on **H8**. | Neutral | **H8 words** |
SFX: key presses for the retype; stamp/punch for refused; ticks for the wave (trimmed).

### S09 Close (3381-3720) - motion graphics lockup
| Frames | On screen | Camera | Carry |
|---|---|---|---|
| 3381-3420 | From H8: the line sweeps out upward; Maya's face rises from below to centre (hello-face rise, 1 s) and bobs; the crowd rises around (bookend to S02). | - | H8 in |
| 3405-3500 | "Nobody fronts the money." (white) "Nobody chases anyone." (grey) sweeps in under her on "fronts" @3410 / "chase" @3471, 64 px. | - | - |
| 3505-3720 | Headline sweeps out; lockup: "dibs" wordmark 140 px; a light pill "dibs-trips.pages.dev/t/lis0312" (the live trip; final URL confirmed by the coordinator) on "link" @3597; mono fg2 "github.com/RealMarsela/dibs"; bottom line fg3 22 px "Built at NEAR HACKATHON · runs on NEAR testnet · card rails: Lithic sandbox". Faces keep bobbing; hold to the end. | Very slow push | end |
SFX: soft rise under the crowd; nothing on the final hold (music resolves).

## 7. Transitions (start, intermediate, end; easing; duration)

| Seam / move | Start pose | Intermediate | End pose | Easing, duration |
|---|---|---|---|---|
| S01 bubbles -> H1 | Ring of 8 bubbles + counter | Bubbles shrink to 0.85, blur 6 px, fade in reverse order; counter blurs up | Maya alone at H1 | ease (0.2,0.7,0.2,1), 28 f |
| H1 -> S02 crowd | Maya alone | Faces rise from 55-95% of frame height with slight tilt | Crowd bobbing around Maya | ease, 27-45 f each, staggered |
| S02 headline -> faces row | Headline centred | Headline sweeps out (blur 10, up 12); crowd drifts to edges and fades | Eight faces in a row + "Lisbon" | oe 12 f + ease 30 f |
| S02 tiles -> meter (H2) | 8 glass tiles 150 x 120 | Tiles shrink in height and round off; faces lift and fade | 8 meter cells 1200 x 22 | in-out-strong 36 f |
| H2 -> Leo's row | Meter + line | Line sweeps out; cell 03 scales up and morphs radius/size into the row | Leo's row at 1.4x | in-out-strong 26 f |
| Row pill -> pay window | Pill 40 px tall | Pill grows into the window, window tilts rx 14 -> 0 | Window 1000 x 820 | out-strong 22 f |
| Coin lift-out | Chip in the window | Arc up-right through the ring (label flips) | Lands in b03 tile | ease 70 f total |
| Window flip -> receipt | Pay window front | ry 0 -> 90 (edge) -> 180 with slight pull back | Receipt back face | in-out-strong 24 f |
| Receipt -> H3 | Receipt window | Shrinks into row 03's rect; list rows fade in around it top to bottom | Bed list H3 | in-out-strong 25 f |
| H3 -> Ana's window | List | Other rows dim; Ana's row grows into the window | Window | out-strong 22 f |
| Ticket -> H4 | Ticket centred | Ticket shrinks to row 04's rect; list assembles | Bed list H4 | in-out-strong 30 f |
| H5 -> card scene | Drawn list | Rows fold up (rx 70, fade, stagger 2 f); faces regroup | Maya + crew + pot | ease 30 f |
| Cube -> card | Cube | Card rises out of the top with 3D turn | Card flat | spring (~8% overshoot), 40 f |
| H6 -> email | Card centre | Card swipes off to right-up (and shrinks); email flies in from right | Email in inbox | out-strong 20 f / ease 30 f |
| Facts -> proof window | Fact chips | Chips dock onto the window's facts card positions | Window | ease 24 f |
| H7 -> forged row | Inbox | Second email enters below | Inbox with 2 rows | ease 24 f |
| Grid -> H8 | 35 tiles | Tiles collapse to centre (scale 0.2, fade), words sweep in | H8 | in-out-strong 30 f |
| H8 -> close | Words | Words sweep out up; Maya rises from below | Crowd + Maya | oe 12 f, rise 30 f |

Hard rules at every transition: nothing crosses text while it is readable; 96 px safe margin holds mid-move; no
label peeks from behind a panel; motion never fully stops during holds (faces bob, World drifts).

## 8. Footage slots (ids match FOOTAGE.md)

| Slot | Scene, frames used | Seconds needed | Placeholder (rebuilt from the app's components) |
|---|---|---|---|
| `pay-base` | S03 628-940 | 16 | PaySheet steps: passkey, chain list (Base), tracking steps |
| `mainnet-receipt` | S03 975-1079 | 6 | Dibs-styled receipt summary, "NEAR mainnet" |
| `resale` | S04 1170-1300 | 9 | ResaleSheet ask + refused card |
| `card` | S06 2140-2275 | 18 (we use the "Try it" part) | CardSheet "Try it" rows with Approved / Declined |
| `proof` | S07 2965-3050 | 18 (we use the facts + DAO paid part) | ProofSheet facts card + green DAO line |
| `forged` | S08 3150-3200 (optional) | 6 | ProofSheet refused panel |

## 9. Music and sound

Mixkit (Mixkit Stock Music Free License, https://mixkit.co/license/#musicFree), all three on disk in `public/audio/music/`:

| | Track | URL | BPM (librosa) | Mood | Length |
|---|---|---|---|---|---|
| **Pick** | Coffee or Tea, Michael Ramir C. (Electronica) | https://assets.mixkit.co/music/1168/1168.mp3 | 103 | warm, modern, unhurried; quiet intro, lifts at 1:44 | 2:05 (content to ~2:01.5) |
| Runner-up | Hazy After Hours, Alejandro Magaña (Electronica) | https://assets.mixkit.co/music/132/132.mp3 | 123 | brighter, steady groove after 0:16 | 2:07 |
| Runner-up | Sleepy Cat, Alejandro Magaña (Chillout) | https://assets.mixkit.co/music/135/135.mp3 | 68 (136) | dark lo-fi, flat dynamics | 1:59 |

Why the pick: its quiet first 8 s sits under the hook, its middle is even under dense narration, and its lift at 1:44
of the track lands (with the music starting at film 2.2 s, f66) on "We threw thirty-five attacks" (~1:47 film); its
natural ending at ~2:01.5 of the track lands on the film's last frame. Not used by any other film on this Mac.
Mix (`src/audio/Mix.tsx`): music base 0.34, ducked to 0.13 under narration (6-frame ramps), fade in 30 f, fade out 45 f;
swells in the gaps between lines (0:18, 0:36, 0:50, 0:59, 1:19, 1:42). Mastering pass: two-pass loudnorm to -14 LUFS,
TP -1 dBTP (`scripts/master.sh`). I cannot listen; levels are set by measurement and must get a human ear.

SFX cue sheet (files from the team's Drive library copies only: the team's licensed SFX library
and a second library set (prefixed `fp-`); attack measured locally; final frames in `src/audio/cues.ts`):

| Frame | File | Action it identifies |
|---|---|---|
| 15-140 (per bubble) | pop-1.mp3 / es-suction-pop-5-sfx-producer.mp3 alternating, low | chat bubbles arriving |
| ~150 | display-digits-3 (trimmed) | counter landing on $280 |
| ~240 | sound-8.mp3 (riser, low) | crowd rising |
| ~422-440 | smooth-pencil-sfx.mp3 | keys struck through |
| ~600 | rm-click-2.mp3 | Pay $40 pressed |
| ~640 | 11-access-granted.mp3 (low) | passkey accepted |
| ~900 | sound-3.mp3 then cash-ting.mp3 | coin through NEAR Intents, lands in bed 03 |
| ~950 | paper-slide-03.mp3 | window turns to the mainnet receipt |
| ~1200 | rm-click-2.mp3 | "Get my $40 back" pressed |
| ~1243 | fp-stamp.wav | REFUSED stamp |
| ~1355 | paper-slide-03.mp3 | stub torn |
| ~1440 | cash-ting.mp3 | Ana paid by Priya |
| 1600-1690 | rm-click-2.mp3 ticks, slowing | the draw rolling |
| ~1690 | quick-win.mp3 (low) | beds settle |
| ~1950 | mixkit-cinematic-transition-wind-swoosh.mp3 | call into the enclave |
| ~2008 | fp-card.mp3 | card rises out |
| ~2191 | quick-win.mp3 | hotel charge approved |
| ~2245 | fp-punch.wav | electronics declined |
| ~2420 | whoosh-2.mp3 | card swipes away |
| ~2475 | paper-slide-03.mp3 | email lands |
| 2657 / 2721 / 2828 | pop-1 / es-suction-pop / rm-click-2 (each different, low) | three checks light |
| ~3003 | cash-ting.mp3 | DAO releases the money |
| ~3112-3125 | keyboard-press.mp3 x3 | the forger retypes the total |
| ~3172 | mixkit-metal-hit-woosh-1485.mp3 | forged email refused |
| ~3326 | glitch? no: lens-flare-transition (low) | the 35 tiles flip to refused |
| ~3390 | sound-9.mp3 (riser, low) | Maya rises for the close |

## 10. Risks and build order

Risks: (1) live recordings may differ from placeholders (crop rectangles then need one pass); (2) live mainnet
receipt and the live proof/DAO payout may not exist by recording time (slots stay placeholders and the narration says
"we ran this same payment on mainnet" only if the mainnet run is real: **coordinator confirms before final**);
(3) RAM: one Studio, stills through the machine-wide slot (2), one full render at a time, concurrency 4;
(4) I cannot listen to the mix; (5) the card and payout paths coexist in the product; the film presents the card for
booking and the DAO release on proof, matching the app's own sheets.

Order: tokens, timeline, handoffs, shared components, Root (done) -> PLAN.md, FOOTAGE.md -> nine scene sub-agents in
parallel (Opus, one scene each, stills only through `scripts/stills.sh`) -> review each against this plan -> SFX cues
-> full v1 render -> frame inspection at every seam and transition -> corrections -> final master.

## 11. v2 corrections (coordinator review of v1, 14 Nov)

1. Honesty: the proof beat is rebuilt on the real sin1025 booking (section 3); L07 re-voiced so on-chain acceptance is a
   condition ("When the contract verifies that signed result on chain, ..."), true whether or not the live run is accepted.
2. Scale: focal UI fills 55-70% of the frame. Seams: H2 line 76 px + meter 1500 x 28; H3-H5 bed list x1.25; H6 card 1000 px;
   H7 inbox x1.3 (sin1025, "Received" until PROOF_ACCEPTED); H8 88 px.
3. "35 attacks. Every one refused." and "46 of 46 checks pass" each readable for >= 1.5 s.
4. Real footage: pay-base (lis0314 live testnet), resale (new take, pointer parked), card; faces match the app's unsigned-hash fix.
5. Scenes now start exactly where their narration line starts (`SCENES` derived from `LINES`), so any voice change moves them.
