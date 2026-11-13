import { ArrowDownLeft, Ban, BedDouble, Dices, FileCheck2, ListPlus, Repeat2, Sparkles } from "lucide-react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import type { ActivityKind } from "@/data/types";
import { Avatar, ChainTag } from "@/components/bits";
import { localDeadline, pad2, usd } from "@/lib/utils";

export interface Opens {
  pay: (n: number) => void;
  exit: (n: number) => void;
  proof: () => void;
  draw: () => void;
}

export function NextStep({ viewer, open }: { viewer: string; open: Opens }) {
  const { trip, funded, paidCount, dispatch } = useTrip();
  const mine = trip.spots.find((s) => s.holder === viewer);
  const isBooker = viewer === trip.booker;
  const total = trip.price * trip.spots.length;
  const pos = trip.waitlist.indexOf(viewer);

  let title: string;
  let body: string;
  let cta: React.ReactNode = null;

  if (trip.drawnOut) {
    title = `Booked and paid. See you in ${trip.place}.`;
    body = mine?.bed ? `You’re in: ${mine.bed}.` : "Every bed is paid and the booking is verified.";
  } else if (mine?.status === "held") {
    title = "Your bed is held, not paid";
    body = `Pay ${usd(trip.price, 0)} by ${localDeadline(trip.bookBy)}. After that it goes to the first person on the waitlist.`;
    cta = <button className="btn-ink focus-ring w-full" onClick={() => open.pay(mine.n)}>Pay {usd(trip.price, 0)} from any chain</button>;
  } else if (!mine && pos >= 0) {
    title = `You’re #${pos + 1} on the waitlist`;
    body = `Your ${usd(trip.price, 0)} is ready. If anyone sells a bed, it’s yours on the spot. Leave any time and get it back.`;
  } else if (!mine) {
    title = "Every bed is taken";
    body = `Join the waitlist with ${usd(trip.price, 0)} from any chain. When someone sells, you get their bed instantly.`;
    cta = <button className="btn-ink focus-ring w-full" onClick={() => dispatch({ type: "join", who: viewer })}><ListPlus className="size-4" /> Join the waitlist</button>;
  } else if (!funded) {
    title = `Waiting on ${trip.spots.length - paidCount} bed${trip.spots.length - paidCount === 1 ? "" : "s"}`;
    body = isBooker
      ? "You can’t book yet, and that’s the point: you never front the money. Dibs nudges whoever hasn’t paid."
      : "Nobody books until every bed is paid, so nobody ends up covering for anyone.";
  } else if (!trip.drawn) {
    title = "Every bed is paid";
    body = "Time to draw who sleeps where. One fair, verifiable draw for everyone.";
    cta = <button className="btn-ink focus-ring w-full" onClick={open.draw}><Dices className="size-4" /> Draw the beds</button>;
  } else if (isBooker && !trip.proof) {
    title = `Book it, then prove it`;
    body = `Book the stay for ${usd(total, 0)} or less, then add the confirmation email. The crew DAO pays you back the moment it checks out.`;
    cta = <button className="btn-ink focus-ring w-full" onClick={open.proof}><FileCheck2 className="size-4" /> Add booking proof</button>;
  } else if (isBooker) {
    title = "Booking verified";
    body = `Release ${usd(total, 0)} from the crew DAO to yourself.`;
    cta = <button className="btn-ink focus-ring w-full" onClick={open.proof}>Release {usd(total, 0)}</button>;
  } else {
    title = mine?.bed ? `Your bed: ${mine.bed}` : "You’re paid up";
    body = `${PEOPLE[trip.booker].name} books next. If there’s no verified booking by ${localDeadline(trip.bookBy)}, everyone gets their money back automatically.`;
  }

  return (
    <section className="ticket p-5">
      <p className="eyebrow mb-2">Next for {PEOPLE[viewer]?.name ?? "you"}</p>
      <h2 className="text-[20px] font-bold leading-snug tracking-[-0.02em]">{title}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
      {mine?.status === "paid" && !trip.drawnOut && (
        <button className="focus-ring mt-3 rounded text-[13px] font-medium text-ink-soft underline decoration-rule-strong underline-offset-[3px] hover:text-ink" onClick={() => open.exit(mine.n)}>
          Can’t make it? Sell bed {pad2(mine.n)}
        </button>
      )}
    </section>
  );
}

const RULES = [
  "Nobody books until every bed is paid.",
  "The booker gets the money only for a verified booking.",
  "No refunds. You can sell your bed, at the price you paid and never more.",
  "No verified booking by the deadline? Everyone is refunded automatically.",
];

export function Rules() {
  return (
    <section className="ticket p-5">
      <p className="eyebrow mb-3">This trip’s rules · enforced by its contract</p>
      <ol className="flex flex-col gap-2.5">
        {RULES.map((r, i) => (
          <li key={r} className="flex gap-3 text-[14.5px] leading-snug">
            <span className="font-mono text-[12px] font-semibold text-ink-faint">{pad2(i + 1)}</span>
            {r}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Waitlist() {
  const { trip } = useTrip();
  return (
    <section className="ticket p-5">
      <p className="eyebrow mb-3">Waitlist · money ready</p>
      {trip.waitlist.length === 0 ? (
        <p className="text-[14px] text-ink-soft">Nobody yet. A bed that comes up for sale goes to the first person here.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {trip.waitlist.map((id, i) => (
            <li key={id} className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-ink-faint">#{i + 1}</span>
              <Avatar id={id} size={24} />
              <span className="text-[15px] font-medium">{PEOPLE[id]?.name}</span>
              <span className="ml-auto font-mono text-[12px] text-paid">{usd(trip.price, 0)} ready</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  paid: ArrowDownLeft,
  listed: Repeat2,
  resold: Repeat2,
  refused: Ban,
  proof: FileCheck2,
  draw: Dices,
  "draw-out": BedDouble,
  created: Sparkles,
};

export function ActivityFeed() {
  const { trip } = useTrip();
  return (
    <section className="ticket p-5">
      <p className="eyebrow mb-3">Receipts</p>
      <ol className="flex flex-col">
        {trip.activity.slice(0, 9).map((a) => {
          const Icon = ICON[a.kind];
          return (
            <li key={a.id} className="flex gap-3 border-b border-dashed border-rule py-2.5 last:border-0">
              <Icon className={a.kind === "refused" ? "mt-0.5 size-4 shrink-0 text-stamp" : "mt-0.5 size-4 shrink-0 text-ink-soft"} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-snug">{a.text}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-faint">{a.at}</span>
                  {a.chain && <ChainTag id={a.chain} />}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
