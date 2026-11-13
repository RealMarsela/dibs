import { useState } from "react";
import { Link } from "react-router";
import { RotateCcw, Share2 } from "lucide-react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import { Avatar, Wordmark } from "@/components/bits";
import { PassHeader } from "@/components/trip/pass-header";
import { FundingMeter } from "@/components/trip/funding-meter";
import { SpotList } from "@/components/trip/spot-list";
import { ActivityFeed, NextStep, Rules, Waitlist, type Opens } from "@/components/trip/side";
import { PaySheet } from "@/components/trip/pay-sheet";
import { ResaleSheet } from "@/components/trip/resale-sheet";
import { ProofSheet } from "@/components/trip/proof-sheet";
import { DrawSheet } from "@/components/trip/draw-sheet";
import { cn } from "@/lib/utils";

const VIEWERS = [
  { id: "maya", role: "booker" },
  { id: "leo", role: "hasn’t paid" },
  { id: "ana", role: "can’t make it" },
  { id: "priya", role: "waitlist" },
];

export function TripPage() {
  const { trip, dispatch } = useTrip();
  const [viewer, setViewer] = useState("leo");
  const [pay, setPay] = useState<number | null>(null);
  const [exit, setExit] = useState<number | null>(null);
  const [proof, setProof] = useState(false);
  const [draw, setDraw] = useState(false);
  const opens: Opens = { pay: setPay, exit: setExit, proof: () => setProof(true), draw: () => setDraw(true) };

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-30 border-b border-rule/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <div className="flex items-center gap-1">
            <Link to="/" className="focus-ring hidden rounded-full px-3 py-1.5 text-[14px] text-ink-soft hover:text-ink sm:inline-flex">
              How Dibs works
            </Link>
            <button className="btn-paper btn-sm focus-ring" onClick={() => navigator.clipboard?.writeText(location.href)}>
              <Share2 className="size-3.5" /> Invite
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <PreviewBar viewer={viewer} setViewer={setViewer} onReset={() => dispatch({ type: "reset" })} />

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <PassHeader />
            <div className="lg:hidden">
              <NextStep viewer={viewer} open={opens} />
            </div>
            <div className="ticket p-5">
              <FundingMeter />
            </div>
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[18px] font-bold tracking-[-0.02em]">The beds</h2>
                <p className="font-mono text-[11.5px] text-ink-faint">{trip.drawn ? "drawn by VRF" : "drawn when all are paid"}</p>
              </div>
              <SpotList viewer={viewer} onPay={setPay} onExit={setExit} />
            </div>
          </div>

          <aside className="flex flex-col gap-5">
            <div className="hidden lg:block">
              <NextStep viewer={viewer} open={opens} />
            </div>
            <Rules />
            <Waitlist />
            <ActivityFeed />
          </aside>
        </div>
      </div>

      <PaySheet n={pay} who={viewer} onClose={() => setPay(null)} />
      <ResaleSheet n={exit} onClose={() => setExit(null)} />
      <ProofSheet open={proof} onClose={() => setProof(false)} />
      <DrawSheet open={draw} onClose={() => setDraw(false)} />
    </div>
  );
}

function PreviewBar({ viewer, setViewer, onReset }: { viewer: string; setViewer: (v: string) => void; onReset: () => void }) {
  return (
    <div className="mt-4 flex items-center gap-2 overflow-x-auto rounded-full border border-dashed border-rule-strong bg-card/60 p-1.5 [scrollbar-width:none]">
      <span className="shrink-0 pl-2.5 pr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">See it as</span>
      {VIEWERS.map((v) => (
        <button
          key={v.id}
          onClick={() => setViewer(v.id)}
          aria-pressed={viewer === v.id}
          className={cn(
            "focus-ring flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13.5px] transition-colors",
            viewer === v.id ? "bg-ink text-card" : "hover:bg-paper-deep",
          )}
        >
          <Avatar id={v.id} size={22} />
          <span className="font-semibold">{PEOPLE[v.id].name}</span>
          <span className={viewer === v.id ? "text-card/60" : "text-ink-faint"}>{v.role}</span>
        </button>
      ))}
      <button onClick={onReset} className="focus-ring ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] text-ink-soft hover:bg-paper-deep" aria-label="Reset the preview trip">
        <RotateCcw className="size-3.5" /> Reset
      </button>
    </div>
  );
}
