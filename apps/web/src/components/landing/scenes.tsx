import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Ban, Check, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/motion/avatar";
import { cn } from "@/lib/utils";

/* One card per beat, Hoy-style: one vivid element on a colour bloom, then one row with who it is and one small
   action. Each plays a short cause-then-effect sequence when it mounts and holds the end state while you read. */

function useSteps(n: number, gap = 650, start = 350): number {
  const [k, setK] = useState(0);
  useEffect(() => {
    const ids = Array.from({ length: n }, (_, i) => setTimeout(() => setK(i + 1), start + i * gap));
    return () => ids.forEach(clearTimeout);
  }, [n, gap, start]);
  return k;
}

function Bloom({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <div
      aria-hidden
      className="bloom absolute inset-[-25%] blur-2xl"
      style={{ background: `radial-gradient(38% 48% at 28% 34%, ${a}, transparent 70%), radial-gradient(44% 54% at 72% 62%, ${b}, transparent 72%), radial-gradient(34% 42% at 58% 22%, ${c}, transparent 70%), #1c1a19` }}
    />
  );
}

function Card({ bloom, media, face, name, line, action }: { bloom: [string, string, string]; media: ReactNode; face: string; name: string; line: string; action: ReactNode }) {
  return (
    <div>
      <div className="relative aspect-[16/11] overflow-hidden rounded-[26px]">
        <Bloom a={bloom[0]} b={bloom[1]} c={bloom[2]} />
        <div className="absolute inset-0 flex items-center justify-center p-5">{media}</div>
      </div>
      <div className="mt-2.5 flex items-center gap-3 rounded-[22px] bg-white/[0.05] py-2 pl-2.5 pr-2">
        <Avatar name={name} seed={face} size={34} />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[14.5px] font-semibold leading-tight">{name}</p>
          <p className="truncate text-[12.5px] text-fg-2">{line}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function Action({ done, idle, finished }: { done: boolean; idle: string; finished: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-[background-color,color] duration-500 ease-[var(--ease)]",
        done ? "bg-paid/15 text-paid" : "bg-fg text-void",
      )}
    >
      {done ? <Check className="size-3.5" /> : null}
      {done ? finished : idle}
    </span>
  );
}

const CREW_IDS = [["maya", "Maya"], ["sam", "Sam"], ["leo", "Leo"], ["ana", "Ana"], ["tomas", "Tomás"], ["jun", "Jun"], ["chloe", "Chloé"], ["kofi", "Kofi"]];

export function CrewScene() {
  const k = useSteps(2, 900, 500);
  return (
    <Card
      bloom={["#fb923c", "#f43f5e", "#facc15"]}
      face="maya"
      name="Maya"
      line="Booker · 8 beds · Lisbon · 12–15 Mar"
      action={<Action done={k >= 2} idle="Copy invite" finished="Link sent" />}
      media={
        <div className="grid grid-cols-4 gap-3">
          {CREW_IDS.map(([id, name], i) => (
            <span
              key={id}
              className="transition-[opacity,translate] duration-500 ease-[var(--ease)]"
              style={{ transitionDelay: `${i * 70}ms`, opacity: k >= 1 ? 1 : 0, translate: k >= 1 ? "0 0" : "0 10px" }}
            >
              <Avatar name={name} seed={id} size={52} className="shadow-[0_0_0_3px_rgb(0_0_0/0.25)]" />
            </span>
          ))}
        </div>
      }
    />
  );
}

export function PayScene() {
  const k = useSteps(3, 750);
  return (
    <Card
      bloom={["#3b82f6", "#22d3ee", "#a78bfa"]}
      face="leo"
      name="Leo"
      line={k >= 3 ? "Bed 03 · paid from Base" : "Bed 03 · $40 due"}
      action={<Action done={k >= 3} idle="Pay $40" finished="Paid" />}
      media={
        <div className="flex flex-col items-center gap-4 text-white">
          <p className="font-mono text-[clamp(44px,8vw,60px)] font-semibold tracking-[-0.04em] drop-shadow-[0_6px_24px_rgb(0_0_0/0.35)]">$40</p>
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-md">USDC on Base</span>
            <ArrowRight className={cn("size-4 transition-[opacity,translate] duration-500", k >= 1 ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")} />
            <span className={cn("rounded-full px-3 py-1.5 backdrop-blur-md transition-colors duration-500", k >= 2 ? "bg-white text-void" : "bg-black/35 text-white/60")}>Bed 03’s own account</span>
          </div>
          <p className={cn("text-[12px] font-medium text-white/80 transition-opacity duration-500", k >= 2 ? "opacity-100" : "opacity-0")}>Swapped by NEAR Intents</p>
        </div>
      }
    />
  );
}

export function SellScene() {
  const k = useSteps(4, 700);
  return (
    <Card
      bloom={["#f43f5e", "#fb7185", "#f59e0b"]}
      face="ana"
      name="Ana"
      line={k >= 4 ? "Priya took bed 04 · $40 sent to Ana" : "Bed 04 · can’t make it"}
      action={<Action done={k >= 4} idle="Sell at $40" finished="Sold" />}
      media={
        <div className="relative w-full max-w-[300px]">
          <div className="flex items-stretch overflow-hidden rounded-2xl bg-[#f6f1ea] text-[#1b1a19] shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]">
            <div className="flex-1 px-4 py-4 text-left">
              <p className="text-[11.5px] text-black/55">Bed 04 · Lisbon · 12–15 Mar</p>
              <p className="mt-0.5 text-[17px] font-semibold leading-tight">Sell at the price you paid</p>
            </div>
            <div className="perf w-2" />
            <div
              className="flex w-20 flex-col items-center justify-center bg-black/[0.06] transition-[translate,rotate,opacity] duration-700 ease-[var(--ease)]"
              style={k >= 3 ? { translate: "60px 34px", rotate: "18deg", opacity: 0 } : undefined}
            >
              <span className="text-[10.5px] text-black/55">face value</span>
              <span className="text-[19px] font-semibold">$40</span>
            </div>
          </div>
          <span
            className={cn(
              "absolute -top-4 left-3 inline-flex items-center gap-1 rounded-md border-2 border-refused bg-void/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-refused transition-[opacity,scale] duration-300",
              k >= 1 && k < 4 ? "rotate-[-7deg] scale-100 opacity-100" : "scale-[1.8] opacity-0",
            )}
            style={{ transitionTimingFunction: "var(--spring)" }}
          >
            <Ban className="size-3" /> Refund refused
          </span>
          <span className={cn("absolute -bottom-5 right-4 transition-[opacity,translate] duration-500 ease-[var(--ease)]", k >= 4 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
            <Avatar name="Priya" seed="priya" size={44} className="shadow-[0_0_0_3px_var(--color-void)]" />
          </span>
        </div>
      }
    />
  );
}

export function ProofScene() {
  const k = useSteps(3, 750);
  return (
    <Card
      bloom={["#10b981", "#2dd4bf", "#a3e635"]}
      face="maya"
      name="Maya"
      line={k >= 3 ? "$318 of $320 released to Maya" : "Booker · proof of booking"}
      action={<Action done={k >= 3} idle="Check proof" finished="Paid out" />}
      media={
        <div className="relative w-full max-w-[300px] rounded-2xl bg-[#f6f1ea] p-4 text-left text-[#1b1a19] shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]">
          <p className="text-[11.5px] font-semibold text-[#003580]">booking.com</p>
          <p className="mt-1 text-[17px] font-semibold leading-tight">Your booking is confirmed</p>
          <p className="mt-1.5 text-[12.5px] text-black/60">12–15 Mar · 8 guests · €318</p>
          <span
            className={cn(
              "absolute -right-3 -top-3 inline-flex items-center gap-1 rounded-full bg-paid px-2.5 py-1 text-[11px] font-bold text-void shadow-lg transition-[opacity,scale] duration-300",
              k >= 1 ? "scale-100 opacity-100" : "scale-[1.6] opacity-0",
            )}
            style={{ transitionTimingFunction: "var(--spring)" }}
          >
            <ShieldCheck className="size-3.5" /> DKIM checked in an enclave
          </span>
          <p className={cn("mt-3 text-[11.5px] text-black/50 transition-opacity duration-500", k >= 2 ? "opacity-100" : "opacity-0")}>Friends see dates, guests, total. Never names or card.</p>
        </div>
      }
    />
  );
}

const BEDS = ["Double, window", "Double, courtyard", "Bunk A, top", "Bunk A, bottom", "Bunk B, top", "Bunk B, bottom", "Loft single", "Sofa bed"];

export function DrawScene() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setT(i);
      if (i > 14) clearInterval(id);
    }, 90);
    return () => clearInterval(id);
  }, []);
  const done = t > 14;
  return (
    <Card
      bloom={["#f59e0b", "#facc15", "#fb7185"]}
      face="sam"
      name="Sam"
      line={done ? "Drawn by OutLayer VRF, checked by the contract" : "Eight beds, eight friends"}
      action={<Action done={done} idle="Draw beds" finished="Drawn" />}
      media={
        <div className="flex flex-col items-center gap-2 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75">Sam sleeps in</p>
          <p className={cn("text-[clamp(30px,5.5vw,42px)] font-semibold tracking-[-0.03em] transition-[filter] duration-300 drop-shadow-[0_6px_24px_rgb(0_0_0/0.35)]", done ? "blur-0" : "blur-[1.5px]")}>
            {BEDS[done ? 0 : t % 8]}
          </p>
        </div>
      }
    />
  );
}
