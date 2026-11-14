import { useEffect, useState } from "react";
import { Link } from "react-router";
import { RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import { Face, Wordmark } from "@/components/bits";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TripStrip } from "@/components/landing/strip";
import { PassHeader } from "@/components/trip/pass-header";
import { FundingMeter } from "@/components/trip/funding-meter";
import { SpotList } from "@/components/trip/spot-list";
import { ActivityFeed, NextStep, Rules, Waitlist, type Opens } from "@/components/trip/side";
import { PaySheet } from "@/components/trip/pay-sheet";
import { ResaleSheet } from "@/components/trip/resale-sheet";
import { ProofSheet } from "@/components/trip/proof-sheet";
import { DrawSheet } from "@/components/trip/draw-sheet";
import { CardSheet } from "@/components/trip/card-sheet";
import { deviceKey } from "@/live/passkey";
import { devAccounts } from "@/live/dev-keys";
import { cn, countdown } from "@/lib/utils";

const VIEWERS = [
  { id: "maya", role: "booker" },
  { id: "leo", role: "hasn’t paid" },
  { id: "ana", role: "can’t make it" },
  { id: "priya", role: "waitlist" },
];

export function TripPage() {
  const { trip, act, paidCount, live } = useTrip();
  const [viewer, setViewer] = useState(live ? "" : "leo");
  const [me, setMe] = useState<string | null>(null);
  const [card, setCard] = useState(false);
  const dev = live ? devAccounts() : [];

  // Live: you are your passkey (or device) account. On localhost, demo personas can be picked for filming.
  useEffect(() => {
    if (!live) return;
    deviceKey().then((k) => {
      setMe(k.accountId);
      setViewer((v) => v || dev[0] || k.accountId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const viewers = live ? [...dev.map((id) => ({ id, role: roleOf(id, trip) })), ...(me ? [{ id: me, role: "this device" }] : [])] : VIEWERS;
  const [pay, setPay] = useState<number | null>(null);
  const [exit, setExit] = useState<number | null>(null);
  const [proof, setProof] = useState(false);
  const [draw, setDraw] = useState(false);
  const [float, setFloat] = useState(false);
  const opens: Opens = { pay: setPay, exit: setExit, proof: () => setProof(true), draw: () => setDraw(true), card: () => setCard(true) };
  const active = pay !== null ? viewer : exit !== null ? viewer : proof ? trip.booker : undefined;

  useEffect(() => {
    const look = () => setFloat(scrollY > 8);
    addEventListener("scroll", look, { passive: true });
    look();
    return () => removeEventListener("scroll", look);
  }, []);

  return (
    <div className="page-in min-h-dvh pb-24">
      <header className="sticky top-0 z-30">
        <div
          className={cn("absolute inset-0 transition-opacity duration-300", float ? "opacity-100" : "opacity-0")}
          style={{ background: "rgb(14 14 14 / 0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        />
        <div className="relative mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5">
          <Wordmark />
          <div className="hidden md:block">
            <TripStrip
              paid={paidCount}
              active={active}
              clock={paidCount === trip.spots.length ? "ready" : countdown(trip.bookBy)}
              crew={trip.spots.filter((s) => s.holder).map((s) => ({ id: s.holder!, name: PEOPLE[s.holder!]?.name ?? "?" }))}
            />
          </div>
          <button
            className="pill-dark pill-sm focus-ring press"
            onClick={() => {
              navigator.clipboard?.writeText(location.href).catch(() => undefined);
              toast("Invite link copied", { description: "Anyone with the link can claim an open bed or join the waitlist." });
            }}
          >
            <Share2 className="size-3.5" /> Invite
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5">
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <span className="shrink-0 text-[12px] text-fg-3">{live ? "Acting as" : "Preview as"}</span>
          <ToggleGroup type="single" value={viewer} onValueChange={(v) => v && setViewer(v)} className="gap-1">
            {viewers.map((v) => (
              <ToggleGroupItem
                key={v.id}
                value={v.id}
                className="press h-8 shrink-0 gap-1.5 rounded-full border-0 py-1 pl-1 pr-3 text-[13px] text-fg-2 hover:bg-white/[0.05] hover:text-fg data-[state=on]:bg-fg data-[state=on]:text-void"
              >
                <Face id={v.id} size={22} />
                <span className="font-semibold">{PEOPLE[v.id]?.name ?? (v.role === "this device" ? "You" : v.id.split(".")[0].replace(/^./, (c) => c.toUpperCase()))}</span>
                <span className="opacity-60">{v.role}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {!live && <button onClick={() => act.reset()} className="press focus-ring ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-fg-3 hover:text-fg" aria-label="Reset the preview trip">
            <RotateCcw className="size-3.5" /> Reset
          </button>}
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <div className="flex min-w-0 flex-col gap-10">
            <PassHeader />
            <div className="lg:hidden">
              <NextStep viewer={viewer} open={opens} />
            </div>
            <FundingMeter />
            <div>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="display text-[20px]">The beds</h2>
                <p className="text-[12.5px] text-fg-3">{trip.drawn ? "drawn fairly" : "drawn when all are paid"}</p>
              </div>
              <SpotList viewer={viewer} onPay={setPay} onExit={setExit} />
            </div>
          </div>
          <aside className="flex flex-col gap-10 lg:sticky lg:top-24 lg:self-start">
            <div className="hidden lg:block">
              <NextStep viewer={viewer} open={opens} />
            </div>
            <Rules />
            <Waitlist />
            <ActivityFeed />
            <Link to="/" className="text-[12.5px] text-fg-3 transition-colors hover:text-fg">
              How Dibs works →
            </Link>
          </aside>
        </div>
      </main>

      <PaySheet n={pay} who={viewer} onClose={() => setPay(null)} />
      <ResaleSheet n={exit} onClose={() => setExit(null)} />
      <ProofSheet open={proof} onClose={() => setProof(false)} />
      <DrawSheet open={draw} onClose={() => setDraw(false)} />
      <CardSheet open={card} onClose={() => setCard(false)} />
    </div>
  );
}

function roleOf(id: string, trip: { booker: string; waitlist: string[]; spots: { holder?: string; status: string }[] }): string {
  if (id === trip.booker) return "booker";
  if (trip.waitlist.includes(id)) return "waitlist";
  const s = trip.spots.find((x) => x.holder === id);
  return s ? (s.status === "held" ? "hasn’t paid" : "paid") : "guest";
}
