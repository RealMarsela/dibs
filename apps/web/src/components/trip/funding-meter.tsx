import { motion } from "motion/react";
import { useTrip } from "@/data/store";
import { usd } from "@/lib/utils";

/* Eight cells, one per bed: white when paid, green once all are, hatched orange while held, sky while for resale. */
export function FundingMeter() {
  const { trip, paidCount, funded } = useTrip();
  const total = trip.price * trip.spots.length;
  const left = trip.spots.length - paidCount;
  return (
    <div>
      <p className="display text-[clamp(20px,2vw,26px)]">
        {funded ? "Every bed is paid." : `${paidCount} of ${trip.spots.length} paid.`}{" "}
        <span className="tone-2">
          {funded && trip.drawnOut ? `${usd(total, 0)} went to the booker for a verified booking.` : funded ? `${usd(total, 0)} sits in the crew’s DAO.` : `${left} to go before anyone can book. ${usd(paidCount * trip.price, 0)} of ${usd(total, 0)} in the crew’s DAO.`}
        </span>
      </p>
      <div className="mt-5 grid grid-cols-8 gap-1.5" role="img" aria-label={`${paidCount} of ${trip.spots.length} beds paid`}>
        {trip.spots.map((s, i) => (
          <div key={s.n} className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              initial={false}
              animate={{ scaleX: s.status === "paid" || s.status === "listed" ? 1 : 0 }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.03 }}
              style={{ originX: 0, background: s.status === "listed" ? "var(--color-resale)" : funded ? "var(--color-paid)" : "var(--color-fg)" }}
              className="absolute inset-0 rounded-full"
            />
            {s.status === "held" && (
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--color-due)_0_2px,transparent_2px_6px)] opacity-60" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
