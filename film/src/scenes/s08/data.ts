/* S08 facts and clock. Every code and number here traces to the repo (PLAN.md section 3):
   - CODES: contracts/judge-report.json, the 35 checks that expect a refusal, in file order.
   - The forged email: DEPLOY-HANDBACK.md (tampered-body .eml, tx 93AJG9P2g7Za..., stored proof_refused E_NO_RESULT, DAO untouched). */
import { cue as absCue } from "../../lib/anim";
import { SCENES } from "../../scene";

export const CODES = [
  "E_NO_REFUND", "E_NOT_HOLDER", "E_NOT_RELAYER", "E_NOT_HELD", "E_WRONG_AMOUNT", "E_BAD_SENDER", "E_NOT_USDC",
  "E_PRIVATE", "E_PRIVATE", "E_PRIVATE", "ERR_PERMISSION_DENIED", "E_NOT_OWNER", "E_NOT_FULL", "E_NOT_FULL",
  "E_TRIP_EXISTS", "E_DEPOSIT", "E_ALREADY_PAID", "E_BAD_SIG", "E_NO_RESULT", "E_DRAWN", "E_DATES",
  "E_GUESTS", "E_TOTAL", "E_DOMAIN", "E_TRIP_MISMATCH", "E_BAD_SIG", "E_BAD_SIG", "E_BAD_PREFIX",
  "E_NOT_BOOKER", "E_BEFORE_DEADLINE", "E_PROOF_EXISTS", "E_REPLAY", "E_WRONG_AMOUNT", "E_DEADLINE", "E_REFUNDED",
] as const;

export const TX_SHORT = "93AJG9P2…";
export const FORGED_TOTAL = "$3,200";

/** Scene length in frames (from the registry). */
export const D = SCENES.S08.to - SCENES.S08.from;

/** The scene's clock in LOCAL frames, every narrated beat tied to its word. */
export function timeline() {
  const c = (w: string) => absCue("L08", w) - SCENES.S08.from;
  const forges = c("forges");
  const email = c("email");
  const refuses = c("refuses");
  const we = c("we");
  const threw = c("threw");
  const contracts = c("contracts");
  const refused = c("refused");
  const back = email + 6; // the forged card flies back into the inbox as row 2
  const words0 = D - 32; // H8 words sweep in as the tiles vanish; the line settles 8 frames before the cut
  return {
    forges,
    lift: 4, // the copy lifts out of row 1
    caret: forges - 3,
    del0: forges + 3, // "320" deleted one key at a time
    type0: forges + 10, // "3,200" typed
    back,
    swap: back + 26, // the flying card is now exactly row 2
    refuses,
    chip: refuses + 1,
    recede: we,
    grid0: threw,
    cap0: contracts - 6,
    wave0: refused - 14, // the rose wave starts on "every one" and has turned every tile by "refused"
    collapse0: refused + 11,
    words0,
    wordsEnd: words0 + 4 * 2 + 16,
  };
}
export type T08 = ReturnType<typeof timeline>;
