import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ChainTag } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { CHAINS } from "@/data/sample";
import type { ChainId } from "@/data/types";
import type { Pay } from "@/components/trip/wallet-pay";

/* Mainnet, no wallet in this browser: the one-time address, the exact amount and a QR any wallet reads
   (EIP-681 on EVM chains, Solana Pay on Solana, the bed account itself on NEAR). */
const EVM: Partial<Record<ChainId, { id: number; usdc: string }>> = {
  base: { id: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  arbitrum: { id: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  ethereum: { id: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
};
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const amount = (base: string) => (Number(base) / 1e6).toFixed(6).replace(/0{1,4}$/, "");
const validRefund = (c: ChainId, a: string) => (c === "solana" ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) : /^0x[0-9a-fA-F]{40}$/.test(a));

export function ManualStart({ chain, busy, err, onStart, initial = "" }: { chain: ChainId; busy: boolean; err: string | null; onStart: (refundTo: string) => void; initial?: string }) {
  // A friend who signed in through Ethereum Wallets refunds to that same 0x address unless they change it.
  const [refundTo, setRefundTo] = useState(chain !== "solana" ? initial : "");
  return (
    <div>
      {chain !== "near" && (
        <label className="block">
          <span className="label mb-1.5 block">Your {CHAINS[chain].name} address, for refunds</span>
          <Input className="h-12 rounded-2xl border-line bg-white/[0.04] px-4 font-mono text-[14px] text-fg placeholder:text-fg-3" value={refundTo} onChange={(e) => setRefundTo(e.target.value.trim())} placeholder={chain === "solana" ? "Your Solana address" : "0x…"} spellCheck={false} autoComplete="off" />
          <span className="mt-1.5 block text-[12.5px] text-fg-3">If the swap cannot finish, NEAR Intents sends your USDC back here.</span>
        </label>
      )}
      {err && <p className="mt-4 rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused">{err}</p>}
      <button className="pill-light focus-ring mt-5 w-full" disabled={busy || (chain !== "near" && !validRefund(chain, refundTo))} onClick={() => onStart(refundTo)}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {busy ? "Holding your bed…" : chain === "near" ? "Hold my bed" : `Get my ${CHAINS[chain].name} address`}
      </button>
      <p className="mt-3 text-center text-[12px] text-fg-3">NEAR mainnet · real USDC · live NEAR Intents quote</p>
    </div>
  );
}

export function DepositCard({ chain, pay, bed, onSent, children }: { chain: ChainId; pay: Pay; bed: string; onSent: () => void; children?: React.ReactNode }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (label: string, v: string) => {
    void navigator.clipboard?.writeText(v).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1400);
    });
  };
  const evm = EVM[chain];
  const qr = evm ? `ethereum:${evm.usdc}@${evm.id}/transfer?address=${pay.depositAddress}&uint256=${pay.amountIn}` : chain === "solana" ? `solana:${pay.depositAddress}?amount=${amount(pay.amountIn)}&spl-token=${SOL_USDC}` : pay.depositAddress;
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
      <button className="pill-light focus-ring mt-5 w-full" onClick={onSent}>
        I’ve sent it
      </button>
      {children}
    </div>
  );
}
