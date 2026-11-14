import { cn } from "@/lib/utils";

/* Letter face, in the spirit of Hoy's drawn faces: a bright disc whose initials are the eyes, a small mouth,
   and a blink on a shared 2.2 s beat. Same seed, same face, every time. */
const PALETTE = ["#fb923c", "#facc15", "#4ade80", "#2dd4bf", "#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#fb7185", "#a3e635", "#fbbf24", "#22d3ee"];
const MOUTHS = ["M15 26 Q20 30.5 25 26", "M16 26.5 Q20 29 24 26.5", "M17 26 Q20 31 23 26", "M15.5 27 L24.5 27"];

export function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function faceColor(seed: string): string {
  return PALETTE[hash(seed) % PALETTE.length];
}

export function initials(name: string): [string, string] {
  const a = name.normalize("NFD").replace(/[^A-Za-z ]/g, "").trim().toUpperCase();
  const parts = a.split(/\s+/);
  if (parts.length > 1) return [parts[0][0], parts[1][0]];
  return [a[0] ?? "?", a[1] ?? a[0] ?? "?"];
}

export function LetterFace({
  name,
  seed = name,
  size = 40,
  color,
  blink = true,
  className,
  style,
}: {
  name: string;
  seed?: string;
  size?: number;
  color?: string;
  blink?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const h = hash(seed);
  const [e1, e2] = initials(name);
  const small = size < 36;
  const k = 2 + (h % 3); // blinks every 2, 3 or 4 beats
  const phase = (h >>> 3) % 4; // on which beat
  return (
    <span
      role="img"
      aria-label={name}
      className={cn("relative inline-flex shrink-0 select-none rounded-full", className)}
      style={{ width: size, height: size, background: color ?? faceColor(seed), ...style }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="overflow-visible">
        {!small && <circle cx="9" cy="24" r="3" fill="#fff" opacity="0.22" />}
        {!small && <circle cx="31" cy="24" r="3" fill="#fff" opacity="0.22" />}
        <g
          className={blink ? "face-eyes" : undefined}
          style={{ ["--k" as string]: k, ["--ph" as string]: `${phase * 2.2}s`, transformOrigin: "20px 17.5px" }}
        >
          <text x="13.5" y="21" textAnchor="middle" fontSize={small ? 12.5 : 11} fontWeight="800" fill="#0e0e0e" fontFamily="Inter Variable, system-ui">
            {e1}
          </text>
          <text x="26.5" y="21" textAnchor="middle" fontSize={small ? 12.5 : 11} fontWeight="800" fill="#0e0e0e" fontFamily="Inter Variable, system-ui">
            {e2}
          </text>
        </g>
        <path d={MOUTHS[(h >>> 7) % MOUTHS.length]} stroke="#0e0e0e" strokeWidth={small ? 2.4 : 2} fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
