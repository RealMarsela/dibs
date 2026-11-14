/* S08 facts and clock. Every code and number here traces to the repo (PLAN.md section 3):
   - CODES: contracts/judge-report.json, the 35 checks that expect a refusal, in file order.
   - The forged email: the REAL sin1025 booking (total SGD 226.60) with its body edited; the tampered-body proof tx
     93AJG9P2... was submitted on this very trip (deploy/testnet.json "submit_proof_sin1025_tampered"): stored
     proof_refused E_NO_RESULT, DAO untouched (DEPLOY-HANDBACK.md). SGD 2,266.00 is the film lead's illustrative edit. */
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
export const FORGED_TOTAL = "SGD 2,266.00";

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
  const back = email + 6; // the forged card flies back into the inbox as row 2
  const words0 = D - 65; // H8 words sweep in as the tiles vanish; fully in 41 frames before the cut (readable >= 1.5 s)
  return {
    forges,
    lift: 4, // the copy lifts out of row 1
    caret: forges - 3,
    sel0: forges + 1, // "226.60" selected
    type0: forges + 7, // "2,266.00" typed over it, one key every 2 frames
    back,
    swap: back + 26, // the flying card is now exactly row 2
    refuses,
    chip: refuses + 1,
    recede: we,
    grid0: threw,
    cap0: c("thirty-five") + 9, // judge-report caption, readable until the collapse (>= 45 frames)
    wave0: contracts + 6, // rose wave on "contracts, and"
    collapse0: c("every") + 1, // tiles collapse on "every one"; H8's "refused." lands on the spoken "refused"
    words0,
    wordsEnd: words0 + 4 * 2 + 16,
  };
}
export type T08 = ReturnType<typeof timeline>;
