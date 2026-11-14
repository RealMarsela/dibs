import type { PersonId } from "../../tokens";

/* S01 layout in film px at camera 1.0 (camera identity = the frame). A loose ring of eight chat bubbles: Maya's at
   12 o'clock, the seven replies around the clock, her face at the H1 spot and the "owed to Maya" counter under her.
   Bubble boxes were checked against each other, the face, the counter and the 96 px safe margin at every arrival. */

export const FACE = { x: 960, y: 420, size: 160, endSize: 132 } as const;
export const MAYA_BUBBLE = { x: 960, y: 222 } as const;
export const COUNTER = { x: 960, y: 606, labelY: 698 } as const;
/** Centre the ring creeps toward during the hold ("keeps stacking"). */
export const RING_CENTRE = { x: 960, y: 520 } as const;

export type Reply = { id: PersonId; text: string; x: number; y: number };

/* Arrival order zig-zags down the ring: upper left, upper right, left, right, lower left, lower right, bottom. */
export const REPLIES: Reply[] = [
  { id: "sam", text: "I’ll pay you later", x: 478, y: 272 },
  { id: "leo", text: "pay you friday", x: 1446, y: 302 },
  { id: "ana", text: "can I pay after payday?", x: 430, y: 496 },
  { id: "tomas", text: "who do I send it to again?", x: 1498, y: 478 },
  { id: "jun", text: "I’ll pay you later", x: 548, y: 716 },
  { id: "chloe", text: "doing it tonight, promise", x: 1384, y: 706 },
  { id: "kofi", text: "sending soon", x: 972, y: 862 },
];

/* Camera: starts at 1.3x on Maya's bubble and face, pulls back to the frame by PULL_END. */
export const CAM_START = { s: 1.3, x: 960, y: 330 } as const;
export const PULL_END = 125;
