import React from "react";

/* The OutLayer enclave: a frosted glass cube in CSS 3D. Six translucent faces with lit edges, a soft core light that
   pulses when something enters, tilted so its open top reads. No backdrop-filter (unreliable inside preserve-3d);
   the frost is a layered fill + inner glow. Colours are the theme's off-white at low alpha only. */

export function GlassCube({ size = 300, rx = -20, ry = 30, pulse = 0 }: { size?: number; rx?: number; ry?: number; pulse?: number }) {
  const h = size / 2;
  const faces: { t: string; top?: boolean }[] = [
    { t: `rotateY(0deg) translateZ(${h}px)` },
    { t: `rotateY(90deg) translateZ(${h}px)` },
    { t: `rotateY(180deg) translateZ(${h}px)` },
    { t: `rotateY(-90deg) translateZ(${h}px)` },
    { t: `rotateX(90deg) translateZ(${h}px)`, top: true },
    { t: `rotateX(-90deg) translateZ(${h}px)` },
  ];
  return (
    <div style={{ width: size, height: size, position: "relative", perspective: 1800 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: size * 1.1,
          height: size * 1.1,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(236,236,234,${0.16 + 0.22 * pulse}) 0%, rgba(236,236,234,${0.05 + 0.06 * pulse}) 38%, rgba(236,236,234,0) 68%)`,
        }}
      />
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
        {faces.map((fc, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              transform: fc.t,
              borderRadius: 16,
              border: `1.5px solid rgba(236,236,234,${fc.top ? 0.34 : 0.22})`,
              background: `linear-gradient(150deg, rgba(236,236,234,${(fc.top ? 0.16 : 0.1) + 0.06 * pulse}) 0%, rgba(236,236,234,0.03) 48%, rgba(236,236,234,0.07) 100%)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 44px rgba(236,236,234,${0.05 + 0.07 * pulse})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
