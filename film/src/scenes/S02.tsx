import React from "react";
import { interpolate } from "remotion";
import { World } from "../components/World";
import { Stage } from "../components/Stage";
import { Sweep } from "../components/Sweep";
import { Wordmark } from "../components/Surfaces";
import { H1, H2 } from "../handoffs";
import { SCENES, useScene } from "../scene";
import { OE } from "../tokens";
import { Crowd } from "./s02/crowd";
import { Maya, Crew, Heading } from "./s02/row";
import { Tile } from "./s02/tile";
import { FinalLayer } from "./s02/final";
import { camAt, times } from "./s02/timing";

/* S02 "The flip: the trip is a contract" (228-570). H1 (Maya alone) -> the landing's crowd rises around her, "dibs"
   sweeps in on "Dibs", then "The trip itself / is a contract on NEAR." on the narration -> the crowd drifts out and the
   crew joins Maya in a row of eight under "Lisbon" -> each bed gets a keyless account tile (key struck through on
   "no keys") -> faces lift away, tiles squeeze into the funding meter, seven cells fill, bed 03 stays held -> H2. */
const DUR = SCENES.S02.to - SCENES.S02.from;

export const S02: React.FC = () => {
  const { f, A, cue } = useScene();
  const T = times(cue, DUR);
  if (f <= 0) return <World><H1 /></World>;
  if (f >= T.end) return <World><H2 /></World>;
  const cam = camAt(f, T);
  const inStage = f < T.squeezeEnd;
  return (
    <World>
      <Stage cam={cam}>
        {f < T.headOut + 20 && <Crowd f={f} inAt={T.crowdIn} outAt={T.crowdOut} />}
        {f < T.headOut + 14 && <Headline f={f} T={T} />}
        {f >= T.lisbon && f < T.headingOut + 16 && <Heading T={T} />}
        <Maya f={f} A={A} T={T} />
        {f >= T.crew && <Crew f={f} A={A} T={T} />}
        {inStage && Array.from({ length: 8 }, (_, i) => <Tile key={i} i={i} f={f} T={T} />)}
      </Stage>
      {!inStage && <FinalLayer f={f} T={T} s={cam.s} />}
    </World>
  );
};

/** "dibs" (110 px) under Maya on "Dibs", lifted away; then the two-tone headline word by word on the narration. */
function Headline({ f, T }: { f: number; T: ReturnType<typeof times> }) {
  const pin = interpolate(f, [T.mark, T.mark + 16.5], [0, 1], { easing: OE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pout = interpolate(f, [T.markOut, T.markOut + 12], [0, 1], { easing: OE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const h = T.head;
  return (
    <>
      {pin > 0 && pout < 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 60,
            whiteSpace: "nowrap",
            transform: `translate(-50%, -50%) translateY(${(1 - pin) * 18 - pout * 30}px)`,
            opacity: pin * (1 - pout),
            filter: pin < 1 || pout > 0 ? `blur(${(1 - pin) * 8 + pout * 10}px)` : undefined,
          }}
        >
          <Wordmark size={110} />
        </div>
      )}
      {f >= h[0] && (
        <div style={{ position: "absolute", left: 0, top: 70, transform: "translate(-50%, -50%)", whiteSpace: "nowrap" }}>
          <Sweep
            size={64}
            out={T.headOut}
            outDur={12}
            style={{ whiteSpace: "nowrap" }}
            lines={[
              { text: "The trip itself", at: h.slice(0, 3) },
              { text: "is a contract on NEAR.", tone: "fg2", at: h.slice(3) },
            ]}
          />
        </div>
      )}
    </>
  );
}
