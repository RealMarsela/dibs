import React from "react";
import { AbsoluteFill, Freeze, Sequence } from "remotion";
import { FootageSlot } from "../../components/Footage";
import { prog } from "../../lib/anim";
import { TryRows } from "./TryRows";
import type { Times } from "./poses";

/* The `card` footage (public/footage/card.mp4, 1920x1080 CSS viewport) in two segments so each result lands on its word:
   A starts with the hotel row already charging and shows Approved on "through"; a 4-frame crossfade cuts to B, the
   electronics row charging, Declined on "declined"; B freezes just before the clip ends (33.17 s) and holds.
   Measured in the clip (24 fps): Approved first visible 25.417 s, Declined 29.917 s; rows are stable from 20 s. */
export const CROP = { x: 756, y: 600, w: 408, h: 176 }; // "Try it" + both rows; text 14/12 css px reads 28/24 px at 2x
const FPS = 30;
const APPROVED_S = 25.417;
const DECLINED_S = 29.917;
const LAST_SAFE_S = 33.0;

export function CardFootage({ f, T, width, height }: { f: number; T: Times; width: number; height: number }) {
  const inF = T.so - 1;
  const cut = T.electronics + 5;
  const aStart = Math.round(APPROVED_S * FPS - (T.through - inF));
  const bStart = Math.round(DECLINED_S * FPS - (T.declined - cut));
  const bHold = cut + Math.floor(LAST_SAFE_S * FPS - bStart);
  const placeholder = <TryRows f={f} pressA={T.hotel + 14} okA={T.through} pressB={T.electronics + 3} noB={T.declined} />;
  const slot = (startFrom: number) => <FootageSlot id="card" width={width} height={height} crop={CROP} startFrom={startFrom} placeholder={placeholder} />;
  return (
    <AbsoluteFill>
      {f < cut + 4 && (
        <AbsoluteFill>
          <Sequence from={inF} layout="none">
            {slot(aStart)}
          </Sequence>
        </AbsoluteFill>
      )}
      {f >= cut && (
        <AbsoluteFill style={{ opacity: prog(f, cut, 4) }}>
          <Sequence from={cut} layout="none">
            {f < bHold ? slot(bStart) : <Freeze frame={bHold - cut - 1}>{slot(bStart)}</Freeze>}
          </Sequence>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
