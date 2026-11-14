import React from "react";
import { getStaticFiles, OffthreadVideo, staticFile } from "remotion";
import { C, GLASS } from "../tokens";
import { FOOTAGE_READY } from "../footage.generated";

/* FootageSlot: real app footage when public/footage/<id>.mp4 exists, otherwise the scene's on-brand placeholder
   (rebuilt from the app's real components, never a grey box). Clips are recorded at a 1920x1080 CSS viewport
   (deviceScaleFactor 2, see FOOTAGE.md); `crop` is a rectangle in those CSS px, scaled to fill the slot box.
   Placeholders receive the same box, so swapping footage in never moves the layout. */
export type Crop = { x: number; y: number; w: number; h: number };

/** A clip is used only when scripts/footage-ready.py has probed it as complete AND the file is in public/. */
export function hasFootage(id: string): boolean {
  if (!FOOTAGE_READY[id]) return false;
  try {
    return getStaticFiles().some((f) => f.name === `footage/${id}.mp4`);
  } catch {
    return false;
  }
}

export function FootageSlot({
  id,
  width,
  height,
  crop = { x: 0, y: 0, w: 1920, h: 1080 },
  startFrom = 0,
  playbackRate = 1,
  placeholder,
}: {
  id: string;
  width: number;
  height: number;
  crop?: Crop;
  /** frames into the clip (at 30 fps) where this use starts */
  startFrom?: number;
  playbackRate?: number;
  placeholder: React.ReactNode;
}) {
  const scale = width / crop.w;
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background: C.void }} data-slot={id}>
      {hasFootage(id) ? (
        <OffthreadVideo
          src={staticFile(`footage/${id}.mp4`)}
          muted
          startFrom={startFrom}
          playbackRate={playbackRate}
          style={{ position: "absolute", left: -crop.x * scale, top: -crop.y * scale, width: 1920 * scale, height: 1080 * scale }}
        />
      ) : (
        placeholder
      )}
    </div>
  );
}

/* AppWindow: the frame app footage lives in. No browser chrome: a rounded near-black screen with the app's hairline border,
   a soft drop shadow and a faint top sheen. Place it inside a <Stage> and move it in 3D with `transform`. */
export function AppWindow({ width, height, radius = 28, children, style }: { width: number; height: number; radius?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        position: "relative",
        background: C.void,
        border: `1px solid ${C.lineStrong}`,
        boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 120px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {children}
      <div style={{ position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none", background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 30%)" }} />
    </div>
  );
}

/* A glass sheet like the app's Dialog (sheet.tsx): 440 css px wide, radius 28, padding 28, eyebrow + display title. */
export function SheetFrame({ s = 2, eyebrow, title, children, style }: { s?: number; eyebrow?: string; title: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...GLASS, width: 440 * s, borderRadius: 28 * s, padding: 28 * s, ...style }}>
      {eyebrow && <div style={{ fontSize: 12 * s, fontWeight: 500, color: C.fg2, marginBottom: 4 * s }}>{eyebrow}</div>}
      <div style={{ fontWeight: 600, letterSpacing: "-0.024em", fontSize: 24 * s, color: C.fg, marginBottom: 20 * s }}>{title}</div>
      {children}
    </div>
  );
}
