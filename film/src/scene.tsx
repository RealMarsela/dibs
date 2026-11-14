import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";
import { cue as absCue, cueEnd as absCueEnd } from "./lib/anim";

/* Scene registry: absolute frame ranges in the 30 fps film (from PLAN.md shot list). A scene renders [from, to).
   Each scene ends exactly on its out-handoff pose and the next one starts exactly on it (handoffs.tsx), so the
   full film hard-cuts on identical frames and reads as one continuous shot. */
export const SCENES = {
  S01: { from: 0, to: 228, title: "Hook: pay me later" },
  S02: { from: 228, to: 570, title: "The flip: the trip is a contract" },
  S03: { from: 570, to: 1104, title: "Pay from any chain" },
  S04: { from: 1104, to: 1521, title: "Can't make it" },
  S05: { from: 1521, to: 1782, title: "Fair draw" },
  S06: { from: 1782, to: 2403, title: "The trip gets a card" },
  S07: { from: 2403, to: 3093, title: "Prove it (magic moment)" },
  S08: { from: 3093, to: 3381, title: "Try to cheat" },
  S09: { from: 3381, to: 3720, title: "Close" },
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
