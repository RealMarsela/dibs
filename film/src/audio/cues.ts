/* SFX cue sheet. Files come only from the team's Drive library copies in public/audio/sfx/ (PROVENANCE.md).
   `at` is the absolute film frame of the hit, written as scene start + local frame so voice-variant shifts carry
   through. `lead` = frames from the file start to its hit (measured attack), so the hit lands on `at`.
   Integrator owns this file; scene owners proposed these cues in their handbacks. */
import { SCENES, type SceneId } from "../scene";
import { VARIANT } from "../timeline.generated";

export type Cue = { at: number; file: string; vol: number; lead?: number; trim?: number; note: string };
const s = (id: SceneId, local: number) => SCENES[id].from + local;
const c = (id: SceneId, local: number, file: string, vol: number, lead: number, note: string, trim?: number): Cue => ({ at: s(id, local), file, vol, lead, note, trim });

export const CUES: Cue[] = [
  // S01 hook: each reply bubble, alternating pops; counter lands on $280
  c("S01", 25, "pop-1.mp3", 0.22, 1, "Sam bubble"),
  c("S01", 43, "es-suction-pop-5-sfx-producer.mp3", 0.18, 3, "Leo bubble"),
  c("S01", 62, "pop-1.mp3", 0.18, 1, "Ana bubble"),
  c("S01", 80, "es-suction-pop-5-sfx-producer.mp3", 0.2, 3, "Tomás bubble"),
  c("S01", 98, "pop-1.mp3", 0.24, 1, "Jun bubble"),
  c("S01", 117, "es-suction-pop-5-sfx-producer.mp3", 0.17, 3, "Chloé bubble"),
  c("S01", 135, "pop-1.mp3", 0.2, 1, "Kofi bubble"),
  c("S01", 139, "display-digits-3.mp3", 0.16, 0, "counter lands on $280", 14),
  // S02 flip
  c("S02", 24, "sound-8.mp3", 0.3, 15, "crowd riser, peaks as the wordmark lands"),
  c("S02", 134, "whoosh-2.mp3", 0.2, 4, "crowd drifts out, Maya slides into the row"),
  c("S02", 168, "rm-click-2.mp3", 0.18, 1, "tile b01 lands"),
  c("S02", 174, "pop-1.mp3", 0.16, 1, "tile b03"),
  c("S02", 180, "rm-click-2.mp3", 0.18, 1, "tile b05"),
  c("S02", 186, "pop-1.mp3", 0.16, 1, "tile b07"),
  c("S02", 200, "smooth-pencil-sfx.mp3", 0.3, 2, "first keys struck"),
  c("S02", 213, "smooth-pencil-sfx.mp3", 0.25, 2, "last keys struck"),
  c("S02", 256, "es-suction-pop-5-sfx-producer.mp3", 0.25, 3, "tiles squeeze into the meter"),
  c("S02", 264, "mixkit-warping-slide-1531.mp3", 0.15, 5, "fill sweep across the cells"),
  c("S02", 292, "pop-1.mp3", 0.2, 1, "ring lands on bed 03 (held)"),
  // S03 pay (pre-tail cues are the same in both voice variants)
  c("S03", 29, "rm-click-2.mp3", 0.45, 1, "Pay $40 pressed"),
  c("S03", 34, "short-transition-2-sound.mp3", 0.18, 15, "pill opens into the pay window"),
  c("S03", 214, "11-access-granted.mp3", 0.25, 8, "passkey accepted, chain step appears"),
  c("S03", 272, "keyboard-press.mp3", 0.2, 2, "Base selected"),
  c("S03", 284, "whoosh-2.mp3", 0.3, 3, "$40.42 lifts out as the coin"),
  c("S03", 318, "sound-3.mp3", 0.3, 9, "coin flips to NEAR inside the NEAR Intents ring"),
  c("S03", 352, "cash-ting.mp3", 0.45, 7, "lands in b03, tile lights"),
  ...(VARIANT === "B"
    ? [
        c("S03", 396, "pop-1.mp3", 0.2, 1, "testnet chip enters under the live payment"),
        c("S03", 480, "quick-win.mp3", 0.2, 3, "You're in: all four steps ticked"),
        c("S03", 573, "mixkit-warping-slide-1531.mp3", 0.18, 6, "window shrinks into row 03"),
      ]
    : [
        c("S03", 374, "paper-slide-03.mp3", 0.35, 5, "window turns over to the mainnet receipt"),
        c("S03", 439, "pop-1.mp3", 0.3, 1, "yellow mainnet pill lands"),
        c("S03", 492, "quick-win.mp3", 0.16, 3, "mainnet trip page: every bed is paid, $0.50 in the crew's DAO"),
        c("S03", 562, "mixkit-warping-slide-1531.mp3", 0.18, 6, "mainnet receipts shrink into row 03"),
      ]),
  // S04 can't make it
  c("S04", 98, "rm-click-2.mp3", 0.45, 1, "Get my $40 back clicked"),
  c("S04", 143, "fp-stamp.wav", 0.6, 3, "REFUSED stamp lands"),
  c("S04", 222, "whoosh-2.mp3", 0.22, 4, "window slides away"),
  c("S04", 264, "paper-slide-03.mp3", 0.5, 5, "stub tears along the perforation"),
  c("S04", 333, "es-suction-pop-5-sfx-producer.mp3", 0.28, 4, "stub tucks into Priya"),
  c("S04", 357, "cash-ting.mp3", 0.45, 7, "Priya's $40 reaches Ana"),
  // S06 card
  c("S06", 172, "mixkit-cinematic-transition-wind-swoosh.mp3", 0.3, 8, "NEAR call and pot flow into the enclave"),
  c("S06", 188, "fp-card.mp3", 0.45, 4, "card rises out of the enclave"),
  c("S06", 266, "11-access-granted.mp3", 0.2, 4, "sealed to Maya's passkey"),
  c("S06", 409, "quick-win.mp3", 0.4, 3, "hotel charge approved"),
  c("S06", 463, "fp-punch.wav", 0.45, 6, "electronics declined"),
  // S07 proof (magic moment)
  c("S07", 4, "whoosh-2.mp3", 0.3, 3, "card flicks away to book"),
  c("S07", 16, "paper-slide-03.mp3", 0.35, 5, "booking email flies in"),
  c("S07", 150, "sound-3.mp3", 0.2, 8, "email files into the trip inbox"),
  c("S07", 322, "pop-1.mp3", 0.3, 1, "check 1: DKIM in the TDX enclave"),
  c("S07", 385, "es-suction-pop-5-sfx-producer.mp3", 0.28, 3, "check 2: private read by NEAR AI"),
  c("S07", 602, "rm-click-2.mp3", 0.35, 1, "check 3: verified on chain (sin1025, accepted)"),
  c("S07", 662, "cash-ting.mp3", 0.5, 15, "the DAO releases the money"),
  // S08 try to cheat
  c("S08", 4, "paper-slide-03.mp3", 0.22, 5, "copy of the email lifts out"),
  c("S08", 26, "keyboard-press.mp3", 0.35, 2, "forger starts typing over the total"),
  c("S08", 32, "keyboard-press.mp3", 0.35, 2, "forger types 2,266.00"),
  c("S08", 38, "keyboard-press.mp3", 0.3, 2, "last digits"),
  c("S08", 44, "whoosh-2.mp3", 0.18, 3, "forged email into the inbox"),
  c("S08", 79, "mixkit-metal-hit-woosh-1485.mp3", 0.45, 3, "forged email refused"),
  c("S08", 126, "mixkit-warping-slide-1531.mp3", 0.18, 5, "35 attack tiles flip in", 36),
  c("S08", 188, "lens-flare-transition-sound-effect.mp3", 0.3, 6, "rose wave: every attack refused"),
  // S05 draw
  c("S05", 60, "es-suction-pop-5-sfx-producer.mp3", 0.15, 3, "VRF chip arrives"),
  ...[79, 82, 85, 88, 92, 96, 100, 105, 110, 116, 122, 129, 136, 143, 151].map((l, i) =>
    c("S05", l, "rm-click-2.mp3", 0.3 - i * 0.007, 1, "draw reels ticking, slowing", 12),
  ),
  c("S05", 155, "quick-win.mp3", 0.25, 3, "last bed locks, the draw settles"),
  c("S05", 166, "pop-1.mp3", 0.18, 1, "VRF proof chip rises"),
  // S09 close
  c("S09", 43, "sound-9.mp3", 0.3, 26, "riser under Maya and the crowd"),
  c("S09", 146, "short-transition-2-sound.mp3", 0.15, 16, "soft air as the wordmark settles"),
  c("S09", 216, "pop-1.mp3", 0.2, 1, "URL pill lands on 'link'"),
];
