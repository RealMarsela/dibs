import React from "react";
import { C, FONT, MONO, FACTS } from "../../tokens";
import { MailIcon } from "./Rows";
import { FORGED_TOTAL, type T08 } from "./data";

/* The forged copy of the booking email, opened up: sender, subject, then the three facts friends see.
   On "forges" the total is retyped from $320 to $3,200 with a visible caret. Natural size CARD_W x CARD_H. */
export const CARD_W = 860;
export const CARD_H = 350;
const TOP = 32;
const HEAD = 30;
const SUBJ = 44;
const FACT = 56;
/** y of the Total row's centre, measured from the card's top edge. */
export const TOTAL_Y = TOP + HEAD + 14 + SUBJ + 20 + 1 + 8 + FACT * 2 + FACT / 2;

/** What the total line reads at frame f: "$320", deleted key by key, then "$3,200" typed key by key. */
export function forgedValue(f: number, t: T08): string {
  const orig = `$${FACTS.pot}`;
  if (f < t.del0) return orig;
  const dels = Math.min(3, Math.floor((f - t.del0) / 2) + 1);
  if (f < t.type0) return orig.slice(0, orig.length - dels);
  const typed = Math.min(5, Math.floor((f - t.type0) / 2) + 1);
  return "$" + FORGED_TOTAL.slice(1, 1 + typed);
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
  const typing = f >= t.del0 && f < t.type0 + 10;
  const caretOn = f >= t.caret && f < t.back + 2 && (typing || Math.floor((f - t.caret) / 8) % 2 === 0);
  return (
    <div style={{ width: CARD_W, height: CARD_H, padding: `${TOP}px 40px`, boxSizing: "border-box", fontFamily: FONT }}>
      <div style={{ height: HEAD, display: "flex", alignItems: "center", gap: 12 }}>
        <MailIcon size={26} stroke={C.fg2} />
        <span style={{ fontSize: 22, fontWeight: 500, color: C.fg2 }}>booking.com</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 19, color: C.fg3 }}>to {FACTS.inbox}</span>
      </div>
      <div style={{ marginTop: 14, height: SUBJ, fontSize: 36, fontWeight: 600, letterSpacing: "-0.024em", color: C.fg, lineHeight: `${SUBJ}px` }}>
        Your booking is confirmed
      </div>
      <div style={{ marginTop: 20, height: 1, background: C.line }} />
      <div style={{ marginTop: 8 }}>
        <Fact k="Dates">{FACTS.dates}</Fact>
        <Fact k="Guests">{FACTS.beds}</Fact>
        <Fact k="Total">
          {forgedValue(f, t)}
          <span style={{ width: 3, height: 34, marginLeft: 3, borderRadius: 2, background: C.fg, opacity: caretOn ? 1 : 0 }} />
        </Fact>
      </div>
    </div>
  );
}
