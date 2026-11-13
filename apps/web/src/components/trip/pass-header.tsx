import { useEffect, useState } from "react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import { countdown, localDeadline, stayDates, usd } from "@/lib/utils";
import { Avatar } from "@/components/bits";

function Field({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 truncate text-[17px] font-semibold tracking-[-0.01em]">{value}</p>
      {sub && <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{sub}</p>}
    </div>
  );
}

export function PassHeader() {
  const { trip, paidCount, funded } = useTrip();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const { label, nights } = stayDates(trip.checkIn, trip.checkOut);
  const total = trip.price * trip.spots.length;

  return (
    <section className="ticket overflow-hidden">
      <div className="grid md:grid-cols-[1fr_auto_auto]">
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Trip {trip.code}</p>
            <p className="eyebrow hidden sm:block">Group stay · NEAR mainnet</p>
          </div>
          <div className="mt-4 flex items-end gap-4">
            <h1 className="text-[52px] font-extrabold uppercase leading-[0.85] tracking-[-0.04em] sm:text-[72px]">{trip.place}</h1>
            <span className="mb-1.5 font-mono text-[13px] text-ink-faint">{trip.country}</span>
          </div>
          <p className="mt-2 text-[15px] text-ink-soft">{trip.stay}</p>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-dashed border-rule-strong pt-5 sm:grid-cols-4">
            <Field label="Dates" value={label} sub={`${nights} nights`} />
            <Field label="Per bed" value={usd(trip.price, 0)} sub={`${trip.spots.length} beds · ${usd(total, 0)}`} />
            <Field
              label="Book by"
              value={funded ? "Ready to book" : countdown(trip.bookBy, now)}
              sub={localDeadline(trip.bookBy)}
            />
            <Field
              label="Booker"
              value={
                <span className="inline-flex items-center gap-2">
                  <Avatar id={trip.booker} size={22} /> {PEOPLE[trip.booker].name}
                </span>
              }
              sub="Draws only with proof"
            />
          </div>
        </div>

        <div className="perf hidden w-4 md:block" aria-hidden />

        <div className="flex items-center justify-between gap-4 border-t border-dashed border-rule-strong bg-paper-deep/50 px-5 py-4 md:w-[190px] md:flex-col md:items-start md:justify-center md:border-t-0 md:px-6">
          <div>
            <p className="eyebrow">Paid</p>
            <p className="mt-1 font-mono text-[34px] font-semibold leading-none tracking-[-0.04em]">
              {paidCount}
              <span className="text-ink-faint">/{trip.spots.length}</span>
            </p>
          </div>
          <Barcode seed={trip.code} />
        </div>
      </div>
    </section>
  );
}

function Barcode({ seed }: { seed: string }) {
  const bars = Array.from({ length: 34 }, (_, i) => ((seed.charCodeAt(i % seed.length) * (i + 7)) % 5) + 1);
  return (
    <svg width="120" height="34" viewBox="0 0 120 34" aria-hidden className="text-ink/80">
      {bars.reduce<{ x: number; els: React.ReactNode[] }>(
        (acc, w, i) => {
          if (i % 2 === 0) acc.els.push(<rect key={i} x={acc.x} y={0} width={w * 0.7} height={34} fill="currentColor" />);
          acc.x += w * 0.7 + 1.1;
          return acc;
        },
        { x: 0, els: [] },
      ).els}
    </svg>
  );
}
