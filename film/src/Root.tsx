import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { Film, SceneAlone } from "./Film";
import { HandoffSheet } from "./HandoffSheet";
import { PayPatch, type PatchProps } from "./tools/PayPatch";
import { SCENES, type SceneId } from "./scene";
import { TOTAL, FPS } from "./timeline.generated";
import { W, H } from "./tokens";

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} defaultProps={{ audio: true }} />
    <Composition id="Handoffs" component={HandoffSheet} durationInFrames={8} fps={FPS} width={W} height={H} />
    <Folder name="Tools">
      <Composition id="PayPatch" component={PayPatch} durationInFrames={1} fps={FPS} width={1920} height={1080} defaultProps={{ rects: [], texts: [] } as PatchProps} />
    </Folder>
    <Folder name="Scenes">
      {(Object.keys(SCENES) as SceneId[]).map((id) => (
        <Composition
          key={id}
          id={`Scene${id.slice(1)}`}
          component={SceneAlone}
          durationInFrames={SCENES[id].to - SCENES[id].from}
          fps={FPS}
          width={W}
          height={H}
          defaultProps={{ id, audio: true }}
        />
      ))}
    </Folder>
  </>
);
