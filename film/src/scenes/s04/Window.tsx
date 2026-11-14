import React from "react";
import { AbsoluteFill, Sequence, spring } from "remotion";
import { EASE, IN_OUT_STRONG, OUT_STRONG } from "../../tokens";
import { AppWindow, FootageSlot } from "../../components/Footage";
import { ROW_H } from "../../components/Trip";
import { ROW_W } from "./List";
import { lerp, prog } from "../../lib/anim";
import { CROP, ResaleSheet, Stamp, WIN_H, WIN_W } from "./Sheet";
import type { TT } from "./time";

/* Ana's row grows into the resale window (footage slot `resale`); the refusal stamp lands on its corner on "refuses";
   then the window recedes for the meter and slides away left. */
export const PUSH_S = 1.3;
/* public/footage/resale.mp4 (live testnet, measured): dialog open at clip frame 82, "Get my $40 back" clicked and the
   Refused card shown at 132, "Asking the contract…" until 209, "Contract answered E_NO_REFUND" from 210 to the end (329).
   Two uses of the clip: the click lands on "refund", then (while the card and cursor sit still) a hidden jump so the
   chain's answer appears just before the stamp on "refuses". */
const CLIP_REFUSED = 132;
const CLIP_ANSWER = 210;

export function WindowGroup({ T }: { T: TT }) {
  const { f } = T;
  const grow = prog(f, T.win, 22, OUT_STRONG);
  const rec = prog(f, T.recede, 26, EASE);
  const away = prog(f, T.away, 28, IN_OUT_STRONG);
  const u = f - T.stamp;
  const impact = u >= 0 && u <= 8 ? Math.sin((u / 8) * Math.PI) : 0;
  const drift = 3 * Math.sin(f / 36);
  const scale = (1 - 0.42 * rec) * (1 - 0.014 * impact);
  const cx = 960 - 1560 * away;
  const cy = 540 - 190 * rec + drift * (1 - rec);
  const op = (1 - 0.6 * rec) * (1 - away * 0.6);
  const blur = 3 * rec;

  // row → window morph box (the row is at PUSH_S, centred on screen)
  const bw = lerp(ROW_W * PUSH_S, WIN_W, grow);
  const bh = lerp(ROW_H * PUSH_S, WIN_H, grow);
  const br = lerp(22 * PUSH_S, 28, grow);
  const boxA = prog(f, T.win, 10);
  const winO = prog(f, T.win + 10, 6);

  const jump = T.step + 24;
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
        <div style={{ position: "absolute", left: 960 - WIN_W / 2, top: 540 - WIN_H / 2, opacity: winO }}>
          <AppWindow width={WIN_W} height={WIN_H}>
            <Sequence from={T.win} durationInFrames={jump - T.win} layout="none">
              <FootageSlot id="resale" width={WIN_W} height={WIN_H} crop={CROP} startFrom={CLIP_REFUSED - (T.step - T.win)} placeholder={<ResaleSheet T={T} />} />
            </Sequence>
            <Sequence from={jump} layout="none">
              <FootageSlot id="resale" width={WIN_W} height={WIN_H} crop={CROP} startFrom={CLIP_ANSWER - (T.answer - jump)} placeholder={<ResaleSheet T={T} />} />
            </Sequence>
          </AppWindow>
        </div>
      )}
      {u >= 0 && (
        <div
          style={{
            position: "absolute",
            left: 1352,
            top: 228,
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
            top: 540 - WIN_H / 2,
            width: WIN_W,
            height: WIN_H,
            borderRadius: 28,
            boxShadow: `0 0 0 2px rgba(251,113,133,${0.5 * (1 - u / 14)})`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
}

