import React from "react";
import { Freeze, Sequence } from "remotion";
import { FootageSlot, hasFootage, type Crop } from "../../components/Footage";
import { WIN, type T } from "./timing";
import { PayScreen } from "./PayScreen";
import { V } from "./variant";

/* The pay window's content (WIN-sized slot). With the real clip (pay-base.mp4, a live testnet payment): three segments,
   each its own Sequence + FootageSlot startFrom, joined by hard cuts where the app swaps the sheet content (never two
   steps visible at once; the window size and crop keep moving continuously across each cut):
     1. passkey dialog (fully visible from clip 3.0 s), from win0 at clip 3.3 s, frozen at clip 4.1 s through "no gas";
     2. chain list (Base outlined, on screen 4.5-7.5 s), from chain0 at clip 4.6 s, held from 7.4 s until it fades;
     3. tracking, from track0 at clip 12.6 s: "Swapped by NEAR Intents" ticks at 12.875 s (~ swaps + 2),
        "Landed in your bed's own account" at 14.375 s (~ "three"); the DAO step then spins until clip 20.0 s.
     4. variant B only: an invisible cut (same dialog, DAO spinning, cursor still) to clip 19.0 s, so "You're in"
        (clip 20.0 s, all four ticked) lands on t.tail.youIn, and the payment finishes on screen until the shrink.
   Without the clip: one slot whose placeholder (PayScreen) rebuilds the same three steps. */
const FPS = 30;
const SEG = { pk: 3.3, pkFreeze: 4.1, chain: 4.6, chainFreeze: 7.4, track: 12.6, done: 19.0, youIn: 20.0 };

function Seg({ from, until, startS, crop, freezeS }: { from: number; until: number; startS: number; crop: Crop; freezeS?: number }) {
  const startFrom = Math.round(startS * FPS);
  const slot = <FootageSlot id="pay-base" width={WIN.w} height={WIN.h} crop={crop} startFrom={startFrom} placeholder={null} />;
  return (
    <Sequence from={from} durationInFrames={until - from} layout="none">
      <div style={{ position: "absolute", inset: 0 }}>
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

const seg4Lead = Math.round((SEG.youIn - SEG.done) * FPS);

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
      <Seg from={t.win0} until={t.chain0} startS={SEG.pk} freezeS={SEG.pkFreeze} crop={crop} />
      {V === "A" ? (
        <Seg from={t.chain0} until={t.flip0 + 30} startS={SEG.chain} freezeS={SEG.chainFreeze} crop={crop} />
      ) : (
        <Seg from={t.chain0} until={t.track0} startS={SEG.chain} freezeS={SEG.chainFreeze} crop={crop} />
      )}
      {V === "A" ? null : (
        <>
          <Seg from={t.track0} until={t.tail.youIn - seg4Lead} startS={SEG.track} crop={crop} />
          <Seg from={t.tail.youIn - seg4Lead} until={t.D} startS={SEG.done} crop={crop} />
        </>
      )}
    </div>
  );
}
