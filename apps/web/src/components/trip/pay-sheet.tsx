import { useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Sheet } from "@/components/sheet";
import { ChainTag } from "@/components/bits";
import { ProgressSteps } from "@/components/trip/steps";
import { CHAINS } from "@/data/sample";
import { useTrip } from "@/data/store";
import type { ChainId } from "@/data/types";
import { cn, pad2, usd } from "@/lib/utils";

type Step = "passkey" | "chain" | "deposit" | "tracking" | "done";
const TRACK = ["Deposit seen on your chain", "Swapped by NEAR Intents", "Landed in your bed’s own account", "Counted in the crew DAO"];

export function PaySheet({ n, who, onClose }: { n: number | null; who: string; onClose: () => void }) {
  const { trip, dispatch } = useTrip();
  const [step, setStep] = useState<Step>("passkey");
  const [chain, setChain] = useState<ChainId>("base");
  const [track, setTrack] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (n !== null) {
      setStep("passkey");
      setTrack(0);
    }
  }, [n]);

  useEffect(() => {
    if (step !== "tracking") return;
    if (track >= TRACK.length) {
      dispatch({ type: "pay", n: n!, who, chain });
      setStep("done");
      return;
    }
    const id = setTimeout(() => setTrack((t) => t + 1), 900);
    return () => clearTimeout(id);
  }, [step, track, dispatch, n, who, chain]);

  const c = CHAINS[chain];
  const send = trip.price * (1 + c.fee);
  const bedAccount = `bed-${pad2(n ?? 0)}.${trip.code.toLowerCase()}.dibs.near`;

  return (
    <Sheet open={n !== null} onOpenChange={(o) => !o && onClose()} eyebrow={`Bed ${pad2(n ?? 0)} · ${trip.place}`} title={titles[step]}>
      {step === "passkey" && (
        <div>
          <p className="text-[15px] leading-relaxed text-fg-2">
            A passkey on this phone becomes the only key bed {pad2(n ?? 0)} listens to. No wallet, no seed phrase, no gas.
          </p>
          <button
            className="pill-light focus-ring mt-6 w-full"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                setBusy(false);
                setStep("chain");
              }, 700);
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
            Hold bed {pad2(n ?? 0)} with a passkey
          </button>
        </div>
      )}

      {step === "chain" && (
        <div>
          <p className="text-[15px] text-fg-2">Pay from wherever your money already is. Your bed receives exactly {usd(trip.price)}.</p>
          <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Pay from">
            {(Object.keys(CHAINS) as ChainId[]).map((id) => {
              const ch = CHAINS[id];
              const on = chain === id;
              return (
                <button
                  key={id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setChain(id)}
                  className={cn(
                    "focus-ring flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                    on ? "border-fg bg-white/[0.04]" : "border-line hover:bg-white/[0.05]",
                  )}
                >
                  <span>
                    <span className="block text-[15px] font-semibold">{ch.name}</span>
                    <ChainTag id={id} className="mt-0.5" />
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-[14px] font-semibold">{usd(trip.price * (1 + ch.fee))}</span>
                    <span className="block text-[12px] text-fg-3">{ch.eta}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="pill-light focus-ring mt-5 w-full" onClick={() => setStep("deposit")}>
            Get my {c.name} address
          </button>
          <p className="mt-3 text-center text-[12px] text-fg-3">Live quote from NEAR Intents 1Click, exact output.</p>
        </div>
      )}

      {step === "deposit" && (
        <div>
          <div className="flex items-center gap-4 rounded-xl border border-line bg-white/[0.04] p-4">
            <div className="rounded-lg bg-panel p-2">
              <QRCodeSVG value={`dibs-preview:${chain}:${bedAccount}`} size={96} bgColor="transparent" fgColor="#ececea" />
            </div>
            <div className="min-w-0">
              <p className="label">Send exactly</p>
              <p className="font-mono text-[26px] font-semibold tracking-[-0.03em]">{send.toFixed(2)}</p>
              <ChainTag id={chain} />
            </div>
          </div>
          <p className="mt-3 break-all rounded-lg bg-white/[0.06] px-3 py-2 font-mono text-[12px] text-fg-2">
            Preview: the real one-time {c.name} deposit address appears here
          </p>
          <p className="mt-4 text-[14px] text-fg-2">
            It arrives in <span className="font-mono text-[13px] text-fg">{bedAccount}</span>, an account with no keys. Its code can only count you in.
          </p>
          <button className="pill-light focus-ring mt-5 w-full" onClick={() => setStep("tracking")}>
            I’ve sent it
          </button>
        </div>
      )}

      {(step === "tracking" || step === "done") && (
        <div>
          <ProgressSteps steps={TRACK.map((title) => ({ title }))} done={step === "done" ? TRACK.length : track} />
          {step === "done" && (
            <button className="pill-light focus-ring mt-6 w-full" onClick={onClose}>
              Back to the trip
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

const titles: Record<Step, string> = {
  passkey: "This bed is yours",
  chain: "Pay from any chain",
  deposit: "One address, one amount",
  tracking: "Your money is on its way",
  done: "You’re in",
};
