import React from "react";
import { Freeze, Sequence } from "remotion";
import { FootageSlot, type Crop } from "../../components/Footage";
import { WIN, type T } from "./timing";

/* The real app journey (coordinator, 15 Nov 03:2x): journey-testnet-meteor.mp4, 1440x810 (scaled to the 1920 CSS frame),
   one real testnet journey with the real Meteor wallet realmarsela.testnet, in order, hard cuts, never out of order:
   Meteor "Sign Message" (start the trip as the booker) -> the new trip lis0ybkn page -> "This bed is yours" -> chain list
   (NEAR) -> Meteor "Approve Transaction" (send 40 test USDC) -> "You're in" (sent from Meteor Wallet DSX9QnWA…) -> every
   bed paid, $240 in the crew's DAO. App frames are a ~2 fps burst, so each is held (freeze); the wallet frames play.
   Crops keep out the URL bar, the wallet home screen and the invite toast. Crops are in 1920-space, aspect WIN. */
const ID = "journey-testnet-meteor";
const crop = (x: number, y: number, w: number): Crop => ({ x, y, w, h: (w * WIN.h) / WIN.w });
export const JSEGS = [
  { key: "sign", startS: 371.0, freezeS: 374.6, weight: 3.2, crop: crop(401, 96, 1114) },
  { key: "trip", startS: 388.2, freezeS: 388.3, weight: 1.6, crop: crop(205, 150, 940) },
  { key: "bed", startS: 456.2, freezeS: 456.3, weight: 1.6, crop: crop(631, 273, 660) },
  { key: "chain", startS: 461.4, freezeS: 461.5, weight: 1.1, crop: crop(623, 76, 666) },
  { key: "approve", startS: 503.0, freezeS: 507.6, weight: 3.4, crop: crop(401, 96, 1114) },
  { key: "in", startS: 518.0, freezeS: 518.1, weight: 1.8, crop: crop(584, 248, 751) },
  { key: "paid", startS: 640.0, freezeS: 640.1, weight: 2.0, crop: crop(205, 210, 940) },
] as const;

/** Segment start frames (scene-local): narration anchors when the journey line has them, else proportional. */
export function journeyAts(t: T): number[] {
  const span = t.flip0 + 6 - t.win0;
  const total = JSEGS.reduce((a, g) => a + g.weight, 0);
  let acc = t.win0;
  const prop = JSEGS.map((g) => {
    const at = acc;
    acc += (g.weight / total) * span;
    return Math.round(at);
  });
  const a = t.janchors;
  return JSEGS.map((_, i) => (i === 0 ? t.win0 : Math.max(prop[i - 1] + 20, Math.min(a[i] ?? prop[i], t.flip0 - 10))));
}

export function Journey({ t }: { t: T }) {
  const ats = journeyAts(t);
  return (
    <div style={{ position: "relative", width: WIN.w, height: WIN.h }}>
      {JSEGS.map((g, i) => {
        const from = ats[i];
        const until = i + 1 < ats.length ? ats[i + 1] : t.flip0 + 30;
        const startFrom = Math.round(g.startS * 30);
        const hold = Math.round((g.freezeS - g.startS) * 30);
        return (
          <Sequence key={g.key} from={from} durationInFrames={Math.max(1, until - from)} layout="none">
            <div style={{ position: "absolute", inset: 0 }}>
              <Freeze frame={hold} active={(fr: number) => fr >= hold}>
                <FootageSlot id={ID} width={WIN.w} height={WIN.h} crop={g.crop} startFrom={startFrom} placeholder={null} />
              </Freeze>
            </div>
          </Sequence>
        );
      })}
    </div>
  );
}
