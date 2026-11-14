import React from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import { World } from "../components/World";
import { Face } from "../components/LetterFace";
import { Mono, Pill, Wordmark } from "../components/Surfaces";
import { Sweep } from "../components/Sweep";
import { Centre, H8 } from "../handoffs";
import { useScene } from "../scene";
import { C, EASE, FONT, OE, SPRING } from "../tokens";
import { kf, prog } from "../lib/anim";
import { Crowd } from "./s09/crowd";

/* The live trip link on the lockup. Provisional: the coordinator may change it; keep it a single const. */
const LIVE_URL = "dibs-trips.pages.dev/t/lis0312";
const REPO = "github.com/RealMarsela/dibs";
const CREDIT = "Built at NEAR HACKATHON · runs on NEAR testnet · card rails: Lithic sandbox";

/* S09 Close. From H8 the line sweeps out upward; Maya rises from below the frame (the landing's hello-face rise) and
   the landing's crowd rises around her (bookend to S02). "Nobody fronts the money. Nobody chases anyone." sweeps in
   under her on the narration; then it sweeps out, Maya lifts, and the lockup forms: wordmark, the live trip link in a
   light pill on "link", the repo on "right below", the honest credit line on "NEAR testnet". Calm hold to the end. */
const H8_HOLD = 10; // H8 holds still this long so "35 attacks. Every one refused." reads across the seam
const MAYA_RISE = 13; // local frame Maya starts rising (the landing's 0.4 s); she reaches the H8 band only once it is gone
const MAYA_Y = 390; // centre while the headline plays
const LOCK = { maya: 318, word: 478, pill: 626, repo: 716, credit: 958 }; // lockup centres (film px, before the push)

/** Light pill with the live URL, at film scale 2 (29 px type). */
const UrlPill = () => (
  <Pill s={2} tone="light" style={{ boxShadow: "0 18px 50px -20px rgba(236,236,234,0.35)" }}>
    {LIVE_URL}
  </Pill>
);

/** One-element sweep (opacity, blur, small rise), the app's word sweep applied to a block. */
const sweepIn = (f: number, at: number, dy = 10, dur = 16.5) => {
  const p = interpolate(f, [at, at + dur], [0, 1], { easing: OE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity: p, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined, transform: `translateY(${(1 - p) * dy}px)` } as const;
};

export const S09: React.FC = () => {
  const { f, A, cue } = useScene();

  // H8 holds, then sweeps out upward (oe 12 f); the first frames are untouched.
  const h8 = interpolate(f, [H8_HOLD, H8_HOLD + 12], [0, 1], { easing: OE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Maya: rise from 90% of the frame below (1 s, EASE), bob in, then bob; lifts into the lockup.
  const lift = prog(f, cue("L09", "anyone") + 20, 30);
  const rise = prog(f, MAYA_RISE, 30);
  const mayaY = MAYA_Y + (1 - rise) * 0.9 * 1080 + (LOCK.maya - MAYA_Y) * lift;
  const mayaSize = 132 - 12 * lift;
  const tb = f - (MAYA_RISE + 33);
  const bob = tb < 0 ? 0 : tb < 28 ? -4 * EASE(tb / 28) : -4 + 8 * tri((tb - 28) / 57);

  // Headline timing (local frames from the narration).
  const out = cue("L09", "anyone") + 24;
  const wordAt = cue("L09", "lisbon");
  const pillAt = cue("L09", "link") - 9; // spring lands on "link"
  const repoAt = cue("L09", "right");
  const creditAt = cue("L09", "near");

  // Very slow push on the main group; the crowd (further back) moves less.
  const push = 1 + 0.04 * (f / 338);
  const pill = spring({ frame: f - pillAt, fps: 30, config: SPRING });
  const pillO = interpolate(f, [pillAt, pillAt + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <World>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.015 * (f / 338)})` }}>
        <Crowd f={f} A={A} t0={MAYA_RISE} exitAt={out + 4} spreadAt={out} />
      </AbsoluteFill>

      {h8 < 1 && (
        <AbsoluteFill style={{ opacity: 1 - h8, filter: h8 > 0 ? `blur(${h8 * 10}px)` : undefined, transform: h8 > 0 ? `translateY(${-h8 * 24}px)` : undefined }}>
          <H8 />
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "960px 500px" }}>
        {f >= MAYA_RISE && (
          <Centre cx={960} cy={mayaY}>
            <div style={{ transform: `translateY(${bob}px)` }}>
              <Face id="maya" size={mayaSize} ring={C.void} style={{ boxShadow: `0 0 0 6px ${C.void}, 0 24px 64px -14px rgba(251,146,60,0.55)` }} />
            </div>
          </Centre>
        )}

        {f < out + 14 && (
          <Centre cx={960} cy={600}>
            <Sweep
              size={64}
              out={out}
              style={{ whiteSpace: "nowrap" }}
              lines={[
                { text: "Nobody fronts the money.", at: [cue("L09", "fronts") - 1, cue("L09", "fronts"), cue("L09", "the"), cue("L09", "money")] },
                { text: "Nobody chases anyone.", tone: "fg2", at: [cue("L09", "nobody", 1), cue("L09", "chase"), cue("L09", "anyone")] },
              ]}
            />
          </Centre>
        )}

        <Centre cx={960} cy={LOCK.word}>
          <div style={{ ...sweepIn(f, wordAt, 16, 20), lineHeight: 1 }}>
            <Wordmark size={140} />
          </div>
        </Centre>

        <Centre cx={960} cy={LOCK.pill}>
          <div style={{ opacity: pillO, transform: `translateY(${(1 - pill) * 22}px) scale(${0.9 + 0.1 * pill})` }}>
            <UrlPill />
          </div>
        </Centre>

        <Centre cx={960} cy={LOCK.repo}>
          <div style={sweepIn(f, repoAt)}>
            <Mono size={26} color={C.fg2} style={{ whiteSpace: "nowrap" }}>{REPO}</Mono>
          </div>
        </Centre>
      </AbsoluteFill>

      <Centre cx={960} cy={LOCK.credit}>
        <div style={{ ...sweepIn(f, creditAt, 8), fontFamily: FONT, fontSize: 22, fontWeight: 500, color: C.fg3, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
          {CREDIT}
        </div>
      </Centre>
    </World>
  );
};

/** 0 → 1 → 0 ease-in-out triangle with period 2 (CSS alternate ease-in-out). */
function tri(x: number): number {
  const c = ((x % 2) + 2) % 2;
  const p = c < 1 ? c : 2 - c;
  return kf(p, [0, 1], [0, 1], (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));
}
