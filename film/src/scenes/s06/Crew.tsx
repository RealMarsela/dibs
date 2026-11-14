import React from "react";
import { AbsoluteFill, spring } from "remotion";
import { C, SPRING } from "../../tokens";
import { Face, idle } from "../../components/LetterFace";
import { ROWS_DRAWN } from "../../components/Trip";
import { lerp, prog } from "../../lib/anim";
import { GATHER, mayaPose, SLOT, SLOT_SIZE, type CardPose, type Times } from "./poses";
import { LockIcon } from "./icons";

/* The eight faces lifted out of H5. Maya grows and moves left of centre; the other seven settle in a soft arc behind
   her (void rings, like the app's face stacks), then fade while the pot goes into the enclave. Maya later docks on the
   card's corner with a lock badge, and leaves just before H6. */

const ARC = [190, 157, 123, 90, 57, 23, -10].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * 150, -Math.sin(a) * 150] as const;
});

const At = ({ x, y, children, style }: { x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", ...style }}>{children}</div>
);

export function Crew({ f, A, T, card, end }: { f: number; A: number; T: Times; card: CardPose; end: number }) {
  const ids = ROWS_DRAWN.map((r) => r.who);
  const m = mayaPose(f, T, card);
  const pB = prog(f, 100, 36);
  const crewO = 1 - prog(f, 112, 28);
  const ring = prog(f, 10, 16);
  const amp = prog(f, 4, 30);
  const out = prog(f, end - 36, 16);
  const lockT = T.passkey - 8;
  const lock = f < lockT ? 0 : spring({ frame: f - lockT, fps: 30, config: SPRING });
  const badge = Math.max(30, m.size * 0.44);
  return (
    <AbsoluteFill>
      {crewO > 0 &&
        ids.slice(1).map((id, j) => {
          const sl = SLOT(j + 1);
          const pA = prog(f, 6 + j * 1.5, 36, GATHER);
          const k = lerp(1, 0.86, pB);
          const x = lerp(sl.x, m.bx + ARC[j][0] * k, pA);
          const y = lerp(sl.y, m.by + ARC[j][1] * k, pA);
          const size = lerp(SLOT_SIZE, lerp(84, 72, pB), pA);
          return (
            <At key={id} x={x} y={y} style={{ opacity: crewO }}>
              <div style={{ transform: amp > 0 ? idle(A, id, amp) : undefined }}>
                <Face id={id} size={size} style={{ boxShadow: ring > 0 ? `0 0 0 ${ring * size * 0.06}px ${C.void}` : undefined }} />
              </div>
            </At>
          );
        })}
      {out < 1 && (
        <At x={m.x} y={m.y} style={{ opacity: 1 - out }}>
          <div style={{ transform: `${amp > 0 ? idle(A, "maya", amp * (1 - 0.75 * m.dock)) : ""} scale(${1 - 0.4 * out})`, position: "relative" }}>
            <Face id="maya" size={m.size} style={{ boxShadow: ring > 0 ? `0 0 0 ${ring * Math.max(4, m.size * 0.06)}px ${C.void}` : undefined }} />
            {lock > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: m.size * 0.86 - badge / 2,
                  top: m.size * 0.86 - badge / 2,
                  width: badge,
                  height: badge,
                  borderRadius: 99,
                  background: C.raise,
                  boxShadow: `0 0 0 3px ${C.void}`,
                  display: "grid",
                  placeItems: "center",
                  transform: `scale(${lock})`,
                }}
              >
                <LockIcon size={badge * 0.53} color={C.fg} stroke={2.2} />
              </div>
            )}
          </div>
        </At>
      )}
    </AbsoluteFill>
  );
}
