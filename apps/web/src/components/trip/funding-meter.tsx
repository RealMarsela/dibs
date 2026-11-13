import { motion } from "motion/react";
import { useTrip } from "@/data/store";
import { usd } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function FundingMeter() {
  const { trip, paidCount, funded } = useTrip();
  const total = trip.price * trip.spots.length;
  return (
    <div>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <p className="text-[15px] font-semibold">
          {funded ? "Every bed is paid" : `${trip.spots.length - paidCount} bed${trip.spots.length - paidCount === 1 ? "" : "s"} still to pay`}
        </p>
        <p className="font-mono text-[12px] text-ink-soft">
          {usd(paidCount * trip.price, 0)} of {usd(total, 0)} in the crew DAO
        </p>
      </div>
      <div className="mt-3 grid grid-cols-8 gap-1.5" role="img" aria-label={`${paidCount} of ${trip.spots.length} beds paid`}>
        {trip.spots.map((s) => (
          <div key={s.n} className="relative h-3 overflow-hidden rounded-[4px] border border-rule bg-paper-deep">
            <motion.div
              initial={false}
              animate={{ scaleX: s.status === "paid" || s.status === "listed" ? 1 : 0 }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              style={{ originX: 0 }}
              className={cn("absolute inset-0", s.status === "listed" ? "bg-sea" : funded ? "bg-paid" : "bg-ink")}
            />
            {s.status === "held" && (
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-stamp)_0_2px,transparent_2px_6px)] opacity-50" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
