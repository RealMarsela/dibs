import React from "react";
import { AbsoluteFill, Easing, spring, useVideoConfig } from "remotion";
import { World } from "../components/World";
import { Face, idle } from "../components/LetterFace";
import { H1 } from "../handoffs";
import { SCENES, useScene } from "../scene";
import { C, EASE, IN_OUT_STRONG, OE, SPRING } from "../tokens";
import { lerp, prog } from "../lib/anim";
import { ChatBubble, Place } from "./s01/Bubble";
import { Counter } from "./s01/Counter";
import { CAM_START, COUNTER, FACE, MAYA_BUBBLE, PULL_END, REPLIES, RING_CENTRE } from "./s01/layout";

/* S01 Hook: pay me later (0-228). Frame 0 is the thumbnail: Maya's face and her "send when you can" bubble, close.
   The camera pulls back while seven "pay you later" replies pop in around her in a loose ring and the counter under
   her climbs $40 a reply to $280 by "chasing". Hold: the ring creeps in on her. Out: everything pops away in reverse,
   the counter blurs up, and Maya eases to H1 (132 px at (960, 420)). */
const DUR = SCENES.S01.to - SCENES.S01.from;
const PULL = Easing.bezier(0.3, 0.5, 0.4, 1); // starts moving at once, glides to rest
const POP = 4; // frames from a bubble's arrival to its counter step

export const S01: React.FC = () => {
  const { f, A, cue, cueEnd } = useScene();
  const { fps } = useVideoConfig();
  if (f >= DUR - 1) return <World><H1 /></World>;

  // Timing, all from narration: replies run from just after "Every" to just before "chasing", so $280 lands on it.
  const first = cue("L01", "Every") + 6;
  const lastIn = cue("L01", "chasing") - 10;
  const arrive = REPLIES.map((_, i) => Math.round(lerp(first, lastIn, i / (REPLIES.length - 1))));
  const steps = arrive.map((t) => t + POP);
  const counterIn = cue("L01", "Every") + 1;
  const out = cueEnd("L01", "money") - 5; // outro starts as "money" finishes

  // Camera: 1.3x on Maya → 1.0 by PULL_END, then a slow sideways drift that is back to rest on the last frame.
  const pp = prog(f, 0, PULL_END, PULL);
  const s = lerp(CAM_START.s, 1, pp);
  const u = Math.min(1, Math.max(0, (f - 40) / (DUR - 1 - 40)));
  const drift = Math.sin(Math.PI * u) ** 2;
  const fx = lerp(CAM_START.x, 960, pp) + 9 * drift;
  const fy = lerp(CAM_START.y, 540, pp) - 4 * drift;
  const camera = `translate(960px, 540px) scale(${s}) translate(${-fx}px, ${-fy}px)`;

  // Hold: the ring creeps in toward Maya.
  const creep = 1 - 0.028 * prog(f, lastIn, out - lastIn, IN_OUT_STRONG);

  // Outro: replies leave in reverse order, then Maya's own bubble; the counter blurs up; Maya settles to H1.
  const exitAt = (k: number) => out + k * 2; // k = 0 for the last reply to arrive
  const leave = (t0: number) => prog(f, t0, 10, OE);
  const settle = prog(f, out, DUR - 1 - out, EASE);
  const faceSize = lerp(FACE.size, FACE.endSize, settle);
  const g = faceSize / FACE.endSize;
  const idleAmp = 1 - prog(f, out, 22, EASE);
  const cOut = prog(f, out + 3, 12, OE);
  const cIn = prog(f, counterIn, 16, OE);

  return (
    <World>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: camera, transformOrigin: "0 0" }}>
          {/* Counter under her */}
          <div
            style={{
              position: "absolute",
              left: COUNTER.x - 210,
              top: COUNTER.y - 60,
              opacity: cIn * (1 - cOut),
              filter: cIn < 1 || cOut > 0 ? `blur(${8 * (1 - cIn) + 10 * cOut}px)` : undefined,
              transform: `translateY(${8 * (1 - cIn) - 14 * cOut}px)`,
            }}
          >
            <Counter f={f} steps={steps} labelGap={COUNTER.labelY - COUNTER.y - 60 - 18} />
          </div>

          {/* Maya's own message, at 12 o'clock */}
          {(() => {
            const q = leave(exitAt(REPLIES.length));
            const fl = Math.sin(((A + 30) / 118) * Math.PI * 2) * 3;
            return (
              <Place
                x={MAYA_BUBBLE.x}
                y={lerp(RING_CENTRE.y, MAYA_BUBBLE.y, creep) + fl}
                transform={`scale(${1 - 0.15 * q})`}
                opacity={1 - q}
                filter={q > 0 ? `blur(${6 * q}px)` : undefined}
              >
                <ChatBubble from="maya" face={false}>
                  <div>Booked the Alfama flat.</div>
                  <div>It’s $40 each, send when you can</div>
                </ChatBubble>
              </Place>
            );
          })()}

          {/* The seven replies */}
          {REPLIES.map((r, i) => {
            const t = arrive[i];
            if (f < t) return null;
            const sp = spring({ frame: f - t, fps, config: SPRING });
            const op = prog(f, t, 6, OE);
            const q = leave(exitAt(REPLIES.length - 1 - i));
            if (q >= 1) return null;
            const dx = r.x - RING_CENTRE.x;
            const dy = r.y - RING_CENTRE.y;
            const d = Math.hypot(dx, dy);
            const push = (1 - sp) * 34; // arrives from outside the ring, settling in toward her
            const ph = i * 37;
            const x = RING_CENTRE.x + dx * creep + (dx / d) * push + Math.cos(((A + ph) / (104 + i * 9)) * Math.PI * 2) * 2.5;
            const y = RING_CENTRE.y + dy * creep + (dy / d) * push + Math.sin(((A + ph) / (96 + i * 11)) * Math.PI * 2) * 3.5;
            const blur = 8 * (1 - op) + 6 * q;
            return (
              <Place
                key={r.id}
                x={x}
                y={y}
                transform={`scale(${(0.72 + 0.28 * sp) * (1 - 0.15 * q)})`}
                opacity={op * (1 - q)}
                filter={blur > 0.05 ? `blur(${blur}px)` : undefined}
              >
                <ChatBubble from={r.id}>{r.text}</ChatBubble>
              </Place>
            );
          })}

          {/* Maya, the booker */}
          <Place x={FACE.x} y={FACE.y} transform={idleAmp > 0.001 ? idle(A, "maya", idleAmp) : ""}>
            <Face
              id="maya"
              size={faceSize}
              ring={C.void}
              style={{ boxShadow: `0 0 0 ${6 * g}px ${C.void}, 0 ${24 * g}px ${64 * g}px ${-14 * g}px rgba(251,146,60,0.55)` }}
            />
          </Place>
        </div>
      </AbsoluteFill>
    </World>
  );
};
