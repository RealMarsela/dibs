import { AnimatePresence, motion } from "motion/react";
import { BedDouble, Hourglass } from "lucide-react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import type { Spot } from "@/data/types";
import { Avatar, ChainTag, Stamp } from "@/components/bits";
import { cn, pad2, usd } from "@/lib/utils";

interface Props {
  viewer: string;
  onPay: (n: number) => void;
  onExit: (n: number) => void;
}

export function SpotList({ viewer, onPay, onExit }: Props) {
  const { trip } = useTrip();
  return (
    <ol className="flex flex-col gap-2.5">
      {trip.spots.map((s) => (
        <SpotTicket key={s.n} spot={s} viewer={viewer} onPay={onPay} onExit={onExit} />
      ))}
    </ol>
  );
}

function SpotTicket({ spot, viewer, onPay, onExit }: { spot: Spot } & Props) {
  const { trip } = useTrip();
  const mine = spot.holder === viewer;
  const name = spot.holder ? PEOPLE[spot.holder]?.name : "Open";

  return (
    <motion.li layout="position" className={cn("ticket flex items-stretch", mine && "ring-2 ring-ink/80 ring-offset-2 ring-offset-paper")}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 sm:gap-5 sm:px-5">
        <div className="w-11 shrink-0 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Bed</p>
          <p className="font-mono text-[22px] font-semibold leading-none tracking-[-0.04em]">{pad2(spot.n)}</p>
        </div>
        <div className="h-9 w-px bg-rule" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {spot.holder && <Avatar id={spot.holder} size={24} />}
            <p className="truncate text-[16px] font-semibold">
              {name}
              {mine && <span className="ml-1.5 text-[13px] font-medium text-ink-faint">you</span>}
            </p>
          </div>
          <div className="mt-1 flex min-h-[18px] items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${spot.status}-${spot.bed ?? ""}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex min-w-0 items-center gap-2"
              >
                {spot.bed ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-ink-soft">
                    <BedDouble className="size-3.5 shrink-0" />
                    <span className="truncate">{spot.bed}</span>
                  </span>
                ) : spot.status === "paid" && spot.paidWith ? (
                  <ChainTag id={spot.paidWith} />
                ) : spot.status === "listed" ? (
                  <span className="text-[13px] text-sea">For resale at {usd(trip.price, 0)}, face value</span>
                ) : spot.status === "held" ? (
                  <span className="inline-flex items-center gap-1 text-[13px] text-stamp">
                    <Hourglass className="size-3.5" /> Held, not paid yet
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-faint">Nobody yet</span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="perf w-3 shrink-0" aria-hidden />

      <div className="flex w-[118px] shrink-0 flex-col items-center justify-center gap-1.5 px-3 py-3 sm:w-[150px]">
        <Stub spot={spot} mine={mine} onPay={onPay} onExit={onExit} />
      </div>
    </motion.li>
  );
}

function Stub({ spot, mine, onPay, onExit }: { spot: Spot; mine: boolean; onPay: Props["onPay"]; onExit: Props["onExit"] }) {
  const { trip } = useTrip();
  if (spot.status === "held" && mine)
    return (
      <button className="btn-ink btn-sm focus-ring w-full" onClick={() => onPay(spot.n)}>
        Pay {usd(trip.price, 0)}
      </button>
    );
  if (spot.status === "held") return <Stamp tone="stamp">Due</Stamp>;
  if (spot.status === "listed")
    return (
      <>
        <Stamp tone="sea">Resale</Stamp>
        <p className="text-center text-[11.5px] leading-tight text-ink-soft">
          {trip.waitlist[0] ? `${PEOPLE[trip.waitlist[0]].name} is next` : "Waiting for a buyer"}
        </p>
      </>
    );
  if (spot.status === "paid" && mine && !trip.drawnOut)
    return (
      <>
        <Stamp tone="paid" className="animate-stamp">Paid</Stamp>
        <button className="focus-ring rounded text-[12px] font-medium text-ink-soft underline decoration-rule-strong underline-offset-[3px] hover:text-ink" onClick={() => onExit(spot.n)}>
          Can’t make it?
        </button>
      </>
    );
  if (spot.status === "paid") return <Stamp tone="paid" className="animate-stamp">Paid</Stamp>;
  return <Stamp tone="ink">Open</Stamp>;
}
