import { useEffect, useRef, useState } from "react";
import { AtSign, EyeOff, FileText, Mail, ShieldCheck, Upload } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Badge } from "@/components/reui/badge";
import { ProgressSteps } from "@/components/trip/steps";
import { PEOPLE } from "@/data/sample";
import { useTrip } from "@/data/store";
import { stayDates, usd } from "@/lib/utils";
import * as api from "@/live/api";

type Step = "upload" | "checking" | "facts" | "released" | "refused";

const CHECKS = [
  { what: "The trip contract asks OutLayer to check the email", where: "trip contract → OutLayer" },
  { what: "DKIM signature is booking.com’s own", where: "Inside an Intel TDX enclave" },
  { what: "Read privately by NEAR AI Cloud", where: "Inside a GPU enclave; nobody sees the email" },
  { what: "Signed verdict checked by the contract", where: "ed25519 signature verified on-chain" },
];

export function ProofSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, act, live, code, lastError, proofPending } = useTrip();
  const [step, setStep] = useState<Step>(trip.proof ? "facts" : "upload");
  const [k, setK] = useState(0);
  const [items, setItems] = useState<api.InboxItem[]>([]);
  const [tx, setTx] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const startErr = useRef("");
  const file = useRef<HTMLInputElement>(null);
  const total = trip.price * trip.spots.length;
  const { label, nights } = stayDates(trip.checkIn, trip.checkOut);
  const address = `${code}@dibs.larinova.com`;

  useEffect(() => {
    if (!open) return;
    setStep(trip.drawnOut ? "released" : trip.proof ? "facts" : "upload");
    setK(0);
    setErr(null);
    if (live) api.inbox(code).then((r) => setItems(r.items)).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Visual checks tick on their own up to the last; live, the last waits for the chain's answer.
  useEffect(() => {
    if (step !== "checking") return;
    if (!live && k >= CHECKS.length) {
      act.proof();
      setStep("facts");
      return;
    }
    if (live && k >= CHECKS.length - 1) return;
    const id = setTimeout(() => setK((x) => x + 1), live ? 1600 : 850);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, k]);

  // Live: the contract stores the proof (and pays) or stores a refusal code.
  useEffect(() => {
    if (!live || step !== "checking") return;
    if (trip.proof) {
      setK(CHECKS.length);
      setStep(trip.drawnOut ? "released" : "facts");
    } else if (!proofPending && lastError && lastError !== startErr.current) setStep("refused");
  }, [live, step, trip.proof, trip.drawnOut, proofPending, lastError]);

  async function submit(blob: { blob_url: string; blob_sha256: string }) {
    setErr(null);
    startErr.current = lastError;
    setStep("checking");
    try {
      setTx((await act.proof(blob)).tx);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit the proof");
      setStep("upload");
    }
  }

  async function onFile(f: File) {
    try {
      await submit(await api.uploadProof(f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} eyebrow="Booker · proof of booking" title={titles[step]}>
      {step === "upload" && (
        <div>
          <p className="text-[15px] leading-relaxed text-fg-2">
            The crew’s {usd(total, 0)} is released only for a real booking. Book with the trip’s own email as the guest contact, or forward the confirmation to it as an attachment.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3.5 py-3">
            <AtSign className="size-4 text-fg-2" />
            <span className="font-mono text-[13.5px]">{live ? address : "lis0312@dibs.larinova.com"}</span>
          </div>
          {live && items.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {items.map((it) => (
                <button key={it.id} className="press focus-ring flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3.5 py-3 text-left hover:bg-white/[0.08]" onClick={() => submit(it)}>
                  <Mail className="size-4 text-paid" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">Booking email from {it.dkim_domain ?? it.from_domain ?? "unknown sender"}</span>
                    <span className="block text-[12px] text-fg-3">{new Date(it.received_at).toLocaleString()} · {it.status}</span>
                  </span>
                  <span className="text-[12.5px] text-fg-2">Check →</span>
                </button>
              ))}
            </div>
          )}
          {live ? (
            <>
              <input ref={file} type="file" accept=".eml,message/rfc822" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <button className="pill-dark focus-ring mt-3 w-full" onClick={() => file.current?.click()}>
                <Upload className="size-4" /> Or upload the .eml
              </button>
            </>
          ) : (
            <button
              className="focus-ring mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-white/[0.04] px-4 py-7 text-center hover:bg-white/[0.06]"
              onClick={() => setStep("checking")}
            >
              <FileText className="size-6 text-fg-2" />
              <span className="text-[15px] font-semibold">Use “Your booking is confirmed” from booking.com</span>
              <span className="text-[11.5px] text-fg-3">preview sample</span>
            </button>
          )}
          {err && <p className="mt-3 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
          <p className="mt-4 flex items-start gap-2 text-[13px] text-fg-2">
            <EyeOff className="mt-0.5 size-4 shrink-0" />
            Read inside two enclaves. Your friends see dates, guests and the total. Never your name, address or card.
          </p>
        </div>
      )}

      {step === "checking" && <ProgressSteps steps={CHECKS.map((c) => ({ title: c.what, sub: c.where }))} done={k} />}

      {step === "refused" && (
        <div className="rounded-2xl bg-refused/10 p-4">
          <p className="text-[15px] font-semibold text-refused">The contract refused this proof: {lastError}</p>
          <p className="mt-1.5 text-[13.5px] text-fg-2">Nothing moved. The crew’s money stays in the DAO until a real, matching booking is proven.</p>
          <button className="pill-dark focus-ring mt-4" onClick={() => setStep("upload")}>Try another email</button>
        </div>
      )}

      {(step === "facts" || step === "released") && trip.proof && (
        <div>
          <div className="relative rounded-2xl bg-white/[0.05] p-4">
            <Badge variant="success-light" radius="full" size="lg" className="absolute -top-3 right-4 bg-void px-2.5 font-semibold">
              <ShieldCheck className="size-3" /> Verified
            </Badge>
            <p className="label">What every friend sees</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
              <Fact k="Booked on" v={trip.proof.signedBy} />
              <Fact k="Dates" v={`${label} · ${nights} night${nights === 1 ? "" : "s"}`} />
              <Fact k="Guests" v={String(trip.proof.guests)} />
              <Fact k="Total" v={trip.proof.currency && trip.proof.currency !== "USD" ? `${trip.proof.currency} ${trip.proof.total.toFixed(2)} (cap ${usd(total, 0)})` : `${usd(trip.proof.total, 0)} of ${usd(total, 0)}`} />
            </dl>
            <p className="mt-3 border-t border-dashed border-line-strong pt-3 text-[12px] text-fg-3">Hidden: guest names, address, card, booking reference</p>
          </div>
          {step === "facts" && !live ? (
            <button className="pill-light focus-ring mt-5 w-full" onClick={() => (act.drawOut(), setStep("released"))}>
              Release {usd(total, 0)} to {PEOPLE[trip.booker]?.name}
            </button>
          ) : (
            <p className="mt-5 rounded-2xl bg-paid/10 px-4 py-3 text-[14px] text-paid">
              {trip.drawnOut
                ? `The crew DAO paid ${PEOPLE[trip.booker]?.name} ${trip.proof.total.toFixed(2)} USDC. The proposal passed because the contract proved the booking; no vote needed.`
                : "Verified. The crew DAO is paying out now."}
              {tx && (
                <a href={api.explorer(tx)} target="_blank" rel="noreferrer" className="ml-2 underline decoration-paid/30 underline-offset-4">
                  receipt ↗
                </a>
              )}
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
      <dt className="text-[12px] text-fg-3">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

const titles: Record<Step, string> = {
  upload: "Prove the booking",
  checking: "Checking, privately",
  facts: "It’s a real booking",
  released: "Money released",
  refused: "Not a valid booking",
};
