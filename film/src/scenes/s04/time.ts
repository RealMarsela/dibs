import { SCENES, useScene } from "../../scene";

/* S04 clock. Every narrated beat hangs off a cue() in L04; the in-between moves are offsets from those cues.
   Local frames (0 = H3, DUR - 1 = H4). */
export const DUR = SCENES.S04.to - SCENES.S04.from;

export function useT() {
  const { f, cue } = useScene();
  const c = (w: string) => cue("L04", w);
  const say = c("Say");
  const ana = c("Ana");
  const refund = c("refund");
  const refuses = c("refuses");
  const because = c("because");
  const leave = c("leave");
  const short = c("short");
  const sells = c("sells");
  const priya = c("Priya");
  return {
    f,
    // A. H3: other rows dim, camera pushes into Ana's row
    dim: say + 1,
    push: ana - 5,
    // B. Ana's row grows into the resale window; the ask, the press, the refusal
    win: ana + 39,
    press: refund,
    step: refund + 2,
    answer: refuses - 2,
    stamp: refuses,
    // C. "because that would leave the trip short": window recedes, the meter shows the hole, then refills
    recede: because,
    meterIn: because + 6,
    hole: leave - 4,
    lineIn: leave + 2,
    refill: short + 12,
    lineOut: short + 14,
    away: short + 8,
    // D. cell 04 becomes the ticket; the stub tears on "sells"
    morph: short + 24,
    tear: sells + 8,
    // E. Priya, the swap
    priya,
    stubFly: priya + 18,
    anaOut: priya + 22,
    coin: priya + 38,
    seat: priya + 46,
    // F. pull back onto H4
    pull: priya + 76,
    end: DUR - 1,
  };
}
export type TT = ReturnType<typeof useT>;
