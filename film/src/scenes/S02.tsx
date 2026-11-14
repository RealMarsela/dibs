import React from "react";
import { AbsoluteFill } from "remotion";
import { World } from "../components/World";
import { Display } from "../components/Surfaces";
import { SCENES } from "../scene";

/* S02 placeholder stub. Owner: scene sub-agent. Replace entirely; keep the export name. */
export const S02: React.FC = () => (
  <World>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Display size={48}>{SCENES.S02.title}</Display>
    </AbsoluteFill>
  </World>
);
