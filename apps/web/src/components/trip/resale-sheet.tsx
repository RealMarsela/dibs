import { useEffect, useState } from "react";
import { ArrowRight, Ban } from "lucide-react";
import TearTicket from "@/vendor/tear-ticket";
import { Sheet } from "@/components/sheet";
import { Face, ChainTag } from "@/components/bits";
import { Badge } from "@/components/reui/badge";
import { PEOPLE } from "@/data/sample";
import { useTrip } from "@/data/store";
import type { ChainId } from "@/data/types";
import { pad2, stayDates, usd } from "@/lib/utils";
import { explorer } from "@/live/api";
import { deviceKey } from "@/live/passkey";
import { devKey } from "@/live/dev-keys";
import { callFromNear, rememberedNear } from "@/live/near-wallet";

type Step = "ask" | "refused" | "tear" | "matching" | "sold";

export function ResaleSheet({ n, onClose }: { n: number | null; onClose: () => void }) {
  const { trip, act, live, network, contract, code, refresh } = useTrip();
  const [refusal, setRefusal] = useState<{ code?: string; tx?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [startHolder, setStartHolder] = useState<string | undefined>();
  const [step, setStep] = useState<Step>("ask");
  const [buyer, setBuyer] = useState<string | null>(null);
  const [sellerChain, setSellerChain] = useState<ChainId | undefined>();
  const [sellerName, setSellerName] = useState("");
  const spot = trip.spots.find((s) => s.n === n);
  const holder = spot?.holder ? PEOPLE[spot.holder] : undefined;
  const { label } = stayDates(trip.checkIn, trip.checkOut);
  const w = typeof window === "undefined" ? 360 : Math.min(380, window.innerWidth - 48);

  useEffect(() => {
    if (n !== null) {
      setStep("ask");
      const sp = trip.spots.find((s) => s.n === n);
      setSellerChain(sp?.paidWith);
      setSellerName(sp?.holder ? PEOPLE[sp.holder]?.name ?? "" : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    if (step !== "matching" || n === null || live) return;
    const next = trip.waitlist[0] ?? null;
    const id = setTimeout(() => {
      setBuyer(next);
      if (next) act.resell(n);
      setStep("sold");
    }, 1400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Live: the contract fills a listed bed from the funded waitlist in the same call; read it back.
  useEffect(() => {
    if (!live || step !== "matching" || !spot) return;
    if (spot.holder && spot.holder !== startHolder && spot.status === "paid") {
      setBuyer(spot.holder);
      setStep("sold");
    } else if (spot.status === "listed" && trip.waitlist.length === 0) {
      setBuyer(null);
      setStep("sold");
    }
  }, [live, step, spot, startHolder, trip.waitlist.length]);

  async function signer() {
    const h = spot?.holder;
    return (h && devKey(h)) || (await deviceKey());
  }

  return (
    <Sheet open={n !== null} onOpenChange={(o) => !o && onClose()} eyebrow={`Bed ${pad2(n ?? 0)} · ${sellerName}`} title={titles[step]}>
      {step === "ask" && (
        <div className="flex flex-col gap-2.5">
          <p className="mb-2 text-[15px] leading-relaxed text-fg-2">
            Plans change. Here is what this trip’s contract lets you do.
          </p>
          <button
            className="pill-dark focus-ring w-full justify-between"
            onClick={() => {
              setErr(null);
              act
                .refuse(n!)
                .then((r) => setRefusal(r))
                .catch((e) => setRefusal({ code: e?.code ?? "E_NO_REFUND", tx: undefined }));
              setStep("refused");
            }}
          >
            Get my {usd(trip.price, 0)} back <ArrowRight className="size-4" />
          </button>
          <button className="pill-light focus-ring w-full justify-between" onClick={() => setStep("tear")}>
            Sell my bed at the price I paid <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {step === "refused" && (
        <div>
          <div className="relative rounded-xl border border-refused/40 bg-refused/10 p-4">
            <Badge variant="destructive-light" radius="full" size="lg" className="absolute -top-3 right-4 rotate-[-4deg] bg-void px-2.5 font-semibold">
              <Ban className="size-3" /> Refused
            </Badge>
            <p className="text-[15px] leading-relaxed">
              Refunds don’t exist in this trip. Your {usd(trip.price, 0)} holds a bed that {trip.spots.length - 1} friends are counting on, and the booker
              shouldn’t pay for your change of plans.
            </p>
            <p className="mt-2 font-mono text-[12px] text-fg-2">
              {refusal?.code ? `Contract answered ${refusal.code}` : "Asking the contract…"}
              {refusal?.tx && (
                <a href={explorer(refusal.tx)} target="_blank" rel="noreferrer" className="ml-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
                  receipt ↗
                </a>
              )}
            </p>
          </div>
          <button className="pill-light focus-ring mt-5 w-full" onClick={() => setStep("tear")}>
            Sell it instead, for exactly {usd(trip.price, 0)}
          </button>
        </div>
      )}

      {step === "tear" && (
        <div className="flex flex-col items-center">
          <p className="mb-4 self-start text-[15px] text-fg-2">Tear off your stub to put bed {pad2(n ?? 0)} up for sale. The price is locked at what you paid.</p>
          <TearTicket
            width={w}
            height={186}
            stubSize={104}
            background="#232322"
            color="#ececea"
            borderColor="rgba(255,255,255,0.14)"
            stubBackground="#2c2c2b"
            holes={10}
            rotate={-2}
            ariaLabel={`Tear off the stub to list bed ${pad2(n ?? 0)} for resale`}
            onTear={async () => {
              setStartHolder(spot?.holder);
              // Move on as the stub flies off; the matching step reads the result back from the chain.
              setTimeout(() => setStep((s) => (s === "tear" ? "matching" : s)), 650);
              if (!live) return void act.list(n!);
              try {
                // A bed held by the signed-in NEAR wallet is listed by that wallet; a passkey bed signs gaslessly.
                const w = rememberedNear(network);
                if (w && spot?.holder === w.accountId) {
                  await callFromNear(network, w, contract, "list_for_resale", { trip: code.toLowerCase(), n: n! });
                  await refresh();
                } else await act.list(n!, await signer());
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Listing failed");
                setStep("tear");
              }
            }}
            stub={
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Face value</p>
                <p className="font-mono text-[24px] font-semibold">{usd(trip.price, 0)}</p>
                <p className="text-[11px] opacity-60">tear to sell</p>
              </div>
            }
          >
            <div className="flex h-full flex-col justify-between p-4 text-left">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Bed {pad2(n ?? 0)}</p>
                <p className="text-[30px] font-extrabold uppercase leading-none tracking-[-0.04em]">{trip.place}</p>
                <p className="mt-1 text-[13px] opacity-70">{label}</p>
              </div>
              <div className="flex items-center gap-2">
                {spot?.holder && <Face id={spot.holder} size={22} />}
                <span className="text-[14px] font-semibold">{holder?.name}</span>
              </div>
            </div>
          </TearTicket>
          <p className="mt-4 text-[12px] text-fg-3">Drag the stub away, or focus it and press Enter.</p>
          {err && <p className="mt-3 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
        </div>
      )}

      {step === "matching" && (
        <div className="py-6 text-center">
          <p className="text-[15px] text-fg-2">Checking the waitlist for someone who already paid…</p>
        </div>
      )}

      {step === "sold" && (
        <div>
          {buyer ? (
            <div className="rounded-xl border border-line bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <Face id={buyer} size={36} />
                <div>
                  <p className="text-[16px] font-semibold">{PEOPLE[buyer].name} has bed {pad2(n ?? 0)} now</p>
                  <p className="text-[13px] text-fg-2">First on the waitlist, money already in.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-line-strong pt-3">
                <span className="text-[14px]">You get back</span>
                <span className="text-right">
                  <span className="block font-mono text-[18px] font-semibold">{usd(trip.price)}</span>
                  {sellerChain && <ChainTag id={sellerChain} />}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-fg-2">Your bed is listed. The first person to pay {usd(trip.price, 0)} takes it, and the money goes straight to you.</p>
          )}
          <p className="mt-4 text-[13px] text-fg-2">The booker’s money never moved. The bed never went empty.</p>
          <button className="pill-light focus-ring mt-5 w-full" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Sheet>
  );
}

const titles: Record<Step, string> = {
  ask: "Can’t make it?",
  refused: "No refunds. Ever.",
  tear: "Sell your bed",
  matching: "Finding your buyer",
  sold: "Sold at face value",
};
