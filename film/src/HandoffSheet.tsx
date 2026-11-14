import React from "react";
import { useCurrentFrame } from "remotion";
import { World } from "./components/World";
import { H1, H2, H3, H4, H5, H6, H7, H8 } from "./handoffs";

/* Reference composition: frame n (0..7) shows seam pose H(n+1) on the World. For checking seams, not part of the film. */
const POSES = [H1, H2, H3, H4, H5, H6, H7, H8];
export const HandoffSheet: React.FC = () => {
  const f = useCurrentFrame();
  const P = POSES[Math.min(POSES.length - 1, f)];
  return (
    <World>
      <P />
    </World>
  );
};
