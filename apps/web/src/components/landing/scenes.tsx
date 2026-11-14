import { useEffect, useState, type ReactNode } from "react";
import { Ban, Check, FileText, Loader2, ShieldCheck } from "lucide-react";
import { LetterFace } from "@/components/motion/face";
import { cn } from "@/lib/utils";

/* The card's contents, one per beat of the film. Each plays its own short sequence when it mounts
   (cause, then effect), and holds the end state while the visitor reads. */

function useSteps(n: number, gap = 650, start = 350): number {
  const [k, setK] = useState(0);
  useEffect(() => {
    const ids = Array.from({ length: n }, (_, i) => setTimeout(() => setK(i + 1), start + i * gap));
    return () => ids.forEach(clearTimeout);
  }, [n, gap, start]);
  return k;
}

function Head({ face, name, color, sub }: { face: string; name: string; color: string; sub: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <LetterFace name={name} seed={face} color={color} size={34} />
      <div className="text-left">
        <p className="text-[14.5px] font-semibold leading-tight">{name}</p>
        <p className="text-[12.5px] text-fg-2">{sub}</p>
      </div>
    </div>
  );
}

function Row({ on, children, tone }: { on: boolean; children: ReactNode; tone?: "paid" | "refused" | "resale" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-left text-[13.5px] transition-[opacity,translate,filter] duration-500 ease-[var(--ease)]",
        on ? "translate-y-0 opacity-100 blur-0" : "translate-y-1.5 opacity-0 blur-[3px]",
        tone === "paid" && "text-paid",
        tone === "refused" && "text-refused",
        tone === "resale" && "text-resale",
      )}
    >
      {children}
    </div>
  );
}

export function PayScene() {
  const k = useSteps(4);
  const chains = ["USDC on Base", "USDC on Solana", "USDC on Arbitrum", "USDC on NEAR"];
  return (
    <div>
      <Head face="leo" name="Leo" color="#4ade80" sub="Bed 03 · $40 due" />
      <div className="grid grid-cols-2 gap-2">
        {chains.map((c, i) => (
          <div
            key={c}
            className={cn(
              "rounded-2xl px-3 py-2.5 text-left text-[12.5px] transition-colors duration-300",
              i === 0 && k >= 1 ? "bg-fg text-void" : "bg-white/[0.04] text-fg-2",
            )}
          >
            {c}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Row on={k >= 2}>
          {k >= 3 ? <Check className="size-4 text-paid" /> : <Loader2 className="size-4 animate-spin" />} Swapped by NEAR Intents
        </Row>
        <Row on={k >= 3} tone="paid">
          <Check className="size-4" /> Landed in bed 03’s own account
        </Row>
        <Row on={k >= 4} tone="paid">
          <Check className="size-4" /> 8 of 8 paid. Nobody fronted a cent.
        </Row>
      </div>
    </div>
  );
}

export function SellScene() {
  const k = useSteps(4, 700);
  return (
    <div>
      <Head face="ana" name="Ana" color="#f472b6" sub="Bed 04 · can’t make it" />
      <div className="relative">
        <Row on={k >= 1}>Get my $40 back</Row>
        <span
          className={cn(
            "absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border-[1.5px] border-refused px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-refused transition-[opacity,scale] duration-300",
            k >= 2 ? "rotate-[-6deg] scale-100 opacity-100" : "scale-[1.8] opacity-0",
          )}
          style={{ transitionTimingFunction: "var(--spring)" }}
        >
          <Ban className="size-3" /> Refused
        </span>
      </div>
      <div className="mt-2 flex items-stretch overflow-hidden rounded-2xl bg-white/[0.04]">
        <div className="flex-1 px-3.5 py-3 text-left">
          <p className="text-[11.5px] text-fg-2">Bed 04 · Lisbon</p>
          <p className="text-[15px] font-semibold">Sell at the price you paid</p>
        </div>
        <div className="perf w-2" />
        <div
          className="flex w-20 flex-col items-center justify-center bg-white/[0.05] transition-[translate,rotate,opacity] duration-700 ease-[var(--ease)]"
          style={k >= 3 ? { translate: "60px 30px", rotate: "18deg", opacity: 0 } : undefined}
        >
          <span className="text-[10.5px] text-fg-2">face value</span>
          <span className="text-[17px] font-semibold">$40</span>
        </div>
      </div>
      <div className="mt-2">
        <Row on={k >= 4} tone="resale">
          <LetterFace name="Priya" seed="priya" color="#c084fc" size={22} blink={false} /> Priya took bed 04. $40 sent to Ana on Solana.
        </Row>
      </div>
    </div>
  );
}

export function ProofScene() {
  const k = useSteps(5, 600);
  const checks = [
    ["DKIM signature is booking.com’s own", "Intel TDX enclave · OutLayer"],
    ["Read privately", "GPU enclave · NEAR AI Cloud"],
    ["Verdict signed, checked on-chain", "ed25519 · the trip contract"],
  ];
  return (
    <div>
      <Head face="maya" name="Maya" color="#fb923c" sub="Booker · proof of booking" />
      <Row on={k >= 1}>
        <FileText className="size-4 text-fg-2" /> “Your booking is confirmed” · booking.com
      </Row>
      <div className="mt-2 flex flex-col gap-2">
        {checks.map(([a, b], i) => (
          <Row key={a} on={k >= i + 2}>
            <ShieldCheck className="size-4 shrink-0 text-paid" />
            <span className="flex-1">{a}</span>
            <span className="hidden text-[11px] text-fg-3 sm:inline">{b}</span>
          </Row>
        ))}
        <Row on={k >= 5} tone="paid">
          <Check className="size-4" /> 12–15 Mar · 8 guests · $318 of $320. Released to Maya.
        </Row>
      </div>
    </div>
  );
}

const BEDS = ["Double, window", "Double, courtyard", "Bunk A, top", "Bunk A, bottom", "Bunk B, top", "Bunk B, bottom", "Loft single", "Sofa bed"];
const ORDER = [2, 0, 5, 7, 1, 4, 6, 3];
const NAMES = [["maya", "Maya", "#fb923c"], ["sam", "Sam", "#38bdf8"], ["leo", "Leo", "#4ade80"], ["priya", "Priya", "#c084fc"], ["tomas", "Tomás", "#facc15"], ["jun", "Jun", "#a78bfa"], ["chloe", "Chloé", "#2dd4bf"], ["kofi", "Kofi", "#fb7185"]];

export function DrawScene() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setT(i);
      if (i > 12) clearInterval(id);
    }, 85);
    return () => clearInterval(id);
  }, []);
  const done = t > 12;
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {NAMES.map(([id, name, color], i) => (
        <div key={id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-left">
          <LetterFace name={name} seed={id} color={color} size={22} blink={false} />
          <span className="w-12 shrink-0 text-[12.5px] font-semibold">{name}</span>
          <span className={cn("truncate text-[12px] transition-[color,filter] duration-300", done ? "text-fg" : "text-fg-3 blur-[0.5px]")}>
            {BEDS[done ? ORDER[i] : (i + t) % 8]}
          </span>
        </div>
      ))}
    </div>
  );
}
