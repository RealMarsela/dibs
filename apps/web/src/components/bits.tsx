import { ChainMark } from "@/components/chain-mark";
import { Link } from "react-router";
import { CHAINS, PEOPLE } from "@/data/sample";
import type { ChainId, SpotStatus } from "@/data/types";
import { Badge } from "@/components/reui/badge";
import { cn } from "@/lib/utils";
import { LetterFace } from "@/components/motion/face";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("focus-ring rounded-md text-[22px] font-bold tracking-[-0.04em] text-fg", className)} aria-label="Dibs home">
      dibs
    </Link>
  );
}

/* Hoy-style face chip: a bright disc whose initials are the eyes, plus a small smile. */
const FACE_COLORS: Record<string, string> = {
  maya: "#fb923c",
  sam: "#38bdf8",
  leo: "#4ade80",
  ana: "#f472b6",
  tomas: "#facc15",
  jun: "#a78bfa",
  chloe: "#2dd4bf",
  kofi: "#fb7185",
  priya: "#c084fc",
};

export function Face({ id, size = 32, ring = false, className }: { id: string; size?: number; ring?: boolean; className?: string }) {
  const name = PEOPLE[id]?.name ?? "?";
  const short = id.split(".")[0];
  return <LetterFace name={name} seed={FACE_COLORS[short] ? short : id} color={FACE_COLORS[id] ?? FACE_COLORS[short]} size={size} className={cn(ring && "ring-2 ring-void", className)} />;
}

export function FaceStack({ ids, size = 26, max = 8 }: { ids: string[]; size?: number; max?: number }) {
  const shown = ids.slice(0, max);
  return (
    <span className="inline-flex items-center">
      {shown.map((id, i) => (
        <Face key={id} id={id} size={size} ring className={i ? "-ml-2" : ""} />
      ))}
      {ids.length > max && <span className="ml-1.5 text-[12px] text-fg-2">+{ids.length - max}</span>}
    </span>
  );
}

export function ChainTag({ id, className }: { id: ChainId; className?: string }) {
  const c = CHAINS[id];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] text-fg-2", className)}>
      <ChainMark id={id} size={16} badge={false} />
      {c.token} on {c.name}
    </span>
  );
}

const STATUS: Record<SpotStatus, { label: string; variant: "success-light" | "warning-light" | "info-light" | "invert-light" }> = {
  paid: { label: "Paid", variant: "success-light" },
  held: { label: "Due", variant: "warning-light" },
  listed: { label: "For resale", variant: "info-light" },
  open: { label: "Open", variant: "invert-light" },
};

export function StatusBadge({ status, className }: { status: SpotStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge variant={s.variant} radius="full" size="lg" className={cn("px-2.5 font-semibold", className)}>
      {s.label}
    </Badge>
  );
}

export function NearMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-2", className)}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
        <path d="M4 4h3.2l9.6 11.2V4H20v16h-3.2L7.2 8.8V20H4z" fill="currentColor" />
      </svg>
      Built on NEAR
    </span>
  );
}
