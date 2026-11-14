import React from "react";
import { C, FONT, MONO, FACTS } from "../../tokens";
import { MailIcon } from "./Rows";
import { hexA } from "../../components/Surfaces";
import { FORGED_TOTAL, type T08 } from "./data";

/* The forged copy of the real sin1025 booking email, opened up: sender, subject, then the three facts friends see.
   On "forges" the amount's digits are selected and retyped (FACTS.proofTotal -> FORGED_TOTAL) with a visible caret. Natural size CARD_W x CARD_H. */
export const CARD_W = 860;
export const CARD_H = 350;
const TOP = 32;
const HEAD = 30;
const SUBJ = 44;
const FACT = 56;
/** y of the Total row's centre, measured from the card's top edge. */
export const TOTAL_Y = TOP + HEAD + 14 + SUBJ + 20 + 1 + 8 + FACT * 2 + FACT / 2;

/** Currency part of the real total ("SGD "), kept while the digits are retyped. */
const PREFIX = FACTS.proofTotal.replace(/[\d.,]+$/, "");
/** The total line at frame f: the real amount; its digits selected (a highlight sweeps over them); then the forged
    digits typed over the selection one key every 2 frames. */
export function forgedValue(f: number, t: T08): { digits: string; sel: number } {
  const orig = FACTS.proofTotal.slice(PREFIX.length);
  const forged = FORGED_TOTAL.slice(PREFIX.length);
  if (f < t.sel0) return { digits: orig, sel: 0 };
  if (f < t.type0) return { digits: orig, sel: Math.min(1, (f - t.sel0 + 1) / (t.type0 - t.sel0)) };
  const typed = Math.min(forged.length, Math.floor((f - t.type0) / 2) + 1);
  return { digits: forged.slice(0, typed), sel: 0 };
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ height: FACT, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 24, color: C.fg2 }}>{k}</span>
      <span style={{ fontSize: 28, fontWeight: 600, color: C.fg, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }}>{children}</span>
    </div>
  );
}

export function ForgedCardBody({ f, t }: { f: number; t: T08 }) {
  const typing = f >= t.sel0 && f < t.type0 + 18;
  const v = forgedValue(f, t);
  const caretOn = f >= t.caret && f < t.back + 2 && (typing || Math.floor((f - t.caret) / 8) % 2 === 0);
  return (
    <div style={{ width: CARD_W, height: CARD_H, padding: `${TOP}px 40px`, boxSizing: "border-box", fontFamily: FONT }}>
      <div style={{ height: HEAD, display: "flex", alignItems: "center", gap: 12 }}>
        <MailIcon size={26} stroke={C.fg2} />
        <span style={{ fontSize: 22, fontWeight: 500, color: C.fg2 }}>booking.com</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 19, color: C.fg3 }}>to {FACTS.proofInbox}</span>
      </div>
      <div style={{ marginTop: 14, height: SUBJ, fontSize: 36, fontWeight: 600, letterSpacing: "-0.024em", color: C.fg, lineHeight: `${SUBJ}px` }}>
        Your booking is confirmed
      </div>
      <div style={{ marginTop: 20, height: 1, background: C.line }} />
      <div style={{ marginTop: 8 }}>
        <Fact k="Dates">{FACTS.proofDates}</Fact>
        <Fact k="Guests">{FACTS.proofGuests}</Fact>
        <Fact k="Total">
          {PREFIX.replace(/ /g, "\u00a0")}
          <span style={{ position: "relative" }}>
            {v.sel > 0 && <span style={{ position: "absolute", left: -2, top: 0, bottom: 0, width: `calc(${v.sel * 100}% + 4px)`, borderRadius: 5, background: hexA(C.fg, 0.22) }} />}
            <span style={{ position: "relative" }}>{v.digits}</span>
          </span>
          <span style={{ width: 3, height: 34, marginLeft: 3, borderRadius: 2, background: C.fg, opacity: caretOn ? 1 : 0 }} />
        </Fact>
      </div>
    </div>
  );
}
