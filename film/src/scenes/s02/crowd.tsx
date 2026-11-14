import React from "react";
import { Easing, interpolate } from "remotion";
import { LetterFace, hash } from "../../components/LetterFace";
import { EASE, SAFE, W, H } from "../../tokens";

/* Port of apps/web/src/components/landing/crowd.tsx (desktop layout, 26 faces, seed "dibs-crowd"): same names, same
   rnd() sequence, same per-face timing variables. The CSS animations (motion.css cf-up / cf-bob / cf-sway) are
   driven by the frame. Film mapping: sizes x1.25 (Maya is 132 px here vs 104 px in the hero), the %-positions are
   mapped into the 96 px safe area, the rise delays are compressed by 0.8 so the field is up before the headline. */
const NAMES = [
  "Zara Okafor", "Mateo Ruiz", "Aiko Tanaka", "Noah Becker", "Lina Haddad", "Ravi Menon", "Elif Kaya", "Oscar Lind",
  "Nia Mensah", "Hugo Martin", "Mei Chen", "Theo Walsh", "Sofia Rossi", "Kwame Asante", "Ines Duarte", "Yuki Mori",
  "Arjun Rao", "Lea Vogel", "Omar Farouk", "Maren Holt", "Chidi Eze", "Ana Lima", "Felix Brandt", "Rosa Ortiz",
  "Sami Nouri", "Iris Park",
];

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Slot = {
  name: string; x: number; y: number; size: number; blur: number;
  from: number; tilt: number; dur: number; delay: number;
  bob: number; bobT: number; ph1: number; sway: number; turn: number; swayT: number; ph2: number;
};

/* Same call order as crowd.tsx layout(count, compact = false). */
function layout(count: number): Slot[] {
  const r = rnd(hash("dibs-crowd"));
  const out: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 3;
    const x = side === 0 ? 1 + r() * 19 : side === 1 ? 80 + r() * 18 : 6 + r() * 88;
    const y = side === 2 ? 82 + r() * 10 : 8 + r() * 68;
    const far = r() < 0.3;
    const size = far ? 28 + r() * 10 : 40 + r() * 24;
    const blur = far ? 1.5 + r() * 2 : 0;
    out.push({
      name: NAMES[i % NAMES.length], x, y, size: Math.round(size), blur,
      from: 55 + r() * 40, tilt: (r() - 0.5) * 24, dur: 0.9 + r() * 0.6, delay: 0.5 + r() * 1.2,
      bob: 2 + r() * 3, bobT: 2.2 + r() * 1.4, ph1: -r() * 3,
      sway: 2 + r() * 4, turn: 1 + r() * 3, swayT: 3.2 + r() * 2.2, ph2: -r() * 4,
    });
  }
  return out;
}

const K = 1.25;
const SLOTS = layout(26).map((s, i) => {
  const size = Math.round(s.size * K);
  const left = SAFE + (s.x / 100) * (W - 2 * SAFE - size);
  const top = SAFE + (s.y / 100) * (H - 2 * SAFE - size);
  const cx = left + size / 2 - W / 2; // stage coordinates (0,0 = frame centre)
  const cy = top + size / 2 - H / 2;
  const d = Math.hypot(cx, cy) || 1;
  return { ...s, size, cx, cy, ux: cx / d, uy: cy / d, outLag: ((hash(s.name) >> 3) % 9) };
});

const CSS_EIO = Easing.bezier(0.42, 0, 0.58, 1);
const OUT_EASE = Easing.bezier(0.5, 0, 0.8, 0.45);

/** CSS `infinite alternate` with ease-in-out and a negative delay: returns -1..1. */
function alt(tSec: number, period: number, phase: number): number {
  const tau = tSec - phase;
  const n = Math.floor(tau / period);
  let p = (tau - n * period) / period;
  if (((n % 2) + 2) % 2 === 1) p = 1 - p;
  return CSS_EIO(p) * 2 - 1;
}

/** The crowd in stage coordinates. `inAt` = first rise frame, `outAt` = drift-out start. */
export function Crowd({ f, inAt, outAt }: { f: number; inAt: number; outAt: number }) {
  const t = f / 30;
  return (
    <>
      {SLOTS.map((s, i) => {
        const r0 = inAt + (s.delay - 0.5) * 30 * 0.8;
        const rp = interpolate(f, [r0, r0 + s.dur * 30], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const op = interpolate(f, [outAt + s.outLag, outAt + s.outLag + 26], [0, 1], { easing: OUT_EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (rp <= 0 || op >= 1) return null;
        const from = s.from * 10.8 * (1 - rp);
        const tilt = s.tilt * (1 - rp);
        const dx = s.ux * 260 * op;
        const dy = s.uy * 260 * op;
        const bob = alt(t, s.bobT, s.ph1) * s.bob * K;
        const sw = alt(t, s.swayT, s.ph2);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.cx - s.size / 2,
              top: s.cy - s.size / 2,
              transform: `translate(${dx}px, ${dy + from}px) rotate(${tilt}deg)`,
              opacity: rp * (1 - op),
            }}
          >
            <div style={{ transform: `translateY(${bob}px)` }}>
              <div
                style={{
                  transform: `translateX(${sw * s.sway * K}px) rotate(${sw * s.turn}deg)`,
                  filter: s.blur || op > 0 ? `blur(${s.blur + op * 4}px)` : undefined,
                  opacity: s.blur ? 0.7 : 1,
                }}
              >
                <LetterFace name={s.name} size={s.size} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
