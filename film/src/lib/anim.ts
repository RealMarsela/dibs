import { interpolate, type EasingFunction } from "remotion";
import { EASE } from "../tokens";
import { WORDS, LINES } from "../timeline.generated";

/** Keyframes: frames ascending, values same length. Clamped both sides. One easing for every segment unless given per segment. */
export function kf(frame: number, frames: number[], values: number[], ease: EasingFunction | EasingFunction[] = EASE): number {
  if (frame <= frames[0]) return values[0];
  for (let i = 0; i < frames.length - 1; i++) {
    if (frame <= frames[i + 1]) {
      const e = Array.isArray(ease) ? ease[i] ?? ease[0] : ease;
      return interpolate(frame, [frames[i], frames[i + 1]], [values[i], values[i + 1]], { easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }
  }
  return values[values.length - 1];
}

/** 0 → 1 over [f0, f0 + dur] with the arrival easing. */
export function prog(frame: number, f0: number, dur: number, ease: EasingFunction = EASE): number {
  return interpolate(frame, [f0, f0 + dur], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Same normalisation as scripts/build-timeline.py: keep letters, digits, apostrophes, hyphens and inner dots ("booking.com"). */
export const key = (w: string) => w.toLowerCase().replace(/[^\w'’.-]/g, "").replace(/\.+$/, "");

/** Absolute frame where narration word `word` (case-insensitive, punctuation ignored) starts in `line`. nth = 0-based occurrence. */
export function cue(line: string, word: string, nth = 0): number {
  const k = key(word);
  const hits = WORDS.filter((w) => w.line === line && w.k === k);
  if (!hits[nth]) throw new Error(`cue: no "${word}" #${nth} in ${line}`);
  return hits[nth].f0;
}
/** End frame of that word. */
export function cueEnd(line: string, word: string, nth = 0): number {
  const k = key(word);
  const hits = WORDS.filter((w) => w.line === line && w.k === k);
  if (!hits[nth]) throw new Error(`cueEnd: no "${word}" #${nth} in ${line}`);
  return hits[nth].f1;
}
export function line(id: string) {
  const l = LINES.find((x) => x.id === id);
  if (!l) throw new Error(`line ${id}`);
  return l;
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function rand(seed: number): number {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
}
