import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProgressSteps } from "@/components/trip/steps";
import { DepositCard, ManualStart } from "@/components/trip/manual-pay";
import { WalletPay, walletChain, type Pay } from "@/components/trip/wallet-pay";
import { CHAINS } from "@/data/sample";
import { useTrip } from "@/data/store";
import type { ChainId } from "@/data/types";
import { pad2 } from "@/lib/utils";
import * as api from "@/live/api";
import { evmTxUrl, isEvmChain } from "@/live/evm-wallet";
import { isEthAccount } from "@/live/near-wallet";
import { solTxUrl } from "@/live/solana-wallet";

/* Paying a bed on a live trip, wallet first. The bed is held for this device's passkey key, then the friend's own
   wallet pays. Mainnet: real USDC, a live NEAR Intents 1Click quote for other chains, or USDC on NEAR straight into
   the bed. Testnet: test USDC from a NEAR wallet, or Base Sepolia test USDC from an EVM wallet (checked by the API,
   which credits the bed because 1Click has no testnet); the faucet stays as a clearly marked judge demo. */
const API_CHAIN: Record<ChainId, string | null> = { near: null, base: "base", solana: "sol", arbitrum: "arb", ethereum: "eth" };
const LAND = ["Landed in your bed’s own account", "Counted in the crew DAO"];
const TRACKS = {
  swap: ["Deposit seen on your chain", "Swapped by NEAR Intents", ...LAND],
  near: ["USDC sent on NEAR", "No swap needed", ...LAND],
  testNear: ["Test USDC sent from your NEAR wallet", "No swap needed", ...LAND],
  testEvm: ["Sent from your wallet on Base Sepolia", "Checked on Base Sepolia by Dibs", ...LAND],
  faucet: ["Test deposit sent by the faucet", "No swap needed on testnet", ...LAND],
};

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
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function LivePay({ n, chain, me, step, setStep }: { n: number; chain: ChainId; me: string; step: string; setStep: (s: "deposit" | "tracking" | "done") => void }) {
  const { trip, code, contract, network, refresh } = useTrip();
  const testnet = network === "testnet";
  const bed = `b${pad2(n)}-${code}.${contract}`;
  const price = String(Math.round(trip.price * 1e6));
  const key = `dibs.pay.${network}.${code}.${n}.${chain}`;
  const [pay, setPay] = useState<Pay | null>(() => saved(key));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [tx, setTx] = useState<string | undefined>();
  const sweepTx = useRef<string | undefined>(undefined);
  const evmTestnet = testnet && chain === "base";
  const track = testnet ? (pay?.route === "faucet" ? TRACKS.faucet : chain === "near" ? TRACKS.testNear : TRACKS.testEvm) : chain === "near" ? TRACKS.near : TRACKS.swap;

  async function holdBed() {
    try {
      await api.hold({ trip: code, kind: "bed", n, holder: me });
    } catch (e) {
      const t = await api.getTrip(code).catch(() => null);
      if (t?.trip.beds[n - 1]?.holder !== me) throw e;
    }
  }

  /** Holds the bed, then the one address and amount: the bed itself (NEAR), the Base Sepolia deposit (testnet) or a 1Click quote. */
  async function quoteFor(refund: string): Promise<Pay> {
    await holdBed();
    let p: Pay;
    if (chain === "near") p = { depositAddress: bed, amountIn: price, expiresAt: null, refundTo: me };
    else if (testnet) p = { depositAddress: (await api.evmInfo()).address, amountIn: price, expiresAt: null, refundTo: refund };
    else {
      const q = await api.quote({ trip: code, n, kind: "bed", fromChain: API_CHAIN[chain]!, refundTo: refund });
      p = { depositAddress: q.depositAddress, amountIn: q.amountIn, expiresAt: q.expiresAt, refundTo: refund };
    }
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

  async function run(body: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await body();
    } catch (e) {
      setErr(message(e, "Could not hold your bed"));
    } finally {
      setBusy(false);
    }
  }
  const faucet = () => run(async () => (await holdBed(), setPay({ depositAddress: bed, amountIn: price, expiresAt: null, refundTo: me, route: "faucet" }), setStep("tracking")));

  useEffect(() => {
    if (step !== "tracking" || !pay) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const finish = async (sweep?: string | null) => {
      save(key, null);
      setTx(sweep ?? sweepTx.current);
      setDone(4);
      await refresh();
      if (alive) setStep("done");
    };
    const fail = (m: string) => alive && setErr(m);
    if (pay.route === "faucet") {
      setDone(1);
      api.fund({ trip: code, kind: "bed", n }).then(
        (r) => void (alive && finish(r.sweep_tx)),
        (e) => void fail(message(e, "The test faucet failed")),
      );
      return () => void (alive = false);
    }
    const tick = async () => {
      try {
        if (evmTestnet && pay.sentTx) {
          try {
            const r = await api.evmDeposit({ trip: code, kind: "bed", n, txHash: pay.sentTx });
            return void (alive && finish(r.sweep_tx));
          } catch (e) {
            const c = e instanceof api.ApiError ? e.code : undefined;
            if (c === "E_EVM_TX_PENDING" || c === "E_RPC") {
              setDone(1);
              if (Date.now() - started > 240_000) return void fail("Base Sepolia has not mined this transaction after 4 minutes. Check it in your wallet.");
            } else if (c === "E_DEPOSIT_USED" && (await api.getTrip(code)).trip.beds[n - 1]?.status === "Paid") return void finish();
            else return void fail(message(e, "Dibs could not check that payment"));
          }
        } else {
          const st = await api.status(pay.depositAddress);
          if (!alive) return;
          if (st.tx_hash) sweepTx.current = st.tx_hash;
          if (st.status === "REFUNDED" || st.status === "FAILED") return void fail(st.status === "REFUNDED" ? `NEAR Intents could not finish the swap and refunded you at ${pay.refundTo.slice(0, 8)}…` : "NEAR Intents reported the swap as failed.");
          const s = stage(st);
          setDone(s);
          if (s === 4) return void finish();
        }
      } catch {
        /* a dropped poll is retried on the next tick */
      }
      if (alive) timer = setTimeout(tick, evmTestnet ? 3000 : 4000);
    };
    timer = setTimeout(tick, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pay]);

  if (step === "tracking" || step === "done") {
    const sentUrl = !pay?.sentTx ? "" : chain === "base" && testnet ? evmTxUrl("base-sepolia", pay.sentTx) : isEvmChain(chain) ? evmTxUrl(chain, pay.sentTx) : chain === "solana" ? solTxUrl(pay.sentTx) : api.explorer(pay.sentTx);
    return (
      <div>
        <ProgressSteps steps={track.map((title) => ({ title }))} done={step === "done" ? track.length : done} />
        {pay?.sentTx && (
          <a href={sentUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[13px] text-fg-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
            Sent from {pay.wallet} · {pay.sentTx.slice(0, 8)}…{pay.sentTx.slice(-4)} ↗
          </a>
        )}
        {step === "tracking" && !err && done === 0 && <p className="mt-4 text-[13.5px] text-fg-2">{pay?.sentTx ? "Waiting for your transaction to confirm." : `Waiting for your ${CHAINS[chain].name} deposit.`} Keep this open; it moves on its own.</p>}
        {err && <p className="mt-4 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused" role="alert">{err}</p>}
        {step === "done" && tx && (
          <a href={api.explorer(tx)} target="_blank" rel="noreferrer" className="mt-4 block text-[13px] text-fg-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
            Receipt on NEAR {network} ↗
          </a>
        )}
      </div>
    );
  }

  const wallet = <WalletPay chain={chain} network={network} price={trip.price} pay={pay} getQuote={quoteFor} onSent={sent} compact={!!pay && !testnet} />;
  const divider = (label: string) => <div className="my-5 flex items-center gap-3 text-[12px] text-fg-3"><span className="h-px flex-1 bg-line" />{label}<span className="h-px flex-1 bg-line" /></div>;

  if (testnet && !pay?.sentTx) {
    return (
      <div>
        {wallet}
        {walletChain(chain, network) === null && <p className="text-[13.5px] leading-relaxed text-fg-2">On testnet, {CHAINS[chain].name} has no test wallet route. Pick NEAR or Base to pay from your own wallet, or use the judge demo.</p>}
        {divider("Judge demo: no wallet")}
        {err && <p className="mb-3 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused" role="alert">{err}</p>}
        <button className="pill-dark focus-ring w-full" disabled={busy} onClick={faucet}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Holding your bed…" : "Pay with the test faucet"}
        </button>
        <p className="mt-2 text-center text-[12px] text-fg-3">Mints test USDC straight into your bed. For judges without a wallet.</p>
      </div>
    );
  }
  if (!pay) {
    return (
      <div>
        {wallet}
        {divider("or send it yourself")}
        <ManualStart chain={chain} busy={busy} err={err} initial={isEthAccount(me) ? me : ""} onStart={(refund) => void run(async () => void (await quoteFor(refund)))} />
      </div>
    );
  }
  return (
    <DepositCard chain={chain} pay={pay} bed={bed} onSent={() => setStep("tracking")}>
      {!pay.sentTx && wallet}
    </DepositCard>
  );
}
