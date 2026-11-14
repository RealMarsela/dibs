import React from "react";
import { AbsoluteFill } from "remotion";

/* Stage: a 3D space with one camera. Children are positioned in film px around the frame centre (0,0 = centre).
   Camera moves are applied to the whole world: x/y pan (film px), z dolly (positive = toward the viewer), rx/ry tilt (deg).
   Keep content entrances separate from the parent camera move (house rule). */
export type Cam = { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number };

export function Stage({ cam = {}, perspective = 2000, children }: { cam?: Cam; perspective?: number; children: React.ReactNode }) {
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = cam;
  return (
    <AbsoluteFill style={{ perspective, perspectiveOrigin: "50% 50%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          transform: `translate3d(${-x}px, ${-y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

/* Place a child centred at (x, y, z) in stage space with optional rotation and scale. */
export function At({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, opacity = 1, children, style }: {
  x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number; opacity?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) translate(-50%, -50%) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`,
        opacity,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
