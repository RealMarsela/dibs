import { AnimatePresence, motion } from "motion/react";
import { BedDouble } from "lucide-react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import type { Spot } from "@/data/types";
import { ChainTag, Face, StatusBadge } from "@/components/bits";
import { cn, pad2, usd } from "@/lib/utils";

interface Props {
  viewer: string;
  onPay: (n: number) => void;
  onExit: (n: number) => void;
}

/* The beds, as Hoy lists channels: a face, a name, one quiet line under it, and the state on the right. */
export function SpotList({ viewer, onPay, onExit }: Props) {
  const { trip } = useTrip();
  return (
    <ol className="glass overflow-hidden p-1.5">
      {trip.spots.map((s, i) => (
        <SpotRow key={s.n} spot={s} viewer={viewer} onPay={onPay} onExit={onExit} last={i === trip.spots.length - 1} />
      ))}
    </ol>
  );
}

function SpotRow({ spot, viewer, onPay, onExit, last }: { spot: Spot; last: boolean } & Props) {
  const { trip } = useTrip();
  const mine = spot.holder === viewer;
  const name = spot.holder ? PEOPLE[spot.holder]?.name : "Open";
  return (
    <motion.li
      layout="position"
      className={cn(
        "group relative flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition-colors duration-200 hover:bg-white/[0.04]",
        mine && "bg-white/[0.05]",
      )}
    >
      {spot.holder ? <Face id={spot.holder} size={40} /> : <span className="size-10 rounded-full border border-dashed border-fg-3" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15.5px] font-semibold">
          <span className="truncate">{name}</span>
          {mine && <span className="rounded-full bg-you/15 px-1.5 py-px text-[11px] font-semibold text-you">you</span>}
          <span className="text-[12px] font-normal text-fg-3 tabular-nums">bed {pad2(spot.n)}</span>
        </p>
        <div className="mt-0.5 min-h-[18px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${spot.status}-${spot.bed ?? ""}`}
              initial={{ opacity: 0, y: 4, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {spot.bed ? (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
                  <BedDouble className="size-3.5" /> {spot.bed}
                </span>
              ) : spot.status === "paid" && spot.paidWith ? (
                <ChainTag id={spot.paidWith} />
              ) : spot.status === "listed" ? (
                <span className="text-[12.5px] text-resale">For resale at {usd(trip.price, 0)}, face value</span>
              ) : spot.status === "held" ? (
                <span className="text-[12.5px] text-due">Held, not paid yet</span>
              ) : (
                <span className="text-[12.5px] text-fg-3">Nobody yet</span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <Action spot={spot} mine={mine} onPay={onPay} onExit={onExit} />
      {!last && <span className="absolute bottom-0 left-[64px] right-3 h-px bg-line" />}
    </motion.li>
  );
}

function Action({ spot, mine, onPay, onExit }: { spot: Spot; mine: boolean; onPay: Props["onPay"]; onExit: Props["onExit"] }) {
  const { trip } = useTrip();
  if (spot.status === "held" && mine)
    return (
      <button className="pill-light pill-sm focus-ring press" onClick={() => onPay(spot.n)}>
        Pay {usd(trip.price, 0)}
      </button>
    );
  if (spot.status === "paid" && mine && !trip.drawnOut)
    return (
      <div className="flex items-center gap-2">
        <button className="focus-ring hidden rounded-full px-2 py-1 text-[12.5px] text-fg-2 transition-colors hover:text-fg sm:inline" onClick={() => onExit(spot.n)}>
          Can’t make it?
        </button>
        <StatusBadge status="paid" />
      </div>
    );
  return <StatusBadge status={spot.status} />;
}
