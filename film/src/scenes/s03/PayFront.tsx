import React from "react";
import { Freeze, Sequence } from "remotion";
import { FootageSlot, hasFootage, type Crop } from "../../components/Footage";
import { WIN, type T } from "./timing";
import { PayScreen } from "./PayScreen";
import { V } from "./variant";
import { HEAD } from "../../timeline.generated";

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
/* Wallet-first take (option (a), coordinator 15 Nov): s03-wallet-first.mp4, 1280x720 live testnet trip lisiwutm. The
   dialog "This bed is yours" with [Connect a NEAR wallet] / [Pay with an EVM wallet (OKX, MetaMask…)] and the
   "Judge demo: no wallet, use a passkey" link is up from 2.25 s (measured from frame 0); the cursor enters at 4.85 s and taps Connect a NEAR wallet at ~5.75 s (landing on "wallet");
   the pressed state is
   held from 6.0 s, before NEAR Connect's picker (third-party wallet logos) appears at 6.25 s; the picker is never shown. In 1920-space the
   dialog spans x 630-1288, y 292-785. */
const WALLET = { id: "s03-wallet-first", startS: 3.15, freezeS: 6.0, crop: { x: 618, y: 538.5 - (682 * 888) / 1150 / 2, w: 682, h: (682 * 888) / 1150 } };
const SEG = { pk: 3.3, pkFreeze: 4.1, chain: 4.6, chainFreeze: 7.4, track: 12.6, done: 19.0, youIn: 20.0 };

function Seg({ from, until, startS, crop, freezeS, id = "pay-base" }: { from: number; until: number; startS: number; crop: Crop; freezeS?: number; id?: string }) {
  const startFrom = Math.round(startS * FPS);
  const slot = <FootageSlot id={id} width={WIN.w} height={WIN.h} crop={crop} startFrom={startFrom} placeholder={null} />;
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
      {HEAD === "L03W" && hasFootage(WALLET.id) ? (
        <Seg id={WALLET.id} from={t.win0} until={t.chain0} startS={WALLET.startS} freezeS={WALLET.freezeS} crop={WALLET.crop} />
      ) : (
        <Seg from={t.win0} until={t.chain0} startS={SEG.pk} freezeS={SEG.pkFreeze} crop={crop} />
      )}
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
