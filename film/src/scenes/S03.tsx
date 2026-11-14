import React from "react";
import { AbsoluteFill } from "remotion";
import { World } from "../components/World";
import { Display } from "../components/Surfaces";
import { SCENES } from "../scene";

/* S03 placeholder stub. Owner: scene sub-agent. Replace entirely; keep the export name. */
export const S03: React.FC = () => (
  <World>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Display size={48}>{SCENES.S03.title}</Display>
    </AbsoluteFill>
  </World>
);
