import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BedDouble, Check, CreditCard, Eye, Loader2, X } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { ProgressSteps } from "@/components/trip/steps";
import { useTrip } from "@/data/store";
import { cn, usd } from "@/lib/utils";
import * as api from "@/live/api";
import { openCard, type CardDetails } from "@/live/card";
import { deviceKey } from "@/live/passkey";
import { devKey } from "@/live/dev-keys";

/* The trip's own card. When every bed is paid, the contract's enclave (OutLayer, holding the issuer key as a sealed
   secret) issues a single-use card that only works at hotels, with a limit equal to the pot, sealed to the booker's
   key. The booker books with the trip's money without ever holding it. Card rails: Lithic sandbox. */
type Step = "intro" | "issuing" | "card";
const ISSUE = [
  { title: "Trip contract confirms every bed is paid", sub: "read from NEAR inside the enclave" },
  { title: "Enclave issues the card with its sealed key", sub: "OutLayer · Intel TDX" },
  { title: "Single use, hotels only, limit = the pot", sub: "MCC 7011 rule" },
  { title: "Sealed to the booker’s passkey", sub: "only her phone can open it" },
];

interface Try {
  merchant: "carlton" | "electronics";
  approved?: boolean;
  reason?: string;
  busy?: boolean;
}

export function CardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, live, code } = useTrip();
  const [step, setStep] = useState<Step>("intro");
  const [k, setK] = useState(0);
  const [card, setCard] = useState<{ last4: string; limit: number; sealed?: string } | null>(null);
  const [details, setDetails] = useState<CardDetails | null>(null);
  const [tries, setTries] = useState<Try[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const pot = trip.price * trip.spots.length;

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (live)
      api
        .cardGet(code)
        .then((c) => (setCard({ last4: c.last4, limit: Number(c.spend_limit) / 100, sealed: c.sealed_hex }), setStep("card")))
        .catch(() => setStep(card ? "card" : "intro"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step !== "issuing" || k >= ISSUE.length - 1) return;
    const id = setTimeout(() => setK((x) => x + 1), 1100);
    return () => clearTimeout(id);
  }, [step, k]);

  async function issue() {
    setSlow(false);
    setStep("issuing");
    setK(0);
    try {
      if (live) {
        // The enclave answers through OutLayer's queue, which can take minutes when busy: poll until the card lands.
        const t0 = Date.now();
        let r = await api.cardIssue(code);
        while ("pending" in r) {
          if (Date.now() - t0 > 20_000) setSlow(true);
          if (Date.now() - t0 > 12 * 60_000) throw new Error("OutLayer is busy right now. Try again in a few minutes.");
          await new Promise((ok) => setTimeout(ok, 5000));
          r = await api.cardIssue(code);
        }
        const c = await api.cardGet(code);
        setCard({ last4: c.last4, limit: Number(c.spend_limit) / 100, sealed: c.sealed_hex });
      } else {
        await new Promise((r) => setTimeout(r, 4200));
        setCard({ last4: "8087", limit: pot });
      }
      setK(ISSUE.length);
      setTimeout(() => setStep("card"), 500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The card could not be issued");
      setStep("intro");
    }
  }

  async function reveal() {
    if (!card?.sealed) return setDetails({ pan: "4111 •••• •••• " + (card?.last4 ?? "0000"), cvv: "•••", exp: "11/27" });
    const key = devKey(trip.booker) ?? (await deviceKey());
    try {
      setDetails(openCard(card.sealed, key.secret()));
    } catch {
      setErr("Only the booker’s device can open this card.");
    }
  }

  async function tryCard(merchant: Try["merchant"]) {
    setTries((t) => [...t.filter((x) => x.merchant !== merchant), { merchant, busy: true }]);
    let res: Try;
    if (live) {
      try {
        const r = await api.cardSimulate(code, merchant);
        res = { merchant, approved: r.approved, reason: r.reason ?? r.result };
      } catch (e) {
        res = { merchant, approved: false, reason: e instanceof Error ? e.message : "error" };
      }
    } else {
      await new Promise((r) => setTimeout(r, 900));
      res = merchant === "carlton" ? { merchant, approved: true } : { merchant, approved: false, reason: "Hotels only" };
    }
    setTries((t) => [...t.filter((x) => x.merchant !== merchant), res]);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} eyebrow="The trip’s own card" title={step === "card" ? "Book with the trip’s card" : "No one holds the money"}>
      {step === "intro" && (
        <div>
          <p className="text-[15px] leading-relaxed text-fg-2">
            Every bed is paid. Instead of sending {usd(pot, 0)} to the booker, the trip gets a card of its own: one use, hotels only, never more than the pot.
          </p>
          <button className="pill-light focus-ring press mt-6 w-full" onClick={issue}>
            <CreditCard className="size-4" /> Issue the trip’s card
          </button>
          {err && <p className="mt-3 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
          <p className="mt-4 text-[12px] text-fg-3">Card rails: Lithic sandbox. A real program needs an issuer.</p>
        </div>
      )}

      {step === "issuing" && (
        <>
          <ProgressSteps steps={ISSUE} done={k} />
          {slow && (
            <p className="mt-4 text-[13px] leading-relaxed text-fg-3" aria-live="polite">
              The enclave queue on testnet is busy. Still working; this can take a few minutes, and a stalled run is retried for you.
            </p>
          )}
        </>
      )}

      {step === "card" && card && (
        <div>
          <motion.div
            initial={{ rotateX: 24, y: 30, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, opacity: 1 }}
            transition={{ type: "spring", visualDuration: 0.6, bounce: 0.2 }}
            className="relative aspect-[1.586] w-full overflow-hidden rounded-[20px] p-5"
            style={{ background: "radial-gradient(120% 140% at 0% 0%, #2f2f2d 0%, #1a1a19 55%, #111110 100%)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / .08), 0 30px 60px -30px rgb(0 0 0 / .8)" }}
          >
            <div className="flex items-start justify-between">
              <span className="text-[20px] font-bold tracking-[-0.04em]">dibs</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11.5px] text-fg-2">
                <BedDouble className="size-3.5" /> Hotels only
              </span>
            </div>
            <p className="mt-7 font-mono text-[19px] tracking-[0.12em] tabular-nums">{details ? details.pan : `•••• •••• •••• ${card.last4}`}</p>
            <div className="mt-4 flex items-end justify-between text-[12px] text-fg-2">
              <span>
                {trip.place.toUpperCase()} · {trip.code}
                <br />
                <span className="text-fg">{details ? `${details.exp} · CVV ${details.cvv}` : "Single use"}</span>
              </span>
              <span className="text-right">
                Limit
                <br />
                <span className="text-[15px] font-semibold text-fg">{usd(card.limit, 0)}</span>
              </span>
            </div>
          </motion.div>
          {!details && (
            <button className="pill-dark pill-sm focus-ring press mt-3" onClick={reveal}>
              <Eye className="size-3.5" /> Reveal on this device
            </button>
          )}
          <p className="label mt-5 mb-2">Try it</p>
          <div className="flex flex-col gap-2">
            {(["carlton", "electronics"] as const).map((m) => {
              const t = tries.find((x) => x.merchant === m);
              return (
                <button key={m} className="press focus-ring flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3.5 py-3 text-left hover:bg-white/[0.08]" onClick={() => tryCard(m)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{m === "carlton" ? "Carlton City Hotel SG" : "VoltCity Electronics"}</span>
                    <span className="block text-[12px] text-fg-3">{m === "carlton" ? "Hotel · MCC 7011" : "Electronics · MCC 5732"}</span>
                  </span>
                  {t?.busy ? (
                    <Loader2 className="size-4 animate-spin text-fg-2" />
                  ) : t ? (
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold", t.approved ? "bg-paid/15 text-paid" : "bg-refused/15 text-refused")}>
                      {t.approved ? <Check className="size-3.5" /> : <X className="size-3.5" />} {t.approved ? "Approved" : "Declined"}
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-fg-2">Charge {usd(card.limit, 0)}</span>
                  )}
                </button>
              );
            })}
          </div>
          {err && <p className="mt-3 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
          <p className="mt-4 text-[12px] text-fg-3">Lithic sandbox: the card network is simulated; the rules are real.</p>
        </div>
      )}
    </Sheet>
  );
}
