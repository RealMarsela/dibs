import React from "react";
import { World } from "../components/World";
import { H8 } from "../handoffs";
import { useScene } from "../scene";
import { timeline } from "./s08/data";
import { InboxPart } from "./s08/InboxPart";
import { AttackGrid } from "./s08/Grid";
import { H8Sweep } from "./s08/Words";

/* S08 "Try to cheat". In: H7 (the trip inbox, one verified booking.com email). Out: H8 ("35 attacks. Every one refused.").
   1) A copy of the email lifts out in front, opens, and its total is retyped $320 -> $3,200 ("forges").
   2) It flies back in as row 2, "Checking…", then Refused with a small shake ("refuses") and a mono verdict chip.
   3) The inbox recedes; 35 refusal codes from judge-report.json flip in one frame apart ("threw thirty-five attacks"),
      flip to rose in a wave ("refused"), collapse to the centre while H8's words sweep in. */
export const S08: React.FC = () => {
  const { f } = useScene();
  const t = timeline();
  return (
    <World>
      {f < t.recede + 20 && <InboxPart f={f} t={t} />}
      <AttackGrid f={f} t={t} />
      {f >= t.wordsEnd ? <H8 /> : <H8Sweep f={f} t={t} />}
    </World>
  );
};
