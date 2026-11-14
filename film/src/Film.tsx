import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SCENES, SceneProvider, type SceneId } from "./scene";
import { Mix } from "./audio/Mix";
import { S01 } from "./scenes/S01";
import { S02 } from "./scenes/S02";
import { S03 } from "./scenes/S03";
import { S04 } from "./scenes/S04";
import { S05 } from "./scenes/S05";
import { S06 } from "./scenes/S06";
import { S07 } from "./scenes/S07";
import { S08 } from "./scenes/S08";
import { S09 } from "./scenes/S09";
import { C } from "./tokens";

export const SCENE_COMPONENTS: Record<SceneId, React.FC> = { S01, S02, S03, S04, S05, S06, S07, S08, S09 };

/* The full film: scenes back to back on their registry frames (each seam is an identical handoff pose), plus the mix. */
export const Film: React.FC<{ audio?: boolean }> = ({ audio = true }) => (
  <AbsoluteFill style={{ background: C.void }}>
    {(Object.keys(SCENES) as SceneId[]).map((id) => {
      const Comp = SCENE_COMPONENTS[id];
      const s = SCENES[id];
      return (
        <Sequence key={id} from={s.from} durationInFrames={s.to - s.from} name={`${id} ${s.title}`}>
          <SceneProvider id={id}>
            <Comp />
          </SceneProvider>
        </Sequence>
      );
    })}
    {audio && <Mix />}
  </AbsoluteFill>
);

/* One scene alone, with the film's audio for that range (so a scene owner can preview it in sync). */
export const SceneAlone: React.FC<{ id: SceneId; audio?: boolean }> = ({ id, audio = true }) => {
  const Comp = SCENE_COMPONENTS[id];
  const s = SCENES[id];
  return (
    <AbsoluteFill style={{ background: C.void }}>
      <SceneProvider id={id}>
        <Comp />
      </SceneProvider>
      {audio && (
        <Sequence from={-s.from} layout="none">
          <Mix />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
