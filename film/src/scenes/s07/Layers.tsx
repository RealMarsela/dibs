import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FACTS, FONT, GLASS, INBOX_SCALE } from "../../tokens";
import { InboxPanel, type InboxItem } from "../../components/Trip";

/* 2D pieces of S07 (outside the 3D Stage so they land pixel-identical on the H7 pose). */

/* The real InboxPanel with H7's exact DOM (centred box, then a scale(INBOX_SCALE) wrapper), its children driven by CSS
   vars so the label, address row and email row can assemble one by one, and the row can glow once if the proof is
   accepted. Every var at rest = H7. */
const CSS = [
  ".s07-inbox > div > div:nth-child(1){opacity:var(--lab)}",
  ".s07-inbox > div > div:nth-child(2){opacity:var(--addr)}",
  ".s07-inbox > div > div:nth-child(3){opacity:var(--row);transform:translateY(var(--rowy));",
  "box-shadow:0 0 0 calc(var(--glow) * 2px) rgba(52,211,153,calc(var(--glow) * 0.5)),0 0 calc(var(--glow) * 56px) rgba(52,211,153,calc(var(--glow) * 0.22))}",
].join("");

export type InboxLook = { o: number; s: number; blur: number; lab: number; addr: number; row: number; rowY: number; glow: number; status: InboxItem["status"] };

export function InboxLayer({ look, camT }: { look: InboxLook; camT: string }) {
  const vars = { "--lab": look.lab, "--addr": look.addr, "--row": look.row, "--rowy": `${look.rowY}px`, "--glow": look.glow } as React.CSSProperties;
  return (
    <AbsoluteFill style={{ transform: camT }}>
      <div style={{ position: "absolute", left: 960, top: 540, transform: "translate(-50%, -50%)", opacity: look.o, filter: look.blur > 0.05 ? `blur(${look.blur}px)` : undefined }}>
        <div className="s07-inbox" style={{ transform: `scale(${INBOX_SCALE * look.s})`, ...vars }}>
          <style>{CSS}</style>
          <InboxPanel address={FACTS.proofInbox} items={[{ from: "booking.com", subject: "Your booking is confirmed", status: look.status }]} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** "Trip SIN-1025 · a real booking": tells viewers this is a different, real trip (not the Lisbon story trip). */
export function TripChip() {
  return (
    <div style={{ ...GLASS, borderRadius: 999, height: 70, padding: "0 32px", display: "inline-flex", alignItems: "center", gap: 16, fontFamily: FONT, fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      <span style={{ width: 12, height: 12, borderRadius: 99, background: C.fg }} />
      <span style={{ color: C.fg }}>Trip {FACTS.proofTrip}</span>
      <span style={{ color: C.fg2 }}>· a real booking</span>
    </div>
  );
}
