import React from "react";
import { C, FONT, MONO, GLASS, FACTS, type PersonId, PEOPLE } from "../tokens";
import { Face } from "./LetterFace";
import { Badge, ChainTag, Wordmark, type BadgeKind } from "./Surfaces";
import { CHAIN_DOT } from "../tokens";

/* App-faithful pieces shared by several scenes and by the handoff poses. Sizes are film px. */

export const BEDS = [
  "Double room, window side",
  "Double room, courtyard side",
  "Bunk room A, top",
  "Bunk room A, bottom",
  "Bunk room B, top",
  "Bunk room B, bottom",
  "Loft single",
  "Sofa bed by the terrace",
] as const;

/** Illustrative draw result for the placeholder (the real Lisbon draw comes from OutLayer VRF in the footage). */
export const DRAWN: Record<number, string> = {
  1: "Loft single",
  2: "Bunk room B, top",
  3: "Double room, window side",
  4: "Sofa bed by the terrace",
  5: "Bunk room A, bottom",
  6: "Double room, courtyard side",
  7: "Bunk room A, top",
  8: "Bunk room B, bottom",
};

export type Row = {
  n: number;
  who: PersonId;
  status: BadgeKind | "pay";
  sub?: { kind: "chain"; chain: keyof typeof CHAIN_DOT } | { kind: "text"; text: string; color?: string } | { kind: "bed"; bed: string };
  you?: boolean;
};

/** The Lisbon trip's eight rows at the start of the film (apps/web/src/data/sample.ts). */
export const ROWS_START: Row[] = [
  { n: 1, who: "maya", status: "paid", sub: { kind: "chain", chain: "near" } },
  { n: 2, who: "sam", status: "paid", sub: { kind: "chain", chain: "base" } },
  { n: 3, who: "leo", status: "pay", sub: { kind: "text", text: "Held, not paid yet", color: C.due }, you: true },
  { n: 4, who: "ana", status: "paid", sub: { kind: "chain", chain: "solana" } },
  { n: 5, who: "tomas", status: "paid", sub: { kind: "chain", chain: "arbitrum" } },
  { n: 6, who: "jun", status: "paid", sub: { kind: "chain", chain: "base" } },
  { n: 7, who: "chloe", status: "paid", sub: { kind: "chain", chain: "near" } },
  { n: 8, who: "kofi", status: "paid", sub: { kind: "chain", chain: "ethereum" } },
];
/** After Leo pays (end of S03). */
export const ROWS_ALL_PAID: Row[] = ROWS_START.map((r) => (r.n === 3 ? { ...r, status: "paid", sub: { kind: "chain", chain: "base" }, you: false } : r));
/** After Ana's bed is resold to Priya (end of S04). */
export const ROWS_RESOLD: Row[] = ROWS_ALL_PAID.map((r) => (r.n === 4 ? { n: 4, who: "priya", status: "paid", sub: { kind: "text", text: "Bought from Ana at $40, face value", color: C.fg2 } } : r));
/** After the draw (end of S05). */
export const ROWS_DRAWN: Row[] = ROWS_RESOLD.map((r) => ({ ...r, sub: { kind: "bed", bed: DRAWN[r.n] } }));

export const ROW_H = 84;
export const LIST_W = 860;

export function BedRow({ row, highlight = 0, style }: { row: Row; highlight?: number; style?: React.CSSProperties }) {
  const p = PEOPLE[row.who];
  return (
    <div style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 18, padding: "0 20px", borderRadius: 22, background: `rgba(255,255,255,${0.05 * highlight})`, position: "relative", ...style }}>
      <Face id={row.who} size={52} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>{p.name}</span>
          {row.you && <span style={{ fontSize: 15, fontWeight: 600, color: C.you, background: "rgba(250,204,21,0.15)", borderRadius: 99, padding: "1px 9px" }}>you</span>}
          <span style={{ fontSize: 17, color: C.fg3, fontVariantNumeric: "tabular-nums" }}>bed {String(row.n).padStart(2, "0")}</span>
        </div>
        <div style={{ marginTop: 3, height: 24, display: "flex", alignItems: "center" }}>
          {row.sub?.kind === "chain" && <ChainTag chain={row.sub.chain} s={1.4} />}
          {row.sub?.kind === "text" && <span style={{ fontSize: 17.5, color: row.sub.color ?? C.fg2 }}>{row.sub.text}</span>}
          {row.sub?.kind === "bed" && <span style={{ fontSize: 17.5, color: C.fg }}>{row.sub.bed}</span>}
        </div>
      </div>
      {row.status === "pay" ? (
        <span style={{ height: 46, padding: "0 20px", borderRadius: 99, background: C.fg, color: C.void, fontFamily: FONT, fontWeight: 600, fontSize: 19, display: "inline-flex", alignItems: "center" }}>Pay $40</span>
      ) : (
        <Badge kind={row.status} s={1.45} />
      )}
    </div>
  );
}

/** "The beds" glass list (trip/spot-list.tsx), centred in its own box: width LIST_W, height 8*ROW_H + 16. */
export function BedList({ rows, highlightRow, style }: { rows: Row[]; highlightRow?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ ...GLASS, width: LIST_W, padding: 8, borderRadius: 30, ...style }}>
      {rows.map((r, i) => (
        <div key={r.n} style={{ position: "relative" }}>
          <BedRow row={r} highlight={highlightRow === r.n ? 1 : 0} />
          {i < rows.length - 1 && <div style={{ position: "absolute", bottom: 0, left: 90, right: 20, height: 1, background: C.line }} />}
        </div>
      ))}
    </div>
  );
}

/** The trip's own card (trip/card-sheet.tsx), at 640 x 404 by default. */
export function TripCard({ width = 640, last4 = "8087", style }: { width?: number; last4?: string; style?: React.CSSProperties }) {
  const k = width / 400; // app card is ~400 css px wide inside the 440 sheet
  return (
    <div
      style={{
        width,
        height: width / 1.586,
        borderRadius: 20 * k,
        padding: 20 * k,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: FONT,
        color: C.fg,
        background: "radial-gradient(120% 140% at 0% 0%, #2f2f2d 0%, #1a1a19 55%, #111110 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 30px 60px -30px rgba(0,0,0,.8)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Wordmark size={20 * k} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 * k, borderRadius: 99, background: "rgba(255,255,255,0.08)", padding: `${4 * k}px ${10 * k}px`, fontSize: 11.5 * k, color: C.fg2 }}>
          <svg width={14 * k} height={14 * k} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M12 4v6" /><path d="M2 18h20" /></svg>
          Hotels only
        </span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 19 * k, letterSpacing: "0.12em" }}>•••• •••• •••• {last4}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", fontSize: 12 * k, color: C.fg2 }}>
        <span>
          {FACTS.place.toUpperCase()} · {FACTS.tripCode}
          <br />
          <span style={{ color: C.fg }}>Single use</span>
        </span>
        <span style={{ textAlign: "right" }}>
          Limit
          <br />
          <span style={{ fontSize: 15 * k, fontWeight: 600, color: C.fg }}>${FACTS.pot}</span>
        </span>
      </div>
    </div>
  );
}

export type InboxItem = { from: string; subject: string; status: BadgeKind | "checking"; tone?: "ok" | "bad" };

/** The trip's inbox (proof-sheet.tsx upload step): the address row, then received emails. Width 1000 by default. */
export function InboxPanel({ items, width = 1000, style, children }: { items: InboxItem[]; width?: number; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div style={{ ...GLASS, width, padding: 28, borderRadius: 36, fontFamily: FONT, ...style }}>
      <div style={{ fontSize: 18, fontWeight: 500, color: C.fg2, marginBottom: 6 }}>The trip’s own inbox</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 22, background: "rgba(255,255,255,0.05)", padding: "18px 22px" }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.fg2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></svg>
        <span style={{ fontFamily: MONO, fontSize: 28, color: C.fg }}>{FACTS.inbox}</span>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, borderRadius: 22, background: "rgba(255,255,255,0.05)", padding: "16px 22px" }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={it.tone === "bad" ? C.refused : C.paid} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 24, fontWeight: 500, color: C.fg }}>{it.subject}</span>
            <span style={{ display: "block", fontSize: 18, color: C.fg3 }}>from {it.from}</span>
          </span>
          {it.status === "checking" ? <span style={{ fontSize: 19, color: C.fg2 }}>Checking…</span> : <Badge kind={it.status} s={1.5} />}
        </div>
      ))}
      {children}
    </div>
  );
}
