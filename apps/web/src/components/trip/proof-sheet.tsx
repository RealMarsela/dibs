import { useEffect, useState } from "react";
import { Check, EyeOff, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Stamp } from "@/components/bits";
import { PEOPLE } from "@/data/sample";
import { useTrip } from "@/data/store";
import { cn, stayDates, usd } from "@/lib/utils";

type Step = "upload" | "checking" | "facts" | "released";

const CHECKS = [
  { what: "The trip contract asks OutLayer to check the email", where: "lis-0312.dibs.near → OutLayer" },
  { what: "DKIM signature is booking.com’s own", where: "Inside an Intel TDX enclave" },
  { what: "Read privately by NEAR AI Cloud", where: "Inside a GPU enclave; nobody sees the email" },
  { what: "Signed verdict checked by the contract", where: "ed25519 signature verified on-chain" },
];

export function ProofSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, dispatch } = useTrip();
  const [step, setStep] = useState<Step>(trip.proof ? "facts" : "upload");
  const [k, setK] = useState(0);
  const total = trip.price * trip.spots.length;
  const { label, nights } = stayDates(trip.checkIn, trip.checkOut);

  useEffect(() => {
    if (open) {
      setStep(trip.drawnOut ? "released" : trip.proof ? "facts" : "upload");
      setK(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step !== "checking") return;
    if (k >= CHECKS.length) {
      dispatch({ type: "proof", facts: { stay: trip.stay, checkIn: trip.checkIn, checkOut: trip.checkOut, guests: trip.spots.length, total, signedBy: "booking.com" } });
      setStep("facts");
      return;
    }
    const id = setTimeout(() => setK((x) => x + 1), 850);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, k]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} eyebrow="Booker · proof of booking" title={titles[step]}>
      {step === "upload" && (
        <div>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            The crew’s {usd(total, 0)} is released only for a real booking. Drop in the confirmation email exactly as you received it.
          </p>
          <button
            className="focus-ring mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-rule-strong bg-paper px-4 py-7 text-center hover:bg-paper-deep/60"
            onClick={() => setStep("checking")}
          >
            <FileText className="size-6 text-ink-soft" />
            <span className="text-[15px] font-semibold">Use “Your booking is confirmed” from booking.com</span>
            <span className="font-mono text-[11px] text-ink-faint">.eml · preview sample</span>
          </button>
          <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-soft">
            <EyeOff className="mt-0.5 size-4 shrink-0" />
            Read inside two enclaves. Your friends see dates, guests and the total. Never your name, address or card.
          </p>
        </div>
      )}

      {step === "checking" && (
        <ol className="flex flex-col gap-3.5">
          {CHECKS.map((c, i) => {
            const done = i < k;
            const now = i === k;
            return (
              <li key={c.what} className="flex gap-3">
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border", done ? "border-paid bg-paid text-card" : "border-rule-strong text-ink-faint")}>
                  {done ? <Check className="size-4" /> : now ? <Loader2 className="size-4 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span>
                  <span className={cn("block text-[15px] font-medium", !done && !now && "text-ink-faint")}>{c.what}</span>
                  <span className="block font-mono text-[11.5px] text-ink-faint">{c.where}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {(step === "facts" || step === "released") && trip.proof && (
        <div>
          <div className="relative rounded-xl border border-rule bg-paper p-4">
            <Stamp tone="paid" className="animate-stamp absolute -top-3 right-4 bg-card">
              <ShieldCheck className="size-3" /> Verified
            </Stamp>
            <p className="eyebrow">What every friend sees</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
              <Fact k="Booked on" v={trip.proof.signedBy} />
              <Fact k="Dates" v={`${label} · ${nights} nights`} />
              <Fact k="Guests" v={String(trip.proof.guests)} />
              <Fact k="Total" v={`${usd(trip.proof.total, 0)} of ${usd(total, 0)}`} />
            </dl>
            <p className="mt-3 border-t border-dashed border-rule-strong pt-3 font-mono text-[11.5px] text-ink-faint">Hidden: guest names, address, card, booking reference</p>
          </div>
          {step === "facts" ? (
            <button
              className="btn-ink focus-ring mt-5 w-full"
              onClick={() => {
                dispatch({ type: "drawOut" });
                setStep("released");
              }}
            >
              Release {usd(total, 0)} to {PEOPLE[trip.booker].name}
            </button>
          ) : (
            <p className="mt-5 rounded-xl bg-paid-soft px-4 py-3 text-[14px] text-paid">
              The crew DAO paid {PEOPLE[trip.booker].name} {usd(total, 0)}. The proposal passed because the contract proved the booking; no vote needed.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-faint">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

const titles: Record<Step, string> = {
  upload: "Prove the booking",
  checking: "Checking, privately",
  facts: "It’s a real booking",
  released: "Money released",
};
