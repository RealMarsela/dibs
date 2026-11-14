import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import { CHAINS } from "@/data/sample";
import type { ChainId } from "@/data/types";
import * as api from "@/live/api";
import { connectEvm, discoverEvmWallets, disconnectEvm, ensureChain, evmError, isEvmChain, sendUsdc, usdcBalance, type EvmWallet } from "@/live/evm-wallet";
import { connectNear, disconnectNear, nearError, nearUsdcBalance, payBedFromNear, type NearSession } from "@/live/near-wallet";

/* "Pay with your wallet": the friend's own wallet sends exactly the quoted USDC, so nobody copies an address by hand.
   EVM wallets come from EIP-6963, NEAR wallets from NEAR Connect. The copy-and-send route stays underneath. */

export type Pay = { depositAddress: string; amountIn: string; expiresAt: string | null; refundTo: string; sentTx?: string; wallet?: string };

const usdc = (base: bigint) => (Number(base) / 1e6).toFixed(6).replace(/0{1,4}$/, "");
const short = (a: string) => (a.length > 18 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function WalletPay({ chain, price, pay, getQuote, onSent, compact }: {
  chain: ChainId;
  price: number;
  pay: Pay | null;
  getQuote: (refundTo: string) => Promise<Pay>;
  onSent: (p: Pay, tx: string, wallet: string) => void;
  compact?: boolean;
}) {
  const evm = isEvmChain(chain) ? chain : null;
  const [wallets, setWallets] = useState<EvmWallet[] | null>(null);
  const [conn, setConn] = useState<{ id: string; name: string; from: string; w?: EvmWallet } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const name = CHAINS[chain].name;
  const floor = BigInt(Math.round(price * 1e6));

  useEffect(() => (evm ? discoverEvmWallets(setWallets) : undefined), [evm]);

  async function payEvm(w: EvmWallet) {
    if (!evm) return;
    setBusy(w.id);
    setErr(null);
    try {
      setPhase(`Connecting ${w.name}…`);
      const from = await connectEvm(w);
      setConn({ id: w.id, name: w.name, from, w });
      setPhase(`Putting ${w.name} on ${name}…`);
      await ensureChain(w, evm);
      const bal = await usdcBalance(w, evm, from);
      if (bal < floor) throw new Error(`${short(from)} has ${usdc(bal)} USDC on ${name}. This bed needs about ${usdc((floor * 1011n) / 1000n)}.`);
      if (!pay) setPhase("Holding your bed and getting a live quote…");
      const p = pay ?? (await getQuote(from));
      if (bal < BigInt(p.amountIn)) throw new Error(`${short(from)} has ${usdc(bal)} USDC on ${name}. This bed needs ${usdc(BigInt(p.amountIn))}.`);
      setPhase(`Confirm ${usdc(BigInt(p.amountIn))} USDC in ${w.name}…`);
      const tx = await sendUsdc(w, evm, from, p.depositAddress, BigInt(p.amountIn));
      api.submitDeposit(p.depositAddress, tx).catch(() => undefined);
      onSent(p, tx, w.name);
    } catch (e) {
      setErr(evmError(e, w.name, evm));
    } finally {
      setBusy(null);
      setPhase("");
    }
  }

  async function payNear() {
    setBusy("near");
    setErr(null);
    let s: NearSession | null = null;
    try {
      setPhase("Opening NEAR Connect…");
      s = await connectNear();
      setConn({ id: "near", name: s.wallet, from: s.accountId });
      const bal = await nearUsdcBalance(s.accountId);
      if (bal < floor) throw new Error(`${short(s.accountId)} has ${usdc(bal)} USDC on NEAR. This bed needs ${usdc(floor)}.`);
      if (!pay) setPhase("Holding your bed…");
      const p = pay ?? (await getQuote(s.accountId));
      setPhase(`Confirm ${usdc(BigInt(p.amountIn))} USDC in ${s.wallet}…`);
      onSent(p, await payBedFromNear(p.depositAddress, p.amountIn), s.wallet);
    } catch (e) {
      setErr(nearError(e, s?.wallet ?? "your NEAR wallet"));
    } finally {
      setBusy(null);
      setPhase("");
    }
  }

  async function disconnect() {
    if (conn?.w) await disconnectEvm(conn.w);
    if (conn?.id === "near") await disconnectNear();
    setConn(null);
    setErr(null);
  }

  if (chain === "solana") return null;
  const rows: { id: string; icon: React.ReactNode; title: string; sub: string; go: () => void }[] =
    chain === "near"
      ? [{ id: "near", icon: <Wallet className="size-4" />, title: "Pay with a NEAR wallet", sub: "HOT, Meteor, MyNearWallet, Intear, NEAR Mobile, Ledger", go: payNear }]
      : (wallets ?? []).map((w) => ({
          id: w.id,
          icon: w.icon ? <img src={w.icon} alt="" className="size-5 rounded" /> : <Wallet className="size-4" />,
          title: `Pay with ${w.name}`,
          sub: conn?.id === w.id ? `Connected · ${short(conn.from)}` : `USDC on ${name}, signed in your wallet`,
          go: () => void payEvm(w),
        }));

  return (
    <div className={compact ? "mt-4" : undefined}>
      {!compact && <p className="label mb-2">Pay with your wallet</p>}
      {evm && wallets === null && <p className="flex items-center gap-2 text-[13px] text-fg-3"><Loader2 className="size-3.5 animate-spin" /> Looking for wallets in this browser…</p>}
      {evm && wallets?.length === 0 && !compact && <p className="text-[13px] leading-relaxed text-fg-3">No browser wallet found here. Any wallet or exchange works with the address below.</p>}
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <button key={r.id} disabled={busy !== null} onClick={r.go} className="press focus-ring flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-60">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06]">{busy === r.id ? <Loader2 className="size-4 animate-spin" /> : r.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{r.title}</span>
              <span className="block truncate text-[12.5px] text-fg-3">{r.sub}</span>
            </span>
            <ArrowRight className="size-4 text-fg-3" />
          </button>
        ))}
      </div>
      {phase && <p className="mt-3 flex items-center gap-2 text-[13.5px] text-fg-2" aria-live="polite"><Loader2 className="size-3.5 animate-spin" /> {phase}</p>}
      {err && <p className="mt-3 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused" role="alert">{err}</p>}
      {conn && busy === null && (
        <button onClick={disconnect} className="focus-ring mt-2 rounded-md text-[12.5px] text-fg-3 underline decoration-white/20 underline-offset-4 hover:text-fg">
          Disconnect {conn.name}
        </button>
      )}
    </div>
  );
}
