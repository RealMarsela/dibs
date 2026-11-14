import React from "react";
import { C, FONT, EASE } from "../../tokens";
import { hexA } from "../../components/Surfaces";
import { prog } from "../../lib/anim";
import { bump } from "./poses";
import { CheckIcon, Spinner, XIcon } from "./icons";

/* Placeholder for FootageSlot "card": the card sheet's "Try it" rows (trip/card-sheet.tsx) at 2x, laid out where the
   crop {x 756, y 600, w 408, h 176} of the 1920 x 1080 recording should put them, so footage can replace it 1:1.
   `f` is the scene's local frame (passed in, so a Sequence offset for the footage never shifts these beats). */
const S = 2;

function ResultBadge({ ok, f, at }: { ok: boolean; f: number; at: number }) {
  const c = ok ? C.paid : C.refused;
  const p = prog(f, at, 10, EASE);
  const shake = ok ? 0 : Math.sin((f - at) * 1.7) * 7 * (1 - prog(f, at, 16));
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4 * S,
        borderRadius: 999,
        padding: `${4 * S}px ${10 * S}px`,
        fontSize: 12 * S,
        lineHeight: `${18 * S}px`,
        fontWeight: 600,
        color: c,
        background: hexA(c, 0.15 + 0.12 * bump(f, at, 14)),
        opacity: p,
        transform: `translateX(${shake}px) scale(${0.85 + 0.15 * p})`,
        whiteSpace: "nowrap",
      }}
    >
      {ok ? <CheckIcon size={14 * S} color={c} stroke={2.4} /> : <XIcon size={14 * S} color={c} stroke={2.4} />}
      {ok ? "Approved" : "Declined"}
    </span>
  );
}

function TryRow({ f, title, sub, press, result, ok }: { f: number; title: string; sub: string; press: number; result: number; ok: boolean }) {
  const pr = bump(f, press, 9);
  const busy = f >= press + 3 && f < result;
  const done = f >= result;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12 * S,
        borderRadius: 16 * S,
        background: `rgba(255,255,255,${0.05 + 0.04 * pr})`,
        padding: `${12 * S}px ${14 * S}px`,
        transform: `scale(${1 - 0.02 * pr})`,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14 * S, lineHeight: `${20 * S}px`, fontWeight: 500, color: C.fg }}>{title}</span>
        <span style={{ display: "block", fontSize: 12 * S, lineHeight: `${16 * S}px`, color: C.fg3 }}>{sub}</span>
      </span>
      {done ? (
        <ResultBadge ok={ok} f={f} at={result} />
      ) : busy ? (
        <Spinner size={16 * S} color={C.fg2} turn={f * 14} />
      ) : (
        <span style={{ fontSize: 12.5 * S, color: C.fg2 }}>Charge $320</span>
      )}
    </div>
  );
}

export function TryRows({ f, pressA, okA, pressB, noB }: { f: number; pressA: number; okA: number; pressB: number; noB: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.glass, fontFamily: FONT }}>
      <div style={{ position: "absolute", left: 13 * S, top: 14 * S, width: 382 * S }}>
        <div style={{ fontSize: 12 * S, lineHeight: `${16 * S}px`, fontWeight: 500, color: C.fg2, marginBottom: 8 * S }}>Try it</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 * S }}>
          <TryRow f={f} title="Carlton City Hotel SG" sub="Hotel · MCC 7011" press={pressA} result={okA} ok />
          <TryRow f={f} title="VoltCity Electronics" sub="Electronics · MCC 5732" press={pressB} result={noB} ok={false} />
        </div>
      </div>
    </div>
  );
}
