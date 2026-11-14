import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { hash, LetterFace } from "../../components/LetterFace";
import { EASE, IN_OUT_STRONG, OE } from "../../tokens";

/* Port of apps/web/src/components/landing/crowd.tsx (desktop layout): the same 26 names, the same seed "dibs-crowd",
   the same draw order, so every face sits where it sits on the landing. Percent positions are mapped into the film's
   safe area (96 px margin) and sizes are shown at 1.2x (Maya is 132 px here vs 104 px on the landing).
   CSS keyframes cf-up / cf-bob / cf-sway are driven by the frame instead of the clock. */
const NAMES = [
  "Zara Okafor", "Mateo Ruiz", "Aiko Tanaka", "Noah Becker", "Lina Haddad", "Ravi Menon", "Elif Kaya", "Oscar Lind",
  "Nia Mensah", "Hugo Martin", "Mei Chen", "Theo Walsh", "Sofia Rossi", "Kwame Asante", "Ines Duarte", "Yuki Mori",
  "Arjun Rao", "Lea Vogel", "Omar Farouk", "Maren Holt", "Chidi Eze", "Ana Lima", "Felix Brandt", "Rosa Ortiz",
  "Sami Nouri", "Iris Park",
];
const K = 1.2; // film scale for face size, bob and sway
const FPS = 30;

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type Slot = {
  name: string; side: number; x: number; y: number; size: number; blur: number;
  from: number; tilt: number; dur: number; delay: number; // px, deg, s, s
  bob: number; bobT: number; ph1: number; sway: number; turn: number; swayT: number; ph2: number;
};

/* Same calls in the same order as layout(26, false) in crowd.tsx. */
export const SLOTS: Slot[] = (() => {
  const r = rnd(hash("dibs-crowd"));
  const out: Slot[] = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 3;
    const x = side === 0 ? 1 + r() * 19 : side === 1 ? 80 + r() * 18 : 6 + r() * 88;
    const y = side === 2 ? 82 + r() * 10 : 8 + r() * 68;
    const far = r() < 0.3;
    const size = Math.round((far ? 28 + r() * 10 : 40 + r() * 24) * K);
    const blur = far ? (1.5 + r() * 2) * K : 0;
    out.push({
      name: NAMES[i % NAMES.length], side, size, blur,
      x: 120 + (x / 100) * (1920 - 240 - 77),
      y: 110 + (y / 100) * (1080 - 220 - 77),
      from: ((55 + r() * 40) / 100) * 1080,
      tilt: (r() - 0.5) * 24,
      dur: 0.9 + r() * 0.6,
      delay: 0.5 + r() * 1.2,
      bob: (2 + r() * 3) * K, bobT: 2.2 + r() * 1.4, ph1: r() * 3,
      sway: (2 + r() * 4) * K, turn: 1 + r() * 3, swayT: 3.2 + r() * 2.2, ph2: r() * 4,
    });
  }
  return relax(out);
})();

/* Film-only nudge: at 1.2x some seeded faces sit on top of each other (the poster frame shows it). Push overlapping
   pairs apart a little, keeping each face in its band (left / right edge, or the bottom row). Deterministic. */
function relax(slots: Slot[]): Slot[] {
  const s = slots.map((o) => ({ ...o }));
  const y0 = s.map((o) => o.y);
  const clamp = (o: Slot, i: number) => {
    const [x0, x1] = o.side === 0 ? [120, 470 - o.size] : o.side === 1 ? [1417, 1810 - o.size] : [130, 1790 - o.size];
    const [ya, yb] = o.side === 2 ? [y0[i] - 6, y0[i] + 30] : [130, 760 - o.size];
    o.x = Math.min(x1, Math.max(x0, o.x));
    o.y = Math.min(yb, Math.max(ya, o.y));
  };
  for (let it = 0; it < 40; it++) {
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        const a = s[i], b = s[j];
        const dx = b.x + b.size / 2 - (a.x + a.size / 2);
        const dy = b.y + b.size / 2 - (a.y + a.size / 2);
        const d = Math.hypot(dx, dy) || 0.001;
        const min = (a.size + b.size) / 2 + 12;
        if (d >= min) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
        clamp(a, i); clamp(b, j);
      }
    }
  }
  return s;
}

const IO = Easing.bezier(0.42, 0, 0.58, 1); // CSS ease-in-out
/** CSS `infinite alternate ease-in-out` from -1 to 1 with half period `half` s, started `ph` s in the past. */
function alt(tSec: number, half: number, ph: number): number {
  const c = ((tSec + ph) / half) % 2;
  return -1 + 2 * IO(c < 1 ? c : 2 - c);
}

/** The bottom-row faces (side 2) sink away, nearest the centre first, so the credit line has a clear floor. */
const BOTTOM_ORDER = SLOTS.map((s, i) => ({ i, d: Math.abs(s.x + s.size / 2 - 960) }))
  .filter((o) => SLOTS[o.i].side === 2)
  .sort((a, b) => a.d - b.d)
  .map((o) => o.i);

export function Crowd({ f, A, t0, exitAt, spreadAt }: {
  f: number; // local frame
  A: number; // absolute film frame (idle clocks)
  t0: number; // local frame that matches the landing's 0.4 s (Maya's rise start)
  exitAt: number; // local frame the bottom row starts to sink
  spreadAt: number; // local frame the side faces ease outward to give the lockup room
}) {
  const tSec = A / FPS;
  const spread = interpolate(f, [spreadAt, spreadAt + 40], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {SLOTS.map((s, i) => {
        const start = t0 + (s.delay - 0.4) * FPS;
        const p = interpolate(f, [start, start + s.dur * FPS], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (p <= 0) return null;
        const k = BOTTOM_ORDER.indexOf(i);
        const e0 = exitAt + Math.max(0, k) * 2.5;
        const ex = k < 0 ? 0 : interpolate(f, [e0, e0 + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (ex >= 1) return null;
        const exY = IN_OUT_STRONG(ex) * 120;
        const exO = 1 - OE(ex);
        const dx = s.side === 2 ? 0 : (s.side === 0 ? -1 : 1) * 22 * spread;
        const bob = alt(tSec, s.bobT, s.ph1) * s.bob;
        const sw = alt(tSec, s.swayT, s.ph2);
        return (
          <div
            key={s.name}
            style={{
              position: "absolute",
              left: s.x + dx,
              top: s.y,
              opacity: p * exO,
              transform: `translateY(${(1 - p) * s.from + exY}px) rotate(${(1 - p) * s.tilt}deg)`,
              filter: ex > 0 ? `blur(${ex * 6}px)` : undefined,
            }}
          >
            <div style={{ transform: `translate(${sw * s.sway}px, ${bob}px) rotate(${sw * s.turn}deg)` }}>
              <div style={{ filter: s.blur ? `blur(${s.blur}px)` : undefined, opacity: s.blur ? 0.7 : 1 }}>
                <LetterFace name={s.name} size={s.size} />
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
