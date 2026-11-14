import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Wallet } from "lucide-react";
import { CHAINS } from "@/data/sample";
import type { ChainId } from "@/data/types";
import * as api from "@/live/api";
import { connectEvm, discoverEvmWallets, disconnectEvm, ensureChain, evmError, isEvmChain, sendUsdc, usdcBalance, type EvmChain, type EvmWallet } from "@/live/evm-wallet";
import { connectNear, disconnectNear, nearError, nearUsdcBalance, payBedFromNear, type NearSession } from "@/live/near-wallet";
import { connectSolana, discoverSolanaWallets, disconnectSolana, sendSolUsdc, solError, solUsdcBalance, type SolSession, type SolWallet } from "@/live/solana-wallet";

/* "Pay with your wallet": the friend's own wallet sends exactly the quoted USDC, so nobody copies an address by hand.
   EVM wallets come from EIP-6963, Solana wallets from the Wallet Standard, NEAR wallets from NEAR Connect.
   Testnet: Base means Base Sepolia test USDC (checked by the API, which credits the bed on NEAR testnet) and NEAR means
   the trip's test USDC, which a wallet without any mints to itself in the same transaction. */

export type Pay = { depositAddress: string; amountIn: string; expiresAt: string | null; refundTo: string; sentTx?: string; wallet?: string; route?: "faucet" };
type Net = "mainnet" | "testnet";

/** Which wallet route pays this chain on this network, if any. */
export function walletChain(chain: ChainId, network: Net): EvmChain | "solana" | "near" | null {
  if (chain === "near") return "near";
  if (network === "testnet") return chain === "base" ? "base-sepolia" : null;
  return chain === "solana" ? "solana" : isEvmChain(chain) ? chain : null;
}

const usdc = (base: bigint) => (Number(base) / 1e6).toFixed(6).replace(/0{1,4}$/, "");
const short = (a: string) => (a.length > 18 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function WalletPay({ chain, network, price, pay, getQuote, onSent, compact }: {
  chain: ChainId;
  network: Net;
  price: number;
  pay: Pay | null;
  getQuote: (refundTo: string) => Promise<Pay>;
  onSent: (p: Pay, tx: string, wallet: string) => void;
  compact?: boolean;
}) {
  const wc = walletChain(chain, network);
  const evm = wc && wc !== "near" && wc !== "solana" ? wc : null;
  const sol = wc === "solana";
  const testnet = network === "testnet";
  const [wallets, setWallets] = useState<EvmWallet[] | null>(null);
  const [solWallets, setSolWallets] = useState<SolWallet[] | null>(null);
  const [conn, setConn] = useState<{ id: string; name: string; from: string; w?: EvmWallet; s?: SolSession } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const name = evm === "base-sepolia" ? "Base Sepolia" : CHAINS[chain].name;
  const unit = testnet ? "test USDC" : "USDC";
  const floor = BigInt(Math.round(price * 1e6));
  const need = (p: Pay | null) => (p ? BigInt(p.amountIn) : testnet ? floor : (floor * 1011n) / 1000n);

  useEffect(() => (evm ? discoverEvmWallets(setWallets) : undefined), [evm]);
  useEffect(() => (sol ? discoverSolanaWallets(setSolWallets) : undefined), [sol]);

  async function run(id: string, label: string, body: () => Promise<void>, toMsg: (e: unknown) => string) {
    setBusy(id);
    setErr(null);
    try {
      setPhase(`Connecting ${label}…`);
      await body();
    } catch (e) {
      setErr(toMsg(e));
    } finally {
      setBusy(null);
      setPhase("");
    }
  }

  const payEvm = (w: EvmWallet) =>
    run(w.id, w.name, async () => {
      if (!evm) return;
      const from = await connectEvm(w);
      setConn({ id: w.id, name: w.name, from, w });
      setPhase(`Putting ${w.name} on ${name}…`);
      await ensureChain(w, evm);
      const bal = await usdcBalance(w, evm, from);
      if (bal < need(pay)) throw new Error(`${short(from)} has ${usdc(bal)} ${unit} on ${name}. This bed needs ${testnet ? "" : "about "}${usdc(need(pay))}.`);
      if (!pay) setPhase(testnet ? "Holding your bed…" : "Holding your bed and getting a live quote…");
      const p = pay ?? (await getQuote(from));
      if (bal < BigInt(p.amountIn)) throw new Error(`${short(from)} has ${usdc(bal)} ${unit} on ${name}. This bed needs ${usdc(BigInt(p.amountIn))}.`);
      setPhase(`Confirm ${usdc(BigInt(p.amountIn))} ${unit} in ${w.name}…`);
      const tx = await sendUsdc(w, evm, from, p.depositAddress, BigInt(p.amountIn));
      if (!testnet) api.submitDeposit(p.depositAddress, tx).catch(() => undefined);
      onSent(p, tx, w.name);
    }, (e) => evmError(e, w.name, evm ?? "base"));

  const paySolana = (w: SolWallet) =>
    run(w.id, w.name, async () => {
      const s = await connectSolana(w);
      setConn({ id: w.id, name: w.name, from: s.account.address, s });
      const bal = await solUsdcBalance(s.account.address);
      if (bal < need(pay)) throw new Error(`${short(s.account.address)} has ${usdc(bal)} USDC on Solana. This bed needs about ${usdc(need(pay))}.`);
      if (!pay) setPhase("Holding your bed and getting a live quote…");
      const p = pay ?? (await getQuote(s.account.address));
      if (bal < BigInt(p.amountIn)) throw new Error(`${short(s.account.address)} has ${usdc(bal)} USDC on Solana. This bed needs ${usdc(BigInt(p.amountIn))}.`);
      setPhase(`Confirm ${usdc(BigInt(p.amountIn))} USDC in ${w.name}…`);
      const sig = await sendSolUsdc(s, p.depositAddress, BigInt(p.amountIn));
      api.submitDeposit(p.depositAddress, sig).catch(() => undefined);
      onSent(p, sig, w.name);
    }, (e) => solError(e, w.name));

  let nearName = "your NEAR wallet";
  const payNear = () =>
    run("near", "NEAR Connect", async () => {
      const s: NearSession = await connectNear(network);
      nearName = s.wallet;
      setConn({ id: "near", name: s.wallet, from: s.accountId });
      const bal = await nearUsdcBalance(network, s.accountId);
      // Testnet: a wallet without test USDC mints it to itself in the same transaction (the token's open faucet).
      if (bal < floor && !testnet) throw new Error(`${short(s.accountId)} has ${usdc(bal)} USDC on NEAR. This bed needs ${usdc(floor)}.`);
      if (!pay) setPhase("Holding your bed…");
      const p = pay ?? (await getQuote(s.accountId));
      setPhase(`Confirm ${usdc(BigInt(p.amountIn))} ${unit} in ${s.wallet}…`);
      onSent(p, await payBedFromNear(network, s, p.depositAddress, p.amountIn, testnet && bal < BigInt(p.amountIn)), s.wallet);
    }, (e) => nearError(e, nearName));

  async function disconnect() {
    if (conn?.w) await disconnectEvm(conn.w);
    if (conn?.s) await disconnectSolana(conn.s);
    if (conn?.id === "near") await disconnectNear(network);
    setConn(null);
    setErr(null);
  }

  if (!wc) return null;
  const rows: { id: string; icon: React.ReactNode; title: string; sub: string; go: () => void }[] =
    wc === "near"
      ? [{ id: "near", icon: <Wallet className="size-4" />, title: "Pay with a NEAR wallet", sub: conn?.id === "near" ? `Connected · ${short(conn.from)}` : testnet ? "Meteor, Intear, Nightly, MyNearWallet, Ledger · test USDC" : "HOT, Meteor, MyNearWallet, Intear, NEAR Mobile, Ledger", go: () => void payNear() }]
      : ((sol ? solWallets : wallets) ?? []).map((w) => ({
          id: w.id,
          icon: w.icon ? <img src={w.icon} alt="" className="size-5 rounded" /> : <Wallet className="size-4" />,
          title: `Pay with ${w.name}`,
          sub: conn?.id === w.id ? `Connected · ${short(conn.from)}` : `${testnet ? "Test USDC" : "USDC"} on ${name}, signed in your wallet`,
          go: () => void ("w" in w ? paySolana(w as SolWallet) : payEvm(w as EvmWallet)),
        }));
  const found = wc === "near" ? rows : sol ? solWallets : wallets;

  return (
    <div className={compact ? "mt-4" : undefined}>
      {!compact && <p className="label mb-2">Pay with your wallet</p>}
      {found === null && <p className="flex items-center gap-2 text-[13px] text-fg-3"><Loader2 className="size-3.5 animate-spin" /> Looking for wallets in this browser…</p>}
      {found?.length === 0 && !compact && (
        <p className="text-[13px] leading-relaxed text-fg-3">{testnet ? `No browser wallet found here. Install one with ${name} test USDC, or use the judge demo below.` : "No browser wallet found here. Any wallet or exchange works with the address below."}</p>
      )}
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
