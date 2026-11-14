import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";
import { cue as absCue, cueEnd as absCueEnd } from "./lib/anim";
import { LINES, TOTAL } from "./timeline.generated";

/* Scene registry: absolute frame ranges in the 30 fps film (from PLAN.md shot list). A scene renders [from, to).
   Each scene ends exactly on its out-handoff pose and the next one starts exactly on it (handoffs.tsx), so the
   full film hard-cuts on identical frames and reads as one continuous shot. */
/* Every scene starts exactly where its narration line starts (S01 at 0), and the last one ends at TOTAL, so any voice
   change (variant A/B, a re-voiced line) moves the scenes with it. Scenes only use local frames and cue(). */
const at = (id: string) => {
  const l = LINES.find((x) => x.id === id);
  if (!l) throw new Error(`scene: no line ${id}`);
  return l.from;
};
export const SCENES = {
  S01: { from: 0, to: at("L02"), title: "Hook: pay me later" },
  S02: { from: at("L02"), to: at("L03"), title: "The flip: the trip is a contract" },
  S03: { from: at("L03"), to: at("L04"), title: "Pay from any chain" },
  S04: { from: at("L04"), to: at("L05"), title: "Can't make it" },
  S05: { from: at("L05"), to: at("L06"), title: "Fair draw" },
  S06: { from: at("L06"), to: at("L07"), title: "The trip gets a card" },
  S07: { from: at("L07"), to: at("L08"), title: "Prove it (magic moment)" },
  S08: { from: at("L08"), to: at("L09"), title: "Try to cheat" },
  S09: { from: at("L09"), to: TOTAL, title: "Close" },
} as const;
export type SceneId = keyof typeof SCENES;

const Ctx = createContext<{ from: number }>({ from: 0 });
export const SceneProvider = ({ id, children }: { id: SceneId; children: React.ReactNode }) => (
  <Ctx.Provider value={{ from: SCENES[id].from }}>{children}</Ctx.Provider>
);
/** Absolute film frame offset of the current scene (0 outside a scene). */
export const useSceneFrom = () => useContext(Ctx).from;

/** Scene clock: f = local frame, A = absolute film frame, L(abs) → local, cue/cueEnd → local frames of narration words. */
export function useScene() {
  const f = useCurrentFrame();
  const from = useSceneFrom();
  return {
    f,
    A: f + from,
    L: (abs: number) => abs - from,
    cue: (line: string, word: string, nth = 0) => absCue(line, word, nth) - from,
    cueEnd: (line: string, word: string, nth = 0) => absCueEnd(line, word, nth) - from,
  };
}
