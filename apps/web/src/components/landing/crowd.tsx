import { useMemo, useState } from "react";
import { hash, LetterFace } from "@/components/motion/face";

/* The crowd around the hello: friends who have called dibs on a bed somewhere. Laid out once per seed so it is
   the same on every load; each face rises in, then bobs and sways on its own clock. Far ones are smaller and
   softly out of focus, so the field has depth. Decoration only: aria-hidden. */
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

interface Slot {
  name: string;
  x: number;
  y: number;
  size: number;
  blur: number;
  vars: Record<string, string>;
}

function layout(count: number, compact: boolean): Slot[] {
  const r = rnd(hash("dibs-crowd"));
  const out: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 3; // 0 left, 1 right, 2 bottom row (phones: top band, bottom band)
    const x = compact ? 2 + r() * 90 : side === 0 ? 1 + r() * 19 : side === 1 ? 80 + r() * 18 : 6 + r() * 88;
    const y = compact ? (side === 2 ? 4 + r() * 9 : 84 + r() * 10) : side === 2 ? 82 + r() * 10 : 8 + r() * 68;
    const far = r() < 0.3;
    const size = compact ? (far ? 22 + r() * 6 : 30 + r() * 12) : far ? 28 + r() * 10 : 40 + r() * 24;
    out.push({
      name: NAMES[i % NAMES.length],
      x,
      y,
      size: Math.round(size),
      blur: far ? 1.5 + r() * 2 : 0,
      vars: {
        "--from": `${55 + r() * 40}vh`,
        "--tilt": `${(r() - 0.5) * 24}deg`,
        "--dur": `${0.9 + r() * 0.6}s`,
        "--delay": `${0.5 + r() * 1.2}s`,
        "--bob": `${2 + r() * 3}px`,
        "--bobT": `${2.2 + r() * 1.4}s`,
        "--ph1": `${-r() * 3}s`,
        "--sway": `${2 + r() * 4}px`,
        "--turn": `${1 + r() * 3}deg`,
        "--swayT": `${3.2 + r() * 2.2}s`,
        "--ph2": `${-r() * 4}s`,
      },
    });
  }
  return out;
}

export function Crowd({ count = 26 }: { count?: number }) {
  const [compact] = useState(() => typeof window !== "undefined" && window.innerWidth < 900);
  const slots = useMemo(() => layout(compact ? 15 : count, compact), [count, compact]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {slots.map((s, i) => (
        <div
          key={i}
          className="cf absolute"
          style={{ left: `${s.x}%`, top: `${s.y}%`, ...(s.vars as React.CSSProperties) }}
        >
          <div className="cf-b">
            <div className="cf-s" style={{ filter: s.blur ? `blur(${s.blur}px)` : undefined, opacity: s.blur ? 0.7 : 1 }}>
              <LetterFace name={s.name} size={s.size} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
