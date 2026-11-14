import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, EASE } from "../tokens";

/* ProgressSteps (apps/web/src/components/trip/steps.tsx): ReUI vertical stepper. Done steps get a green disc with a check,
   the active one spins, the rest are grey. `doneAt[i]` = frame when step i completes. Scale `s` = film px per app px. */
export function Steps({ steps, doneAt, s = 2, style }: { steps: { title: string; sub?: string }[]; doneAt: number[]; s?: number; style?: React.CSSProperties }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {steps.map((st, i) => {
        const done = frame >= doneAt[i];
        const active = !done && (i === 0 || frame >= doneAt[i - 1]);
        const p = interpolate(frame, [doneAt[i], doneAt[i] + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        const d = 24 * s;
        return (
          <div key={i} style={{ display: "flex", gap: 12 * s, alignItems: "flex-start", paddingBottom: i < steps.length - 1 ? 20 * s : 0, position: "relative" }}>
            {i < steps.length - 1 && (
              <div style={{ position: "absolute", left: d / 2 - s / 2, top: d + 4 * s, bottom: 4 * s, width: s, background: done ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.1)" }} />
            )}
            <div
              style={{
                width: d,
                height: d,
                borderRadius: 99,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                background: done ? C.paid : active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
                transform: `scale(${done ? 1 + Math.sin(p * Math.PI) * 0.12 : 1})`,
              }}
            >
              {done ? (
                <svg width={14 * s} height={14 * s} viewBox="0 0 24 24" fill="none" stroke={C.void} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : active ? (
                <svg width={14 * s} height={14 * s} viewBox="0 0 24 24" fill="none" stroke={C.fg} strokeWidth={2.5} strokeLinecap="round" style={{ transform: `rotate(${frame * 12}deg)` }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : null}
            </div>
            <div style={{ marginTop: 2 * s, display: "flex", flexDirection: "column", gap: 4 * s }}>
              <span style={{ fontFamily: FONT, fontSize: 14.5 * s, fontWeight: 500, color: done || active ? C.fg : C.fg3 }}>{st.title}</span>
              {st.sub && <span style={{ fontFamily: FONT, fontSize: 12 * s, color: C.fg3 }}>{st.sub}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
