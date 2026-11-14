import React from "react";
import { AbsoluteFill } from "remotion";
import { World } from "../components/World";
import { Display } from "../components/Surfaces";
import { SCENES } from "../scene";

/* S04 placeholder stub. Owner: scene sub-agent. Replace entirely; keep the export name. */
export const S04: React.FC = () => (
  <World>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Display size={48}>{SCENES.S04.title}</Display>
    </AbsoluteFill>
  </World>
);
