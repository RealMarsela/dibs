import { CreditCard, Dices, FileCheck2, ListPlus } from "lucide-react";
import { useTrip } from "@/data/store";
import { PEOPLE } from "@/data/sample";
import { ChainTag, Face } from "@/components/bits";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Rise } from "@/components/motion/rise";
import { localDeadline, pad2, usd } from "@/lib/utils";

export interface Opens {
  pay: (n: number) => void;
  exit: (n: number) => void;
  proof: () => void;
  draw: () => void;
  card: () => void;
}

/* What this person should do next, said Hoy's way: a white statement and its grey continuation, then one button. */
export function NextStep({ viewer, open }: { viewer: string; open: Opens }) {
  const { trip, funded, paidCount, act, live, network } = useTrip();
  const mine = trip.spots.find((s) => s.holder === viewer);
  const openSpot = trip.spots.find((s) => s.status === "open");
  const mainnet = live && network === "mainnet";
  const isBooker = viewer === trip.booker;
  const total = trip.price * trip.spots.length;
  const pos = trip.waitlist.indexOf(viewer);
  let a: string;
  let b: string;
  let cta: React.ReactNode = null;

  if (trip.drawnOut) {
    a = `Booked and paid. See you in ${trip.place}.`;
    b = mine?.bed ? `You’re in ${/^bed \d+$/i.test(mine.bed) ? "" : "the "}${mine.bed.toLowerCase()}.` : "Every bed is paid and the booking is verified.";
    cta = trip.proof ? <button className="pill-dark focus-ring press" onClick={open.proof}><FileCheck2 className="size-4" /> See the booking proof</button> : null;
  } else if (mine?.status === "held") {
    a = "Your bed is held, not paid.";
    b = `Pay ${usd(trip.price, 0)} by ${localDeadline(trip.bookBy)}, or it goes to the waitlist.`;
    cta = <button className="pill-light focus-ring press" onClick={() => open.pay(mine.n)}>Pay {usd(trip.price, 0)} from any chain</button>;
  } else if (!mine && pos >= 0) {
    a = `You’re #${pos + 1} on the waitlist.`;
    b = `Your ${usd(trip.price, 0)} is ready. If anyone sells a bed, it’s yours on the spot. Leave any time and get it back.`;
  } else if (!mine && openSpot) {
    a = `Bed ${pad2(openSpot.n)} is open.`;
    b = mainnet
      ? `Real money on NEAR mainnet: claim it with your own wallet and pay ${usd(trip.price, 0)} in USDC from Base, Solana, Arbitrum, Ethereum or NEAR.`
      : `Claim it with your own wallet and pay ${usd(trip.price, 0)} from any chain. Nobody books until every bed is paid.`;
    cta = <button className="pill-light focus-ring press" onClick={() => open.pay(openSpot.n)}>Take bed {pad2(openSpot.n)} · {usd(trip.price, 0)}</button>;
  } else if (!mine && mainnet) {
    a = "Every bed is taken.";
    b = "Both beds on this mainnet trip were paid with real USDC. The waitlist, resale, draw and booking proof run on the testnet trips.";
  } else if (!mine) {
    a = "Every bed is taken.";
    b = `Join the waitlist with ${usd(trip.price, 0)} from any chain. When someone sells, you get their bed instantly.`;
    cta = <button className="pill-light focus-ring press" onClick={() => act.join(viewer)}><ListPlus className="size-4" /> Join the waitlist</button>;
  } else if (!funded) {
    a = `Waiting on ${trip.spots.length - paidCount} bed${trip.spots.length - paidCount === 1 ? "" : "s"}.`;
    b = isBooker ? "You can’t book yet, and that’s the point: you never front the money." : "Nobody books until every bed is paid, so nobody covers for anyone.";
  } else if (!trip.drawn) {
    a = "Every bed is paid.";
    b = "Time to draw who sleeps where. One fair draw, the same for everyone.";
    cta = <button className="pill-light focus-ring press" onClick={open.draw}><Dices className="size-4" /> Draw the beds</button>;
  } else if (isBooker && !trip.proof) {
    a = "Book it with the trip’s own card.";
    b = `It works at hotels only, once, for up to ${usd(total, 0)}. Then the confirmation lands in the trip’s inbox and proves it.`;
    cta = (
      <div className="flex flex-wrap gap-2">
        <button className="pill-light focus-ring press" onClick={open.card}><CreditCard className="size-4" /> The trip’s card</button>
        <button className="pill-dark focus-ring press" onClick={open.proof}><FileCheck2 className="size-4" /> Booking proof</button>
      </div>
    );
  } else if (isBooker) {
    a = "Booking verified.";
    b = `Release ${usd(total, 0)} from the crew’s DAO to yourself.`;
    cta = <button className="pill-light focus-ring press" onClick={open.proof}>Release {usd(total, 0)}</button>;
  } else {
    a = mine?.bed ? `Your bed: ${mine.bed}.` : "You’re paid up.";
    b = `${PEOPLE[trip.booker].name} books next. No verified booking by ${localDeadline(trip.bookBy)}? Everyone is refunded automatically.`;
  }

  return (
    <section className="glass p-6">
      <div className="mb-3 flex items-center gap-2">
        <Face id={viewer} size={24} />
        <span className="label">Next for {PEOPLE[viewer]?.name ?? "you"}</span>
      </div>
      <p className="display text-[clamp(21px,2vw,25px)]">
        {a} <span className="tone-2">{b}</span>
      </p>
      {cta && <div className="mt-5">{cta}</div>}
      {mine?.status === "paid" && !trip.drawnOut && (
        <button className="focus-ring mt-4 rounded-md text-[13.5px] text-fg-2 transition-colors hover:text-fg" onClick={() => open.exit(mine.n)}>
          Can’t make it? Sell bed {pad2(mine.n)} →
        </button>
      )}
    </section>
  );
}

const RULES = [
  ["Nobody books", "until every bed is paid."],
  ["The booker is paid", "only for a verified booking."],
  ["No refunds.", "Sell your bed at what you paid, never more."],
  ["No booking by the deadline?", "Everyone is refunded automatically."],
];

export function Rules() {
  return (
    <Rise className="flex flex-col gap-2.5">
      <p className="label mb-1">This trip’s rules, kept by its contract</p>
      {RULES.map(([a, b]) => (
        <p key={a} className="text-[16px] font-medium leading-snug">
          {a} <span className="tone-2">{b}</span>
        </p>
      ))}
    </Rise>
  );
}

export function Waitlist() {
  const { trip } = useTrip();
  return (
    <Rise>
      <p className="label mb-3">Waitlist, money ready</p>
      {trip.waitlist.length === 0 ? (
        <p className="text-[14.5px] text-fg-2">Nobody yet. A bed that comes up for sale goes to the first person here.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {trip.waitlist.map((id, i) => (
            <li key={id} className="flex items-center gap-3">
              <span className="w-5 text-[12.5px] text-fg-3 tabular-nums">#{i + 1}</span>
              <Face id={id} size={30} />
              <span className="text-[15px] font-medium">{PEOPLE[id]?.name}</span>
              <span className="ml-auto text-[12.5px] text-paid">{usd(trip.price, 0)} ready</span>
            </li>
          ))}
        </ol>
      )}
    </Rise>
  );
}

export function ActivityFeed() {
  const { trip } = useTrip();
  const items = trip.activity.slice(0, 8);
  return (
    <Rise>
      <p className="label mb-4">Receipts</p>
      <Timeline value={items.length} className="ms-1">
        {items.map((a, i) => (
          <TimelineItem key={a.id} step={i + 1} className="pb-5">
            <TimelineHeader>
              <TimelineSeparator className="bg-white/10" />
              <TimelineDate className="text-[11.5px] text-fg-3">{a.at}</TimelineDate>
              <TimelineTitle className={a.kind === "refused" ? "text-[14px] font-medium text-refused" : "text-[14px] font-medium"}>{a.text}</TimelineTitle>
              <TimelineIndicator className="border-white/25 bg-void group-data-completed/timeline-item:border-fg-2" />
            </TimelineHeader>
            {a.chain && (
              <TimelineContent>
                <ChainTag id={a.chain} />
              </TimelineContent>
            )}
          </TimelineItem>
        ))}
      </Timeline>
    </Rise>
  );
}
