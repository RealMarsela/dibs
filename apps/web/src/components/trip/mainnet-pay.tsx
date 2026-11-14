import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ChainTag } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { ProgressSteps } from "@/components/trip/steps";
import { CHAINS } from "@/data/sample";
import { useTrip } from "@/data/store";
import type { ChainId } from "@/data/types";
import { pad2 } from "@/lib/utils";
import * as api from "@/live/api";
import { evmTxUrl, isEvmChain } from "@/live/evm-wallet";
import { WalletPay, type Pay } from "@/components/trip/wallet-pay";

/* The real pay-in on NEAR mainnet. Hold the bed for this device's key, ask NEAR Intents 1Click for an exact-output
   quote into the bed's own account, show the one-time deposit address, then follow the swap until the bed's account
   has forwarded the money into the crew DAO. Every number on screen comes from the quote or the chain. */
const API_CHAIN: Record<ChainId, string | null> = { near: null, base: "base", solana: "sol", arbitrum: "arb", ethereum: "eth" };
const EVM: Partial<Record<ChainId, { id: number; usdc: string }>> = {
  base: { id: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  arbitrum: { id: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  ethereum: { id: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
};
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SWAP_TRACK = ["Deposit seen on your chain", "Swapped by NEAR Intents", "Landed in your bed’s own account", "Counted in the crew DAO"];
const NEAR_TRACK = ["USDC sent on NEAR", "No swap needed", "Landed in your bed’s own account", "Counted in the crew DAO"];

const amount = (base: string) => (Number(base) / 1e6).toFixed(6).replace(/0{1,4}$/, "");
const validRefund = (c: ChainId, a: string) => (c === "solana" ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) : /^0x[0-9a-fA-F]{40}$/.test(a));
const saved = (k: string): Pay | null => {
  try {
    const p = JSON.parse(localStorage.getItem(k) ?? "null") as Pay | null;
    return p && (!p.expiresAt || Date.parse(p.expiresAt) > Date.now()) ? p : null;
  } catch {
    return null;
  }
};
const save = (k: string, p: Pay | null) => {
  try {
    if (p) localStorage.setItem(k, JSON.stringify(p));
    else localStorage.removeItem(k);
  } catch {
    /* private window: the payment still works, it just is not remembered */
  }
};
function stage(st: api.Status): number {
  if (st.status === "SUCCESS") return st.sweep === "done" || st.sweep === "already_done" ? 4 : 3;
  if (["KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"].includes(st.status)) return 1;
  return 0;
}

export function MainnetPay({ n, chain, me, step, setStep }: { n: number; chain: ChainId; me: string; step: string; setStep: (s: "deposit" | "tracking" | "done") => void }) {
  const { trip, code, contract, refresh } = useTrip();
  const bed = `b${pad2(n)}-${code}.${contract}`;
  const key = `dibs.pay.${code}.${n}.${chain}`;
  const [refundTo, setRefundTo] = useState("");
  const [pay, setPay] = useState<Pay | null>(() => saved(key));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [tx, setTx] = useState<string | undefined>();
  const [copied, setCopied] = useState<string | null>(null);
  const track = chain === "near" ? NEAR_TRACK : SWAP_TRACK;
  const sweepTx = useRef<string | undefined>(undefined);

  async function holdBed() {
    try {
      await api.hold({ trip: code, kind: "bed", n, holder: me });
    } catch (e) {
      const t = await api.getTrip(code).catch(() => null);
      if (t?.trip.beds[n - 1]?.holder !== me) throw e;
    }
  }

  /** Holds the bed for this device's key, then gets the one address and amount: a live 1Click quote, or on NEAR the bed itself. */
  async function quoteFor(refund: string): Promise<Pay> {
    await holdBed();
    if (chain === "near") {
      const p = { depositAddress: bed, amountIn: String(Math.round(trip.price * 1e6)), expiresAt: null, refundTo: me };
      setPay(p);
      return p;
    }
    const q = await api.quote({ trip: code, n, kind: "bed", fromChain: API_CHAIN[chain]!, refundTo: refund });
    const p = { depositAddress: q.depositAddress, amountIn: q.amountIn, expiresAt: q.expiresAt, refundTo: refund };
    save(key, p);
    setPay(p);
    return p;
  }

  function sent(p: Pay, hash: string, wallet: string) {
    const q = { ...p, sentTx: hash, wallet };
    save(key, q);
    setPay(q);
    setStep("tracking");
  }

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      await quoteFor(refundTo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not get a deposit address");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "tracking" || !pay) return;
    let alive = true;
    const tick = async () => {
      try {
        const st = await api.status(pay.depositAddress);
        if (!alive) return;
        if (st.tx_hash) sweepTx.current = st.tx_hash;
        if (st.status === "REFUNDED" || st.status === "FAILED") {
          setErr(st.status === "REFUNDED" ? `NEAR Intents could not finish the swap and refunded you at ${pay.refundTo.slice(0, 8)}…` : "NEAR Intents reported the swap as failed.");
          return;
        }
        const s = stage(st);
        setDone(s);
        if (s === 4) {
          save(key, null);
          setTx(sweepTx.current);
          await refresh();
          setStep("done");
          return;
        }
      } catch {
        /* a dropped poll is retried on the next tick */
      }
      if (alive) timer = setTimeout(tick, 4000);
    };
    let timer = setTimeout(tick, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pay]);

  const copy = (label: string, v: string) => {
    void navigator.clipboard?.writeText(v).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1400);
    });
  };
  const evm = EVM[chain];
  const qr = !pay ? "" : evm ? `ethereum:${evm.usdc}@${evm.id}/transfer?address=${pay.depositAddress}&uint256=${pay.amountIn}` : chain === "solana" ? `solana:${pay.depositAddress}?amount=${amount(pay.amountIn)}&spl-token=${SOL_USDC}` : pay.depositAddress;

  if (step === "tracking" || step === "done") {
    return (
      <div>
        <ProgressSteps steps={track.map((title) => ({ title }))} done={step === "done" ? track.length : done} />
        {pay?.sentTx && (
          <a href={isEvmChain(chain) ? evmTxUrl(chain, pay.sentTx) : api.explorer(pay.sentTx)} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[13px] text-fg-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
            Sent from {pay.wallet} · {pay.sentTx.slice(0, 8)}…{pay.sentTx.slice(-4)} ↗
          </a>
        )}
        {step === "tracking" && !err && done === 0 && <p className="mt-4 text-[13.5px] text-fg-2">{pay?.sentTx ? "Waiting for your transaction to confirm." : `Waiting for your ${CHAINS[chain].name} deposit.`} Keep this open; it moves on its own.</p>}
        {err && <p className="mt-4 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
        {step === "done" && tx && (
          <a href={api.explorer(tx)} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[13px] text-fg-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
            Receipt on NEAR mainnet ↗
          </a>
        )}
      </div>
    );
  }

  const wallet = <WalletPay chain={chain} price={trip.price} pay={pay} getQuote={quoteFor} onSent={sent} compact={!!pay} />;
  if (!pay) {
    return (
      <div>
        {chain !== "solana" && (
          <>
            {wallet}
            <div className="my-5 flex items-center gap-3 text-[12px] text-fg-3"><span className="h-px flex-1 bg-line" />or send it yourself<span className="h-px flex-1 bg-line" /></div>
          </>
        )}
        {chain !== "near" && (
          <label className="block">
            <span className="label mb-1.5 block">Your {CHAINS[chain].name} address, for refunds</span>
            <Input className="h-12 rounded-2xl border-line bg-white/[0.04] px-4 font-mono text-[14px] text-fg placeholder:text-fg-3" value={refundTo} onChange={(e) => setRefundTo(e.target.value.trim())} placeholder={chain === "solana" ? "Your Solana address" : "0x…"} spellCheck={false} autoComplete="off" />
            <span className="mt-1.5 block text-[12.5px] text-fg-3">If the swap cannot finish, NEAR Intents sends your USDC back here.</span>
          </label>
        )}
        {err && <p className="mt-4 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
        <button className="pill-light focus-ring mt-5 w-full" disabled={busy || (chain !== "near" && !validRefund(chain, refundTo))} onClick={start}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Holding your bed…" : chain === "near" ? "Hold my bed" : `Get my ${CHAINS[chain].name} address`}
        </button>
        <p className="mt-3 text-center text-[12px] text-fg-3">NEAR mainnet · real USDC · live NEAR Intents quote</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-white/[0.04] p-4">
        <div className="rounded-lg bg-white p-2">
          <QRCodeSVG value={qr} size={104} bgColor="#ffffff" fgColor="#0b0b0c" />
        </div>
        <div className="min-w-0">
          <p className="label">Send exactly</p>
          <button className="focus-ring flex items-center gap-2 rounded-md font-mono text-[24px] font-semibold tracking-[-0.03em]" onClick={() => copy("amount", amount(pay.amountIn))}>
            {amount(pay.amountIn)} {copied === "amount" ? <Check className="size-4 text-paid" /> : <Copy className="size-4 text-fg-3" />}
          </button>
          <ChainTag id={chain} />
        </div>
      </div>
      <button className="focus-ring mt-3 flex w-full items-start gap-2 break-all rounded-xl bg-white/[0.06] px-3 py-2 text-left font-mono text-[12.5px] leading-relaxed text-fg-2 hover:text-fg" onClick={() => copy("address", pay.depositAddress)}>
        <span className="flex-1">{pay.depositAddress}</span>
        {copied === "address" ? <Check className="mt-0.5 size-4 shrink-0 text-paid" /> : <Copy className="mt-0.5 size-4 shrink-0 text-fg-3" />}
      </button>
      <p className="mt-4 text-[14px] text-fg-2">
        {chain === "near" ? "Send USDC on NEAR straight to your bed’s own account" : "NEAR Intents swaps it and lands exactly the bed price"} in <span className="font-mono text-[13px] text-fg">{bed}</span>, an account with no keys. Its code can only count you in.
      </p>
      <button className="pill-light focus-ring mt-5 w-full" onClick={() => setStep("tracking")}>
        I’ve sent it
      </button>
      {!pay.sentTx && wallet}
    </div>
  );
}
