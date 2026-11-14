import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { Centre } from "../../handoffs";
import { Display } from "../../components/Surfaces";
import { C, EASE, OE } from "../../tokens";
import { prog } from "../../lib/anim";
import type { Times } from "./timing";

/* The H2 pose, animated: same DOM as handoffs.tsx H2 (Display line + Meter markup) so that once every animation has
   finished it is pixel-identical to <H2/>. Local Meter variant: per-cell fill, hatch opacity, and a ring that
   collapses onto bed 03. Rendered 2D under the same camera scale `s` as the stage (identity on the last frame). */
const HELD = 2;
const CW = (1200 - 12 * 7) / 8;
const LINE1 = ["7", "of", "8", "paid."];
const LINE2 = ["1", "to", "go", "before", "anyone", "can", "book."];

function Word({ f, at, children }: { f: number; at: number; children: string }) {
  const p = interpolate(f, [at, at + 16.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OE });
  return (
    // Inline (not inline-block) so the line lays out exactly like H2's plain text; the lift uses relative `top`.
    <span style={{ position: "relative", top: (1 - p) * 10, opacity: p, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined }}>
      {children}
    </span>
  );
}

function words(list: string[], f: number, t0: number, step: number) {
  return list.map((w, j) => (
    <React.Fragment key={j}>
      {j > 0 && " "}
      <Word f={f} at={t0 + j * step}>{w}</Word>
    </React.Fragment>
  ));
}

export function FinalLayer({ f, T, s }: { f: number; T: Times; s: number }) {
  const ring = prog(f, T.ring, 14, EASE);
  return (
    <AbsoluteFill style={{ transform: Math.abs(s - 1) > 0.0004 ? `scale(${s})` : undefined, transformOrigin: "960px 540px" }}>
      {f >= T.line1 && (
        <Centre cx={960} cy={500}>
          <Display size={60} style={{ whiteSpace: "nowrap" }}>
            {f >= T.line2 + (LINE2.length - 1) * 2.5 + 17 ? (
              /* every word landed: the exact text nodes of H2 (split spans shape a glyph 1 px differently) */
              <>7 of 8 paid. <span style={{ color: C.fg2 }}>1 to go before anyone can book.</span></>
            ) : (
              <>{words(LINE1, f, T.line1, 3)} <span style={{ color: C.fg2 }}>{words(LINE2, f, T.line2, 2.5)}</span></>
            )}
          </Display>
        </Centre>
      )}
      <Centre cx={960} cy={620}>
        <div style={{ display: "flex", gap: 12, width: 1200 }}>
          {Array.from({ length: 8 }, (_, i) => {
            const at = T.fill + 2 * i;
            const fill = i === HELD ? 0 : interpolate(f, [at, at + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
            const hatch = i === HELD ? prog(f, at, 12, EASE) : 0;
            const shadow =
              i === HELD && ring > 0
                ? `0 0 0 3px ${ring < 1 ? `rgba(14,14,14,${ring})` : C.void}, 0 0 0 ${5 + 10 * (1 - ring)}px rgba(251,146,60,${0.55 * ring})`
                : undefined;
            return (
              <div key={i} style={{ position: "relative", width: CW, height: 22, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.07)", boxShadow: shadow }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgb(236, 236, 234)", transform: `scaleX(${fill})`, transformOrigin: "left" }} />
                {i === HELD && hatch > 0 && (
                  <div style={{ position: "absolute", inset: 0, opacity: 0.6 * hatch, background: `repeating-linear-gradient(135deg, ${C.due} 0 4px, transparent 4px 12px)` }} />
                )}
              </div>
            );
          })}
        </div>
      </Centre>
    </AbsoluteFill>
  );
}
