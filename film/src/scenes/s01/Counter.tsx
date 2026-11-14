import React from "react";
import { C, DISPLAY, FONT, OE } from "../../tokens";
import { prog } from "../../lib/anim";

/* "$0 → $280 owed to Maya". The number steps up $40 at each step frame: the old value lifts and blurs away, then the new
   one rises in (the app's word-sweep feel), with a small scale kick. 120 px, weight 600, tabular figures. */
const STEP = 40;
const ROLL = 8;

function Num({ v, y, opacity, blur }: { v: number; y: number; opacity: number; blur: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        transform: `translate(-50%, ${y}px)`,
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        ...DISPLAY,
        fontSize: 120,
        lineHeight: 1,
        color: C.fg,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      ${v}
    </div>
  );
}

export function Counter({ f, steps, labelGap }: { f: number; steps: number[]; labelGap: number }) {
  const n = steps.filter((s) => f >= s).length;
  const last = n > 0 ? steps[n - 1] : -999;
  const r = prog(f, last, ROLL, OE);
  const kick = n > 0 ? 1 + 0.045 * (1 - prog(f, last, 14, OE)) : 1;
  const cur = n * STEP;
  const prev = Math.max(0, n - 1) * STEP;
  const rolling = n > 0 && r < 1;
  // The old value is mostly gone before the new one shows, so the two never sit on top of each other.
  const rOut = Math.min(1, r / 0.4);
  const rIn = Math.max(0, (r - 0.36) / 0.64);
  return (
    <div style={{ position: "relative", width: 420, height: 120 + labelGap + 38 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120, transform: `scale(${kick})`, transformOrigin: "50% 60%" }}>
        {rolling && rOut < 1 && <Num v={prev} y={-18 * rOut} opacity={1 - rOut} blur={7 * rOut} />}
        <Num v={cur} y={rolling ? 18 * (1 - rIn) : 0} opacity={rolling ? rIn : 1} blur={rolling ? 7 * (1 - rIn) : 0} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 120 + labelGap,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.012em",
          lineHeight: 1.2,
          color: C.due,
        }}
      >
        owed to Maya
      </div>
    </div>
  );
}
