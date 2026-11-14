/* SFX cue sheet (absolute film frames). Files come only from Gabriel's Drive library copies, copied into public/audio/sfx/
   with their original names (PROVENANCE.md). `lead` = frames of silence at the file start before its hit (attack), so the
   hit lands on `at`. Integrator owns this file; scene owners propose cues in their handback. */
export type Cue = { at: number; file: string; vol: number; lead?: number; trim?: number; note: string };
export const CUES: Cue[] = [];
