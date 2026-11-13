import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Avatar, NearMark, Stamp } from "@/components/bits";
import { pad2 } from "@/lib/utils";

const STACK = [
  { n: 4, who: "ana", state: "resale" as const, rot: -7, x: -26, y: 22 },
  { n: 2, who: "sam", state: "paid" as const, rot: 5, x: 22, y: 10 },
  { n: 3, who: "leo", state: "due" as const, rot: -1.5, x: 0, y: -6 },
];

export function Hero() {
  return (
    <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24">
      <div>
        <NearMark />
        <h1 className="mt-5 text-[46px] font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-[64px] lg:text-[76px]">
          Every bed paid
          <br />
          before anyone
          <br />
          <span className="relative inline-block">
            books.
            <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
              <path d="M2 8 C 50 2, 120 12, 198 4" stroke="var(--color-sun)" strokeWidth="5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-7 max-w-[520px] text-[18px] leading-relaxed text-ink-soft">
          Friends pay for their own bed, from any chain. The booker gets the money only with a verified booking. Can’t make it? Sell your bed, at
          the price you paid.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/t/lis-0312" className="btn-ink focus-ring">
            Open the Lisbon trip <ArrowRight className="size-4" />
          </Link>
          <Link to="/new" className="btn-paper focus-ring">
            Start a trip
          </Link>
        </div>
        <p className="mt-5 text-[13px] text-ink-faint">No wallet, no seed phrase. A passkey holds your bed.</p>
      </div>

      <div className="relative mx-auto h-[330px] w-full max-w-[460px] overflow-x-clip px-4 sm:h-[400px] sm:overflow-visible" aria-hidden>
        {STACK.map((t, i) => (
          <motion.div
            key={t.n}
            initial={{ opacity: 0, y: 40, rotate: 0 }}
            animate={{ opacity: 1, y: t.y, x: t.x, rotate: t.rot }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            className="ticket absolute inset-x-4 top-[56px] mx-auto flex h-[176px] max-w-[420px] overflow-hidden sm:top-[70px] sm:h-[190px]"
          >
            <div className="flex flex-1 flex-col justify-between p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Bed {pad2(t.n)} · 12–15 Mar</p>
                  <p className="mt-1 text-[38px] font-extrabold uppercase leading-none tracking-[-0.045em]">Lisbon</p>
                </div>
                {t.state === "paid" && <Stamp tone="paid">Paid</Stamp>}
                {t.state === "due" && <Stamp tone="stamp">Due</Stamp>}
                {t.state === "resale" && <Stamp tone="sea">Resale</Stamp>}
              </div>
              <div className="flex items-center gap-2">
                <Avatar id={t.who} size={26} />
                <span className="text-[15px] font-semibold capitalize">{t.who}</span>
                <span className="ml-auto font-mono text-[12px] text-ink-faint">Alfama flat</span>
              </div>
            </div>
            <div className="perf w-3" />
            <div className="flex w-[104px] flex-col items-center justify-center bg-paper-deep/60">
              <p className="eyebrow">Face</p>
              <p className="font-mono text-[24px] font-semibold">$40</p>
            </div>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="absolute -bottom-1 right-2 rounded-full border border-rule bg-card px-4 py-2 text-[13px] font-semibold shadow-sm sm:right-6"
        >
          7 of 8 paid · booker can’t book yet
        </motion.div>
      </div>
    </section>
  );
}
