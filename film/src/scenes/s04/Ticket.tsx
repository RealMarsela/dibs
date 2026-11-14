import React from "react";
import { C, FONT, MONO } from "../../tokens";
import { GEO, K, TH, TS, TW, type TearState } from "./tear";

/* The resale sheet's tear ticket (resale-sheet.tsx "tear" step: background #232322, stub #2c2c2b, ink #ececea,
   edge rgba(255,255,255,.14)), drawn at film size TW x TH. The holder's face is drawn by the scene in screen space;
   the ticket keeps its slot (FACE_SPOT) and shows an empty ring while the bed changes hands. */
const BG = "#232322";
const STUB_BG = "#2c2c2b";
export const FACE_SPOT = { x: 16 * K + 11 * K, y: TH - 16 * K - 11 * K, size: 22 * K };

export type Flight = { dx: number; dy: number; s: number; o: number; ox: number; oy: number };

export function Ticket({
  st,
  ink = 1,
  ana = 1,
  priya = 0,
  ring = 0,
  stub = 1,
  flight,
  body = 1,
}: {
  st: TearState;
  ink?: number;
  ana?: number;
  priya?: number;
  ring?: number;
  stub?: number;
  flight?: Flight;
  body?: number;
}) {
  const deg = (st.theta * 180) / Math.PI;
  const { x: hx, y: hy } = GEO.hinge;
  return (
    <div style={{ position: "relative", width: TW, height: TH, color: C.fg, fontFamily: FONT }}>
      {/* body */}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${st.bx}px)`, opacity: body }}>
        <svg width={TW} height={TH} viewBox={`0 0 ${TW} ${TH}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d={GEO.bodyOutline} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />
        </svg>
        <div style={{ position: "absolute", inset: 0, background: BG, clipPath: `path('${GEO.body}')` }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: TW - TS,
              padding: 16 * K,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              opacity: ink,
            }}
          >
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10 * K, lineHeight: 1.5, textTransform: "uppercase", letterSpacing: "0.16em", opacity: 0.6 }}>Bed 04</div>
              <div style={{ fontSize: 30 * K, fontWeight: 800, textTransform: "uppercase", lineHeight: 1, letterSpacing: "-0.04em" }}>Lisbon</div>
              <div style={{ marginTop: 4 * K, fontSize: 13 * K, lineHeight: 1.5, opacity: 0.7 }}>12 Mar – 15 Mar</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 * K, height: 22 * K }}>
              <div
                style={{
                  width: 22 * K,
                  height: 22 * K,
                  borderRadius: 99,
                  boxSizing: "border-box",
                  border: `${2}px dashed rgba(255,255,255,${0.28 * ring})`,
                  flexShrink: 0,
                }}
              />
              <div style={{ position: "relative", fontSize: 14 * K, fontWeight: 600, lineHeight: 1 }}>
                <span style={{ opacity: ana }}>Ana</span>
                <span style={{ position: "absolute", left: 0, top: 0, opacity: priya }}>Priya</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* the fibres between body and stub while the perforation stretches */}
      <svg width={TW} height={TH} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: stub }}>
        {st.fibres.map((fb, i) =>
          fb.o > 0 ? (
            <g key={i} opacity={fb.o}>
              <path d={fb.near} fill="none" stroke={BG} strokeWidth={fb.w} strokeLinecap="round" />
              <path d={fb.far} fill="none" stroke={BG} strokeWidth={fb.w} strokeLinecap="round" />
            </g>
          ) : null,
        )}
      </svg>
      {/* stub */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: stub * (flight ? flight.o : 1),
          transformOrigin: flight ? `${flight.ox}px ${flight.oy}px` : undefined,
          transform: flight ? `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.s})` : undefined,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${hx}px ${hy}px`, transform: `translate(${st.sx}px, ${st.sy}px) rotate(${deg}deg)` }}>
          <svg width={TW} height={TH} viewBox={`0 0 ${TW} ${TH}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <path d={GEO.stubOutline} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />
          </svg>
          <div style={{ position: "absolute", inset: 0, background: STUB_BG, clipPath: `path('${GEO.stub}')` }}>
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: TS,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4 * K,
                textAlign: "center",
                opacity: ink,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10 * K, textTransform: "uppercase", letterSpacing: "0.16em", opacity: 0.6 }}>Face value</div>
              <div style={{ fontFamily: MONO, fontSize: 24 * K, fontWeight: 600, lineHeight: 1.1 }}>$40</div>
              <div style={{ fontSize: 11 * K, opacity: 0.6 }}>tear to sell</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
