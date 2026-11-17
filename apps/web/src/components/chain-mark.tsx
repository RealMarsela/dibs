import near from "@/assets/chains/near.svg?raw";
import base from "@/assets/chains/base.svg?raw";
import solana from "@/assets/chains/solana.svg?raw";
import arbitrum from "@/assets/chains/arbitrum.svg?raw";
import ethereum from "@/assets/chains/ethereum.svg?raw";
import usdc from "@/assets/chains/usdc.svg?raw";
import type { ChainId } from "@/data/types";
import { cn } from "@/lib/utils";

/* Official chain marks (sources in assets/chains/SOURCES.md), inlined and sanitised, in their true colours on a soft
   light tile so the dark ones (NEAR, Ethereum) read on the dark sheets. The USDC badge in the corner is the usual
   token-on-chain mark: what you pay is USDC, on that chain. */
const MARKS: Record<ChainId, string> = { near, base, solana, arbitrum, ethereum };
const NAMES: Record<ChainId, string> = { near: "NEAR", base: "Base", solana: "Solana", arbitrum: "Arbitrum", ethereum: "Ethereum" };

export function ChainMark({ id, size = 32, badge = true, className }: { id: ChainId; size?: number; badge?: boolean; className?: string }) {
  const pad = Math.max(2, Math.round(size * 0.17));
  const b = Math.max(12, Math.round(size * 0.5));
  return (
    <span role="img" aria-label={badge ? `USDC on ${NAMES[id]}` : NAMES[id]} className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="grid size-full place-items-center bg-[#ececea] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] [&>svg]:size-full"
        style={{ padding: pad, borderRadius: Math.round(size * 0.3) }}
        dangerouslySetInnerHTML={{ __html: MARKS[id] }}
      />
      {badge && (
        <span
          aria-hidden
          className="absolute rounded-full bg-[#ececea] ring-2 ring-[#1b1b1a] [&>svg]:size-full"
          style={{ width: b, height: b, right: -Math.round(b * 0.3), bottom: -Math.round(b * 0.3) }}
          dangerouslySetInnerHTML={{ __html: usdc }}
        />
      )}
    </span>
  );
}
