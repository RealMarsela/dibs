import React from "react";
import { Freeze, Sequence } from "remotion";
import { prog } from "../../lib/anim";
import { FootageSlot, hasFootage, type Crop } from "../../components/Footage";
import { WIN, type T } from "./timing";
import { PayScreen } from "./PayScreen";

/* The pay window's content (WIN-sized slot). With the real clip (pay-base.mp4, a live testnet payment): three segments,
   each its own Sequence + FootageSlot startFrom, cross-faded over 8 frames:
     1. passkey dialog, from win0 at clip 3.15 s, frozen at clip 4.1 s while "no wallet and no gas" plays;
     2. chain list (Base outlined, on screen 4.5-7.5 s), from chain0 at clip 4.6 s, held from 7.4 s until it fades;
     3. tracking, from track0 at clip 12.6 s: "Swapped by NEAR Intents" ticks at 12.875 s (~ swaps + 2),
        "Landed in your bed's own account" at 14.375 s (~ "three").
   Without the clip: one slot whose placeholder (PayScreen) rebuilds the same three steps. */
const FPS = 30;
const SEG = { pk: 3.15, pkFreeze: 4.1, chain: 4.6, chainFreeze: 7.4, track: 12.6 };
const XF = 8;

function Seg({ from, until, startS, crop, opacity, freezeS }: { from: number; until: number; startS: number; crop: Crop; opacity: number; freezeS?: number }) {
  const startFrom = Math.round(startS * FPS);
  const slot = <FootageSlot id="pay-base" width={WIN.w} height={WIN.h} crop={crop} startFrom={startFrom} placeholder={null} />;
  return (
    <Sequence from={from} durationInFrames={until - from} layout="none">
      <div style={{ position: "absolute", inset: 0, opacity }}>
        {freezeS === undefined ? slot : <FreezeAt seqFrame={Math.round(freezeS * FPS) - startFrom}>{slot}</FreezeAt>}
      </div>
    </Sequence>
  );
}

/** Holds the clip from `seqFrame` (frames into the segment) onwards. */
function FreezeAt({ seqFrame, children }: { seqFrame: number; children: React.ReactNode }) {
  return (
    <Freeze frame={seqFrame} active={(fr: number) => fr >= seqFrame}>
      {children}
    </Freeze>
  );
}

export function PayFront({ f, t, crop }: { f: number; t: T; crop: Crop }) {
  if (!hasFootage("pay-base")) {
    return (
      <Sequence from={t.win0} layout="none">
        <FootageSlot id="pay-base" width={WIN.w} height={WIN.h} crop={crop} placeholder={<PayScreen f={f} t={t} crop={crop} off={t.win0} />} />
      </Sequence>
    );
  }
  return (
    <div style={{ position: "relative", width: WIN.w, height: WIN.h }}>
      <Seg from={t.win0} until={t.chain0 + XF} startS={SEG.pk} freezeS={SEG.pkFreeze} crop={crop} opacity={1} />
      <Seg from={t.chain0} until={t.track0 + XF} startS={SEG.chain} freezeS={SEG.chainFreeze} crop={crop} opacity={prog(f, t.chain0, XF)} />
      <Seg from={t.track0} until={t.flip0 + 30} startS={SEG.track} crop={crop} opacity={prog(f, t.track0, XF)} />
    </div>
  );
}
