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
import { deviceKey } from "@/live/passkey";
import { devKey } from "@/live/dev-keys";
import { explorer } from "@/live/api";
import { LivePay } from "@/components/trip/live-pay";

type Step = "passkey" | "chain" | "deposit" | "tracking" | "done";
const MAINNET_TRACK = ["Deposit seen on your chain", "Swapped by NEAR Intents", "Landed in your bed’s own account", "Counted in the crew DAO"];
/* On testnet nothing is swapped: the faucet sends the exact amount. The steps say so rather than tick a swap that never ran. */
const TESTNET_TRACK = ["Test deposit sent by the faucet", "No swap needed on testnet", "Landed in your bed’s own account", "Counted in the crew DAO"];

export function PaySheet({ n, who, onClose }: { n: number | null; who: string; onClose: () => void }) {
  const { trip, act, live, code, contract, network } = useTrip();
  const mainnet = live && network === "mainnet";
  const TRACK = live && !mainnet ? TESTNET_TRACK : MAINNET_TRACK;
  const [step, setStep] = useState<Step>("passkey");
  const [chain, setChain] = useState<ChainId>("base");
  const [track, setTrack] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    if (n !== null) {
      setStep("passkey");
      setTrack(0);
    }
  }, [n]);

  // The pay call starts as tracking begins; the visual steps advance on their own but the last one waits
  // for the chain, so "Counted in the crew DAO" is only ticked once the contract says Paid.
  useEffect(() => {
    if (step !== "tracking" || n === null || live) return;
    let alive = true;
    setErr(null);
    act
      .pay(n, who, chain)
      .then((r) => {
        if (!alive) return;
        setTx(r.tx);
        setTrack(TRACK.length);
        setStep("done");
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Payment failed"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== "tracking" || track >= TRACK.length - 1 || live) return;
    const id = setTimeout(() => setTrack((t) => t + 1), live ? 1400 : 900);
    return () => clearTimeout(id);
  }, [step, track, live]);

  const c = CHAINS[chain];
  const send = trip.price * (1 + c.fee);
  const bedAccount = live ? `b${pad2(n ?? 0)}-${code}.${contract}` : `b${pad2(n ?? 0)}-${trip.code.toLowerCase()}.dibs.near`;

  return (
    <Sheet open={n !== null} onOpenChange={(o) => !o && onClose()} eyebrow={`Bed ${pad2(n ?? 0)} · ${trip.place}`} title={titles[step]}>
      {step === "passkey" && (
        <div>
          <p className="text-[15px] leading-relaxed text-fg-2">
            A passkey on this phone becomes the only key bed {pad2(n ?? 0)} listens to. Next, you pay from your own wallet.
          </p>
          <button
            className="pill-light focus-ring mt-6 w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (mainnet) setMe((await deviceKey()).accountId);
                else if (live) setMe((devKey(who) ?? (await deviceKey())).accountId);
                else await new Promise((r) => setTimeout(r, 700));
                setStep("chain");
              } finally {
                setBusy(false);
              }
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

      {live && n !== null && me && (step === "deposit" || step === "tracking" || step === "done") && <LivePay n={n} chain={chain} me={me} step={step} setStep={setStep} />}
      {live && step === "done" && (
        <button className="pill-light focus-ring mt-6 w-full" onClick={onClose}>
          Back to the trip
        </button>
      )}
      {!live && step === "deposit" && (
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
          <p className="mt-3 break-all rounded-xl bg-white/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-fg-2">
            {`Preview: the real one-time ${c.name} deposit address appears here.`}
          </p>
          {me && <p className="mt-2 text-[12px] text-fg-3">Your key: {me.length > 24 ? `${me.slice(0, 8)}…${me.slice(-6)}` : me}</p>}
          <p className="mt-4 text-[14px] text-fg-2">
            It arrives in <span className="font-mono text-[13px] text-fg">{bedAccount}</span>, an account with no keys. Its code can only count you in.
          </p>
          <button className="pill-light focus-ring mt-5 w-full" onClick={() => setStep("tracking")}>
            I’ve sent it
          </button>
        </div>
      )}

      {!live && (step === "tracking" || step === "done") && (
        <div>
          <ProgressSteps steps={TRACK.map((title) => ({ title }))} done={step === "done" ? TRACK.length : track} />
          {err && <p className="mt-4 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
          {step === "done" && tx && (
            <a href={explorer(tx)} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[13px] text-fg-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
              Receipt on NEAR ↗
            </a>
          )}
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
