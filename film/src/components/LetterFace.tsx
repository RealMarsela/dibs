import React from "react";
import { useCurrentFrame } from "remotion";
import { BLINK_BEAT_FRAMES, PEOPLE, type PersonId } from "../tokens";
import { useSceneFrom } from "../scene";

/* Port of apps/web/src/components/motion/face.tsx. A bright disc whose initials are the eyes, a small mouth, cheeks,
   and a blink on the shared 2.2 s beat, driven by the frame instead of CSS animation. Same seed, same face. */
const PALETTE = ["#fb923c", "#facc15", "#4ade80", "#2dd4bf", "#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#fb7185", "#a3e635", "#fbbf24", "#22d3ee"];
const MOUTHS = ["M15 26 Q20 30.5 25 26", "M16 26.5 Q20 29 24 26.5", "M17 26 Q20 31 23 26", "M15.5 27 L24.5 27"];

export function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const faceColor = (seed: string) => PALETTE[hash(seed) % PALETTE.length];
export function initials(name: string): [string, string] {
  const a = name.normalize("NFD").replace(/[^A-Za-z ]/g, "").trim().toUpperCase();
  const parts = a.split(/\s+/);
  if (parts.length > 1) return [parts[0][0], parts[1][0]];
  return [a[0] ?? "?", a[1] ?? a[0] ?? "?"];
}

/** Eye scaleY at this frame: 1 open, 0.12 shut for ~2% of the cycle, every k beats with a phase (face.tsx keyframes). */
export function blinkScale(frame: number, seed: string): number {
  const h = hash(seed);
  const k = 2 + (h % 3);
  const phase = ((h >>> 3) % 4) * BLINK_BEAT_FRAMES; // unsigned, as the app (commit 9a20e33)
  const cycle = k * BLINK_BEAT_FRAMES;
  const p = (((frame - phase) % cycle) + cycle) % cycle / cycle; // 0..1
  if (p < 0.93) return 1;
  if (p < 0.95) return 1 - ((p - 0.93) / 0.02) * 0.88;
  return 0.12 + ((p - 0.95) / 0.05) * 0.88;
}

export function LetterFace({
  name,
  seed = name,
  size = 80,
  color,
  blink = true,
  ring,
  style,
  frameOffset = 0,
}: {
  name: string;
  seed?: string;
  size?: number;
  color?: string;
  blink?: boolean;
  /** ring colour (the app uses ring-void around faces in stacks) */
  ring?: string;
  style?: React.CSSProperties;
  frameOffset?: number;
}) {
  const frame = useCurrentFrame() + useSceneFrom() + frameOffset; // absolute film frame, so blinks match across seams
  const h = hash(seed);
  const [e1, e2] = initials(name);
  const small = size < 36;
  const sy = blink ? blinkScale(frame, seed) : 1;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color ?? faceColor(seed),
        position: "relative",
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 ${Math.max(2, size * 0.06)}px ${ring}` : undefined,
        ...style,
      }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} style={{ overflow: "visible", display: "block" }}>
        {!small && <circle cx="9" cy="24" r="3" fill="#fff" opacity="0.22" />}
        {!small && <circle cx="31" cy="24" r="3" fill="#fff" opacity="0.22" />}
        <g style={{ transform: `scaleY(${sy})`, transformOrigin: "20px 17.5px" }}>
          <text x="13.5" y="21" textAnchor="middle" fontSize={small ? 12.5 : 11} fontWeight={800} fill="#0e0e0e" fontFamily="Inter, system-ui">
            {e1}
          </text>
          <text x="26.5" y="21" textAnchor="middle" fontSize={small ? 12.5 : 11} fontWeight={800} fill="#0e0e0e" fontFamily="Inter, system-ui">
            {e2}
          </text>
        </g>
        <path d={MOUTHS[(h >>> 7) % MOUTHS.length]} stroke="#0e0e0e" strokeWidth={small ? 2.4 : 2} fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** A crew member's face with their app colour (bits.tsx FACE_COLORS). */
export function Face({ id, size = 80, ring, style, blink = true }: { id: PersonId; size?: number; ring?: string; style?: React.CSSProperties; blink?: boolean }) {
  const p = PEOPLE[id];
  return <LetterFace name={p.name} seed={id} color={p.color} size={size} ring={ring} style={style} blink={blink} />;
}

/** Bob and sway like the hero/crowd faces (motion.css cf-bob / cf-sway): returns a CSS transform. */
export function idle(frame: number, seed: string, amp = 1): string {
  const h = hash(seed);
  const bobT = (2.2 + (h % 140) / 100) * 30;
  const swayT = (3.2 + ((h >> 4) % 220) / 100) * 30;
  const ph1 = (h >> 8) % 90;
  const ph2 = (h >> 12) % 120;
  const bob = Math.sin(((frame + ph1) / bobT) * Math.PI) * (2 + (h % 3)) * amp;
  const sway = Math.sin(((frame + ph2) / swayT) * Math.PI) * (2 + ((h >> 2) % 4)) * amp;
  const turn = Math.sin(((frame + ph2) / swayT) * Math.PI) * (1 + ((h >> 5) % 3)) * amp;
  return `translate(${sway}px, ${bob}px) rotate(${turn}deg)`;
}
