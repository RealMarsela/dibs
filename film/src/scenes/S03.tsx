import React from "react";
import { World } from "../components/World";
import { Stage } from "../components/Stage";
import { H2, H3 } from "../handoffs";
import { useScene } from "../scene";
import { timing, winPose } from "./s03/timing";
import { Intro } from "./s03/Intro";
import { PayWindow } from "./s03/PayWindow";
import { LiftOut } from "./s03/LiftOut";
import { Outro } from "./s03/Outro";

/* S03 Pay from any chain. In: H2 (meter + line). Out: H3 (bed list, all paid), on the scene's last frame.
   Leo's held cell grows into his row, "Pay $40" grows into the pay window (FootageSlot "pay-base"), the money lifts out
   through NEAR Intents into bed 03's own account, the window turns over (variant A: mainnet receipt; variant B: the honest
   testnet card), and the back face shrinks into row 03 as the list assembles. Timings: s03/timing.ts (all from cue()). */
export const S03: React.FC = () => {
  const { f, cue } = useScene();
  const t = timing(cue);
  if (f < t.lineOut) {
    return (
      <World>
        <H2 />
      </World>
    );
  }
  if (f >= t.D - 3) {
    return (
      <World>
        <H3 />
      </World>
    );
  }
  const P = winPose(f, t);
  return (
    <World>
      <Intro f={f} t={t} />
      <Outro f={f} t={t} />
      <Stage>
        {f >= t.win0 && <PayWindow f={f} t={t} P={P} />}
        <LiftOut f={f} t={t} />
      </Stage>
    </World>
  );
};
