import React from "react";
import { Audio, interpolate, Sequence, staticFile } from "remotion";
import { LINES, TOTAL } from "../timeline.generated";
import { CUES } from "./cues";

/* Narration on top, music ducked under it, SFX on their cues. Final loudness (-14 LUFS, -1 dBTP) is set in the
   mastering pass (scripts/master.sh), so these are relative levels. */
export const MUSIC = { file: "audio/music/mixkit-1168.mp3", title: "Coffee or Tea", at: 66, base: 0.34, duck: 0.13, fadeIn: 30, fadeOut: 45 };

function vo(frame: number): number {
  // 1 while any line speaks (with 6-frame ramps), else 0
  let v = 0;
  for (const l of LINES) {
    const a = interpolate(frame, [l.from - 6, l.from, l.to, l.to + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    v = Math.max(v, a);
  }
  return v;
}

export const Mix: React.FC = () => (
  <>
    {LINES.map((l) => (
      <Sequence key={l.id} from={l.from} durationInFrames={Math.ceil((l.dur + 1) * 30)} layout="none">
        <Audio src={staticFile(`audio/vo/${l.id}.mp3`)} volume={1} />
      </Sequence>
    ))}
    <Sequence from={MUSIC.at} layout="none">
      <Audio
        src={staticFile(MUSIC.file)}
        volume={(f) => {
          const a = f + MUSIC.at; // absolute film frame
          const fade = interpolate(a, [MUSIC.at, MUSIC.at + MUSIC.fadeIn, TOTAL - MUSIC.fadeOut, TOTAL], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return fade * (MUSIC.base + (MUSIC.duck - MUSIC.base) * vo(a));
        }}
      />
    </Sequence>
    {CUES.map((c, i) => (
      <Sequence key={i} from={Math.max(0, c.at - (c.lead ?? 0))} durationInFrames={c.trim ?? 90} layout="none">
        <Audio src={staticFile(`audio/sfx/${c.file}`)} volume={c.vol} />
      </Sequence>
    ))}
  </>
);
