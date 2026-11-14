import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Dices } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { Face } from "@/components/bits";
import { PEOPLE } from "@/data/sample";
import { shuffledOrder, useTrip } from "@/data/store";
import { pad2 } from "@/lib/utils";

/* The fair bed draw. Wired build: draw_beds() asks OutLayer for a VRF output, then assigns beds
   by a Fisher-Yates shuffle seeded with it. Anyone can re-run the shuffle from the proof. */
export function DrawSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, dispatch } = useTrip();
  const [phase, setPhase] = useState<"ready" | "rolling" | "done">(trip.drawn ? "done" : "ready");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (open) setPhase(trip.drawn ? "done" : "ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== "rolling") return;
    if (tick > 14) {
      dispatch({ type: "draw", order: shuffledOrder(trip.beds.length) });
      setPhase("done");
      return;
    }
    const id = setTimeout(() => setTick((t) => t + 1), 70 + tick * 12);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tick]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} eyebrow="All beds paid" title={phase === "done" ? "Beds are drawn" : "Who gets the double room?"}>
      {phase === "ready" && (
        <div>
          <p className="text-[15px] leading-relaxed text-fg-2">
            Nobody gets dibs on the best bed by being first or loudest. A verifiable random number from OutLayer decides, and anyone can check it.
          </p>
          <button
            className="pill-light focus-ring mt-6 w-full"
            onClick={() => {
              setTick(0);
              setPhase("rolling");
            }}
          >
            <Dices className="size-4" /> Draw the beds
          </button>
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {(phase === "rolling" || phase === "done") &&
          trip.spots.map((s, i) => {
            const bed = phase === "done" ? s.bed : trip.beds[(i + tick) % trip.beds.length];
            return (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 rounded-lg border border-line bg-white/[0.04] px-3 py-2"
              >
                <span className="w-6 font-mono text-[12px] text-fg-3">{pad2(s.n)}</span>
                {s.holder && <Face id={s.holder} size={22} />}
                <span className="w-16 truncate text-[14px] font-semibold">{s.holder ? PEOPLE[s.holder].name : ""}</span>
                <span className={phase === "done" ? "truncate text-[13.5px] text-fg" : "truncate text-[13.5px] text-fg-3 blur-[0.4px]"}>{bed}</span>
              </motion.li>
            );
          })}
      </ol>
      {phase === "done" && (
        <>
          <p className="mt-4 font-mono text-[11.5px] text-fg-3">Proof: OutLayer VRF output and attestation, linked on the receipt.</p>
          <button className="pill-light focus-ring mt-4 w-full" onClick={onClose}>
            See my bed
          </button>
        </>
      )}
    </Sheet>
  );
}
