import React from "react";
import { BadgeCheck, Dices } from "lucide-react";
import { C, FACTS, FONT, GLASS, MONO } from "../../tokens";

/* The two chips of the draw, in the app's glass pill look (draw-sheet.tsx uses lucide Dices on "Draw the beds"). */

const pill: React.CSSProperties = {
  ...GLASS,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};

/** "OutLayer VRF" with the dice icon; `spin` turns the dice (degrees) while the draw rolls. */
export function VrfChip({ spin = 0 }: { spin?: number }) {
  return (
    <div style={{ ...pill, height: 60, gap: 12, padding: "0 28px 0 22px", fontFamily: FONT }}>
      <Dices size={28} color={C.fg} strokeWidth={2} style={{ transform: `rotate(${spin}deg)`, flexShrink: 0 }} />
      <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.015em", color: C.fg }}>OutLayer VRF</span>
    </div>
  );
}

/** First 8 and last 4 characters of the real testnet draw tx (DEPLOY-HANDBACK.md, tokens FACTS.vrfTx). */
export const VRF_TX_SHORT = `${FACTS.vrfTx.slice(0, 8)}…${FACTS.vrfTx.slice(-4)}`;

/** Mono proof chip under the list. */
export function ProofChip() {
  return (
    <div style={{ ...pill, height: 54, gap: 12, padding: "0 26px 0 20px" }}>
      <BadgeCheck size={24} color={C.paid} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: MONO, fontSize: 20, color: C.fg, letterSpacing: "-0.01em" }}>
        VRF draw verified on NEAR testnet <span style={{ color: C.fg2 }}>· {VRF_TX_SHORT}</span>
      </span>
    </div>
  );
}
