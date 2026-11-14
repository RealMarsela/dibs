import { useEffect, useState } from "react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import { countdown, localDeadline, stayDates, usd } from "@/lib/utils";
import { Face } from "@/components/bits";
import { Sweep } from "@/components/motion/sweep";

/* The trip's hello: the place, big, then the stay in grey (Hoy's two tones), then four small facts. */
export function PassHeader() {
  const { trip, funded } = useTrip();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const { label, nights } = stayDates(trip.checkIn, trip.checkOut);
  const total = trip.price * trip.spots.length;

  return (
    <section className="pt-2">
      <p className="label">Trip {trip.code} · NEAR testnet</p>
      <Sweep
        as="h1"
        immediate
        delay={150}
        className="mt-3 text-[clamp(44px,7vw,84px)] leading-[0.98]"
        lines={[{ text: trip.place }]}
      />
      <Sweep
        as="p"
        immediate
        delay={450}
        className="mt-3 max-w-[30ch] text-[clamp(20px,2.2vw,28px)]"
        lines={[{ text: `${trip.stay}. ${label}, ${nights} night${nights === 1 ? "" : "s"}.`, tone: "fg-2" }]}
      />
      <div className="rise-in mt-6 flex flex-wrap gap-2" style={{ animationDelay: "0.9s" }}>
        <Chip k="Per bed" v={usd(trip.price, 0)} />
        <Chip k="Pot" v={`${usd(total, 0)}`} />
        <Chip k={funded ? "Ready" : "Book by"} v={funded ? "every bed paid" : `${countdown(trip.bookBy, now)} · ${localDeadline(trip.bookBy)}`} />
        <span className="inline-flex h-9 items-center gap-2 rounded-full bg-panel py-1 pl-1 pr-3.5 text-[13.5px] ring-1 ring-line">
          <Face id={trip.booker} size={26} />
          <span>
            <span className="text-fg-2">Booker </span>
            {PEOPLE[trip.booker].name}
          </span>
        </span>
      </div>
    </section>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-panel px-3.5 text-[13.5px] ring-1 ring-line">
      <span className="text-fg-2">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </span>
  );
}
