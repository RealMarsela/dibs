import { Link } from "react-router";
import { CHAINS, PEOPLE } from "@/data/sample";
import type { ChainId } from "@/data/types";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("focus-ring inline-flex items-center gap-2 rounded-md", className)} aria-label="Dibs home">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
        <path
          d="M3 1h24a2 2 0 0 1 2 2v4a4 4 0 0 0 0 8v4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-4a4 4 0 0 0 0-8V3a2 2 0 0 1 2-2Z"
          fill="var(--color-ink)"
        />
        <path d="M19 4v14" stroke="var(--color-paper)" strokeWidth="1.4" strokeDasharray="2 2.2" />
        <circle cx="10" cy="11" r="3.2" fill="var(--color-sun)" />
      </svg>
      <span className="text-[21px] font-extrabold tracking-[-0.03em]">dibs</span>
    </Link>
  );
}

export function Avatar({ id, size = 28, ring = false }: { id: string; size?: number; ring?: boolean }) {
  const p = PEOPLE[id];
  const name = p?.name ?? "?";
  const hue = p?.hue ?? 30;
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink", ring && "ring-2 ring-card")}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `oklch(0.86 0.09 ${hue})`,
        boxShadow: `inset 0 0 0 1px oklch(0.7 0.1 ${hue} / 0.5)`,
      }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

const CHAIN_DOT: Record<ChainId, string> = {
  near: "#1e1b16",
  base: "#2b5aa6",
  solana: "#7c4ad9",
  arbitrum: "#2d8ad6",
  ethereum: "#6b6f86",
};

export function ChainTag({ id, className }: { id: ChainId; className?: string }) {
  const c = CHAINS[id];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-soft", className)}>
      <span className="size-2 rounded-full" style={{ background: CHAIN_DOT[id] }} />
      {c.token} on {c.name}
    </span>
  );
}

export function Stamp({ tone, children, className }: { tone: "paid" | "stamp" | "sea" | "ink"; children: React.ReactNode; className?: string }) {
  const tones = {
    paid: "border-paid text-paid bg-paid-soft",
    stamp: "border-stamp text-stamp bg-stamp-soft",
    sea: "border-sea text-sea bg-sea-soft",
    ink: "border-ink-soft text-ink-soft",
  } as const;
  return <span className={cn("stamp", tones[tone], className)}>{children}</span>;
}

export function NearMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint", className)}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
        <path d="M4 4h3.2l9.6 11.2V4H20v16h-3.2L7.2 8.8V20H4z" fill="currentColor" />
      </svg>
      Built on NEAR
    </span>
  );
}
