# Scene owner contract (common to all nine scenes)

You build ONE scene of the Dibs demo film in Remotion (4.0.529, React 19, project at
`/Users/gabrielantonyxaviour/Documents/hackathons/near-dibs/film`). The film lead integrates.

## Read first (in this order)
1. `PLAN.md`: sections 1, 4, 5, your scene's section in 6, the rows of 7 that touch your scene, and 8 if your scene has a footage slot.
2. `src/tokens.ts`, `src/scene.tsx`, `src/handoffs.tsx`, `src/lib/anim.ts`, every file in `src/components/`.
3. The app you are depicting (read-only): `../apps/web/src/` (index.css, motion.css, components/trip/*, components/landing/*, components/motion/*).
   A screenshot of the live trip page and landing: ask nothing; the components are the truth.

## What you own
- `src/scenes/S0X.tsx` (keep the exported component name `S0X`) and, if you need more files, a folder `src/scenes/s0X/`.
- Touch NOTHING else (not tokens, components, handoffs, Root, Film, audio, timeline, other scenes). If a shared component
  needs a change, make a local variant in your folder and mention it in your handback.
- Every file under 300 lines. No console.log.

## Clock and cues
- `const { f, A, cue, cueEnd } = useScene();` f = local frame (0 at your scene's first frame), A = absolute film frame,
  `cue("L04", "refuses")` = local frame where that narration word starts (`cue(line, word, nth)` for repeats).
  Tie every narrated moment to `cue()`, never to hand-typed numbers.
- Faces (`LetterFace`/`Face`) and `World` read the absolute frame automatically (blinks/drift match across seams).
  For face idle motion use `idle(A, seed)`.
- Wrap your whole scene in `<World>`; build depth with `<Stage cam={...}>` + `<At ...>` (CSS 3D) where it helps.

## Seams (non-negotiable)
- Your FIRST frame renders exactly the previous seam pose (H(n-1) from `src/handoffs.tsx`) over `<World>`, and your LAST
  frame (local = duration - 1) renders exactly your out pose Hn. The simplest way: render the `Hn` component itself for
  the final few frames, and make your animated elements converge onto exactly that layout before you switch to it.
  S01 has no in-pose; S09 has no out-pose.
- Check: render your first and last frames at scale 1 and compare with the `Handoffs` composition (frame index k shows H(k+1)).

## House quality (Gabriel's rules)
- One continuous film: camera travel, objects that become the next object; no entrance-then-hold cards, no repeated
  left-copy/right-object layouts, no connector-stroke diagrams, no flat labelled boxes joined by lines, no oversized
  headlines (body/headline 56-88 px; only the wordmark/hero may be bigger).
- One idea on screen at a time. Nothing crosses readable text. Keep a 96 px safe margin, including mid-transition.
  Motion never fully stops (faces bob, the world drifts, slow camera drift in holds).
- Look rule: Dibs' own theme only (tokens.ts): near-black, warm off-white, grey, frosted glass, pills, status colours,
  letter faces, SF/Inter 600 with tight tracking, two-tone sentences. No other colours, fonts or gradients.
  No third-party logos: booking.com, Base, Solana, Lithic, Intel, OutLayer, NEAR as plain text only.
- Readability at 1080p: body >= 24 px, smallest label >= 17 px. App UI is shown at ~1.4-2x its CSS px.
- Every number must already be in PLAN.md section 3. Do not invent numbers, codes or names.
- Easing: arrivals use EASE; avoid zero-velocity stops on continuous travel (use OUT_STRONG/IN_OUT_STRONG deliberately).

## Footage slots (if your scene has one)
- `<AppWindow width h><FootageSlot id="..." width h crop={...} startFrom={...} placeholder={<YourPlaceholder/>} /></AppWindow>`.
- The placeholder is the app's real UI rebuilt with our components (SheetFrame, Steps, Badge, Pill, BedRow ...), animated in
  sync with the narration. Never a grey box, never lorem.
- `crop` is in CSS px of a 1920x1080 recording where the app's desktop Dialog (440 px wide, radius 28) is centred
  horizontally (x 740-1180) and vertically centred on its own height. Choose a crop that makes the dialog's 14.5 px text
  read at >= 24 px in the film, and animate the crop's y if the content you need moves. Placeholder and footage share the box.

## Verify before handing back (machine is low on RAM)
- Typecheck: `./scripts/check.sh 2>&1 | grep -E "S0X|s0X" ; echo done` (ignore other scenes' errors, fix all of yours).
- Stills ONLY through `./scripts/stills.sh Scene0X <local frames, comma separated, <= 12 per call> out/stills/S0X --scale=0.5`
  (machine-wide queue; it may wait its turn). Never run `remotion render`, never start a Studio, never install packages.
- Inspect: first and last frame (scale 1), the start / middle / end of every transition, every narration cue moment,
  text fit and readability, nothing crossing text, safe margins. Fix and re-check.
- Studio (already running for Gabriel): http://localhost:3017 , composition `Scene0X`.

## Handback (your final message, short)
- What you built (shots, frames), what you inspected (frame numbers), anything you could not do.
- SFX cue proposals: `{ at: <absolute film frame>, file: "<name in public/audio/sfx>", vol: 0.x, lead: <frames before the hit>, note }`
  using only files in `public/audio/sfx/` (attacks: see PLAN.md 9 or measure). Vary sounds; quiet holds are fine.
- Time: hand back within about 90 minutes. A complete, clean scene beats an unfinished great one.
