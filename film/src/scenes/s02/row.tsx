import React from "react";
import { Easing, interpolate } from "remotion";
import { Face, idle } from "../../components/LetterFace";
import { Sweep } from "../../components/Sweep";
import { C, EASE, FACTS, type PersonId } from "../../tokens";
import { lerp, prog } from "../../lib/anim";
import { FACE_Y, slotX } from "./tile";
import type { Times } from "./timing";

const CREW: PersonId[] = ["sam", "leo", "ana", "tomas", "jun", "chloe", "kofi"];
const ROW_FACE = 80;
const CSS_EIO = Easing.bezier(0.42, 0, 0.58, 1);
const LIFT = Easing.bezier(0.4, 0, 0.7, 0.5);

/** motion.css hello-bob at film scale (2.5 CSS px x 132/104): 0 -> -1 over 0.95 s, then -1 <-> 1 every 1.9 s. */
function helloBob(f: number): number {
  const a = 3.2;
  const t0 = 1;
  const inDur = 28.5;
  if (f <= t0) return 0;
  if (f < t0 + inDur) return -a * CSS_EIO((f - t0) / inDur);
  const tau = f - t0 - inDur;
  const n = Math.floor(tau / 57);
  let p = (tau - n * 57) / 57;
  if (n % 2 === 1) p = 1 - p;
  return -a + 2 * a * CSS_EIO(p);
}

function Pos({ x, y, size, style, children }: { x: number; y: number; size: number; style?: React.CSSProperties; children: React.ReactNode }) {
  return <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, ...style }}>{children}</div>;
}

/** Maya: H1 pose (132 px at stage (0,-120), orange glow) -> bobbing -> flies to slot 0 of the row -> lifts and fades. */
export function Maya({ f, A, T }: { f: number; A: number; T: Times }) {
  const m = prog(f, T.mayaGo, 34, EASE);
  const size = lerp(132, ROW_FACE, m);
  const k = size / 132;
  const x = lerp(0, slotX(0), m);
  const y = lerp(-120, FACE_Y, m) - 20 * Math.sin(Math.PI * m);
  const out = prog(f, T.facesOut, 22, LIFT);
  const glow = 0.55 * (1 - 0.6 * m);
  return (
    <Pos x={x} y={y - 40 * out} size={size} style={{ opacity: 1 - out }}>
      <div style={{ transform: idle(A, "maya", m) }}>
        <div style={{ transform: `translateY(${helloBob(f) * (1 - m)}px)` }}>
          <Face
            id="maya"
            size={size}
            ring={C.void}
            style={{ boxShadow: `0 0 0 ${6 * k}px ${C.void}, 0 ${24 * k}px ${64 * k}px ${-14 * k}px rgba(251,146,60,${glow})` }}
          />
        </div>
      </div>
    </Pos>
  );
}

/** The seven crew faces rise from below into slots 1..7 (cf-up style: from below with tilt), bob, then lift and fade. */
export function Crew({ f, A, T }: { f: number; A: number; T: Times }) {
  return (
    <>
      {CREW.map((id, j) => {
        const k = j + 1;
        const t0 = T.crew + 3 * k;
        if (f < t0) return null;
        const p = interpolate(f, [t0, t0 + 28], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const from = 560 + (k % 3) * 50;
        const tilt = (k % 2 ? 1 : -1) * (6 + (k % 4) * 2);
        const out = prog(f, T.facesOut + 2 * k, 22, LIFT);
        return (
          <Pos key={id} x={slotX(k)} y={FACE_Y - 40 * out} size={ROW_FACE} style={{ opacity: Math.min(1, p * 1.4) * (1 - out) }}>
            <div style={{ transform: `translateY(${from * (1 - p)}px) rotate(${tilt * (1 - p)}deg)` }}>
              <div style={{ transform: idle(A, id, p) }}>
                <Face id={id} size={ROW_FACE} ring={C.void} />
              </div>
            </div>
          </Pos>
        );
      })}
    </>
  );
}

/** "Lisbon" + the stay line above the row. */
export function Heading({ T }: { T: Times }) {
  const sub = `${FACTS.stay}. ${FACTS.dates}, ${FACTS.nights} nights.`;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: -244, transform: "translate(-50%, -50%)", whiteSpace: "nowrap" }}>
        <Sweep lines={[{ text: FACTS.place, at: [T.lisbon] }]} size={88} out={T.headingOut} outDur={12} style={{ whiteSpace: "nowrap" }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: -172, transform: "translate(-50%, -50%)", whiteSpace: "nowrap" }}>
        <Sweep lines={[{ text: sub, tone: "fg2" }]} start={T.lisbon + 6} stagger={1.5} size={30} out={T.headingOut + 2} outDur={12} style={{ whiteSpace: "nowrap" }} />
      </div>
    </>
  );
}
