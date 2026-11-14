import React from "react";
import { AbsoluteFill } from "remotion";
import { World } from "../components/World";
import { Sweep } from "../components/Sweep";
import { AppWindow } from "../components/Footage";
import { H5, H6 } from "../handoffs";
import { SCENES, useScene } from "../scene";
import { FoldList } from "./s06/Fold";
import { Crew } from "./s06/Crew";
import { S06Card } from "./s06/Card";
import { Enclave, Inflow, SealChip } from "./s06/Enclave";
import { CardFootage, CROP } from "./s06/CardFootage";
import { cardPose, times, WIN, windowPose, type CardPose } from "./s06/poses";

/* S06 "The trip gets a card". From H5 the rows fold away and the faces regroup around Maya with the crew's $320 pot;
   the OutLayer enclave (a turning glass cube) takes in the NEAR call and the pot, and the trip's card rises out of its
   top, turns flat and lands centre. Maya docks on its corner (sealed to her passkey), the "Hotels only" chip glows,
   then the card slides left beside the app's "Try it" rows (footage slot `card`): hotel approved, electronics declined.
   The honest Lithic line sits under the card; window and line leave and the card lands on H6. */

const DUR = SCENES.S06.to - SCENES.S06.from;
const END = DUR - 1;
const WIN_H = Math.round((WIN.w * CROP.h) / CROP.w);

function CardLayer({ c }: { c: CardPose }) {
  const clip = c.clip ? `polygon(0 0, 100% 0, 100% ${c.clipY}px, 0 ${c.clipY}px)` : undefined;
  return (
    <AbsoluteFill style={{ perspective: 2000, clipPath: clip }}>
      <div
        style={{
          position: "absolute",
          left: c.x,
          top: c.y,
          opacity: c.opacity,
          transform: `translate(-50%, -50%) rotateX(${c.rx}deg) rotateY(${c.ry}deg)`,
        }}
      >
        <S06Card width={c.w} glow={c.glow} sheen={c.sheen} />
      </div>
    </AbsoluteFill>
  );
}

export const S06: React.FC = () => {
  const { f, A, cue } = useScene();
  const T = times(cue);
  if (f === 0)
    return (
      <World>
        <H5 />
      </World>
    );
  if (f >= END - 2)
    return (
      <World>
        <H6 />
      </World>
    );
  const card = cardPose(f, T, END);
  const win = windowPose(f, T, END);
  return (
    <World>
      {f < 40 && <FoldList f={f} />}
      <Inflow f={f} T={T} />
      <Enclave f={f} T={T} />
      {card.on && <CardLayer c={card} />}
      {win.on && (
        <AbsoluteFill style={{ perspective: 2000 }}>
          <div style={{ position: "absolute", left: win.x, top: win.y, opacity: win.opacity, transform: `translate(-50%, -50%) translateZ(${win.z}px) rotateY(${win.ry}deg)` }}>
            <AppWindow width={WIN.w} height={WIN_H}>
              <CardFootage f={f} T={T} width={WIN.w} height={WIN_H} />
            </AppWindow>
          </div>
        </AbsoluteFill>
      )}
      <SealChip f={f} T={T} card={card} />
      {f >= T.forNow - 2 && f < END - 20 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center" }}>
          <Sweep
            lines={[{ text: "Lithic sandbox: the card network is simulated; the rules are real.", tone: "fg2" }]}
            start={T.forNow - 2}
            stagger={2.5}
            size={30}
            out={END - 38}
            outDur={12}
            style={{ fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}
          />
        </div>
      )}
      {f < T.an + 10 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 860, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
          <Sweep
            lines={[
              { text: "Maya books.", tone: "fg", at: [T.books - 3, T.books + 1] },
              { text: "Not with her own money.", tone: "fg2", at: [T.not, T.with, T.her, T.own, T.money] },
            ]}
            size={72}
            out={T.an - 4}
            outDur={12}
            style={{ display: "flex", columnGap: "0.25em", whiteSpace: "nowrap" }}
          />
        </div>
      )}
      <Crew f={f} A={A} T={T} card={card} end={END} />
    </World>
  );
};
