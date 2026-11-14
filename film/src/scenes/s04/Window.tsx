import React from "react";
import { AbsoluteFill, Sequence, spring } from "remotion";
import { EASE, IN_OUT_STRONG, OUT_STRONG } from "../../tokens";
import { AppWindow, FootageSlot } from "../../components/Footage";
import { ROW_HS, ROW_W } from "./List";
import { lerp, prog } from "../../lib/anim";
import { cropFor, ResaleSheet, Stamp, WIN_H_ASK, WIN_H_REF, WIN_R, WIN_W } from "./Sheet";
import { LIST_SCALE } from "../../tokens";
import type { TT } from "./time";

/* Ana's row grows into the resale window (footage slot `resale`); the refusal stamp lands on its corner on "refuses";
   then the window recedes for the meter and slides away left. */
/** Camera push into Ana's row, on top of the list's own LIST_SCALE. */
export const PUSH_S = 1.15;
/* public/footage/resale.mp4 (take 2, lis0314, 24 fps, 11.5 s; measured, given here in 30 fps frames as startFrom wants):
   dialog open at 87.5 (2.92 s), "Get my $40 back" clicked and the Refused card shown at 135 (4.50 s), "Asking the
   contract…" until 219, "Contract answered E_NO_REFUND" from 220 (7.33 s) to the end (346).
   Two uses of the clip: the click lands on "refund", then (while the card sits still) a hidden jump so the chain's
   answer appears just before the stamp on "refuses". */
const CLIP_REFUSED = 135;
const CLIP_ANSWER = 220;

export function WindowGroup({ T }: { T: TT }) {
  const { f } = T;
  const grow = prog(f, T.win, 22, OUT_STRONG);
  const rec = prog(f, T.recede, 26, EASE);
  const away = prog(f, T.away, 28, IN_OUT_STRONG);
  const u = f - T.stamp;
  const impact = u >= 0 && u <= 8 ? Math.sin((u / 8) * Math.PI) : 0;
  const drift = 3 * Math.sin(f / 36);
  const scale = (1 - 0.5 * rec) * (1 - 0.012 * impact);
  const cx = 960 - 1560 * away;
  const cy = 540 - 210 * rec + drift * (1 - rec);
  const op = (1 - 0.6 * rec) * (1 - away * 0.6);
  const blur = 3 * rec;

  // row → window morph box (the row is at PUSH_S, centred on screen)
  const bw = lerp(ROW_W * PUSH_S, WIN_W, grow);
  const bh = lerp(ROW_HS * PUSH_S, WIN_H_ASK, grow);
  const br = lerp(22 * LIST_SCALE * PUSH_S, WIN_R, grow);
  const boxA = prog(f, T.win, 10);
  const winO = prog(f, T.win + 10, 6);

  const jump = T.step + 24;
  const winH = lerp(WIN_H_ASK, WIN_H_REF, prog(f, T.step - 1, 6, OUT_STRONG));
  const sp = u >= 0 ? spring({ frame: u, fps: 30, config: { damping: 13, stiffness: 210 } }) : 0;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${cx - 960}px, ${cy - 540}px) scale(${scale})`,
        transformOrigin: "960px 540px",
        opacity: op,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      {winO < 1 && (
        <div
          style={{
            position: "absolute",
            left: 960 - bw / 2,
            top: 540 - bh / 2,
            width: bw,
            height: bh,
            borderRadius: br,
            background: `rgba(14,14,14,${boxA})`,
            border: `1px solid rgba(255,255,255,${0.14 * boxA})`,
            boxShadow: `0 40px 120px -30px rgba(0,0,0,${0.9 * grow})`,
          }}
        />
      )}
      {f >= T.win + 9 && (
        <div style={{ position: "absolute", left: 960 - WIN_W / 2, top: 540 - winH / 2, opacity: winO }}>
          <AppWindow width={WIN_W} height={winH} radius={WIN_R}>
            <Sequence from={T.win} durationInFrames={jump - T.win} layout="none">
              <FootageSlot id="resale" width={WIN_W} height={winH} crop={cropFor(winH)} startFrom={CLIP_REFUSED - (T.step - T.win)} placeholder={<ResaleSheet T={T} winH={winH} />} />
            </Sequence>
            <Sequence from={jump} layout="none">
              <FootageSlot id="resale" width={WIN_W} height={winH} crop={cropFor(winH)} startFrom={CLIP_ANSWER - (T.answer - jump)} placeholder={<ResaleSheet T={T} winH={winH} />} />
            </Sequence>
          </AppWindow>
        </div>
      )}
      {u >= 0 && (
        <div
          style={{
            position: "absolute",
            left: 1232,
            top: 244,
            transform: `translate(-50%, -50%) rotate(${-14 + 6 * sp}deg) scale(${1.3 - 0.3 * sp})`,
            opacity: prog(f, T.stamp, 3),
          }}
        >
          <Stamp p={sp} />
        </div>
      )}
      {/* a faint rose flash on the window edge as the stamp hits */}
      {u >= 0 && u < 14 && (
        <div
          style={{
            position: "absolute",
            left: 960 - WIN_W / 2,
            top: 540 - winH / 2,
            width: WIN_W,
            height: winH,
            borderRadius: WIN_R,
            boxShadow: `0 0 0 2px rgba(251,113,133,${0.5 * (1 - u / 14)})`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
}

