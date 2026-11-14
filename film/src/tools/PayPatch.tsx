import React from "react";
import { AbsoluteFill } from "remotion";

/* Tool, not part of the film: draws label patches for public/footage/pay-base.mp4 in the app's own CSS space
   (1920x1080 rendered at scale 1.5 = the recording's deviceScaleFactor), so the new testnet step labels are drawn by
   the same Chrome text engine at the same optical size as the recording. Transparent everywhere else.
   Labels match apps/web StepperTitle: 14.5px, weight 500, SF (system-ui), fg #ececea / fg-3 #585855. */
export type PatchProps = {
  rects: { x: number; y: number; w: number; h: number; color: string }[];
  texts: { x: number; y: number; text: string; color: string }[];
  bg?: string;
};

export const PayPatch: React.FC<PatchProps> = ({ rects, texts, bg }) => (
  <AbsoluteFill style={{ background: bg ?? "transparent" }}>
    {rects.map((r, i) => (
      <div key={`r${i}`} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, background: r.color }} />
    ))}
    {texts.map((t, i) => (
      <div
        key={`t${i}`}
        style={{
          position: "absolute",
          left: t.x,
          top: t.y,
          fontFamily: `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Inter Variable", system-ui, sans-serif`,
          fontSize: 14.5,
          fontWeight: 500,
          lineHeight: "20px",
          color: t.color,
          whiteSpace: "nowrap",
          WebkitFontSmoothing: "antialiased",
          textRendering: "optimizeLegibility",
        }}
      >
        {t.text}
      </div>
    ))}
  </AbsoluteFill>
);
