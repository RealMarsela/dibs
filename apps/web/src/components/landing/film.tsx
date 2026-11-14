import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TripStrip } from "@/components/landing/strip";
import { DrawScene, PayScene, ProofScene, SellScene } from "@/components/landing/scenes";
import { cn } from "@/lib/utils";

/* The film: a sticky stage the page scrolls through, one beat per screen. The strip stays put, as Hoy's menu
   bar does; the glass card launches out of it on a spring the first time it is needed, then swaps its contents
   in place (old and new cross, no waiting). Each beat has one caption, said once. */
interface Beat {
  caption: string;
  sub?: string;
  paid: number;
  active?: string;
  card?: () => ReactNode;
}

const BEATS: Beat[] = [
  { caption: "Your crew, every bed accounted for.", sub: "Eight friends, eight beds, one link.", paid: 7 },
  { caption: "Pay from any chain.", sub: "Your bed has its own account. Nobody holds your money.", paid: 7, active: "leo", card: () => <PayScene /> },
  { caption: "Can’t make it? Sell your bed.", sub: "No refunds. The waitlist takes it at the price you paid.", paid: 8, active: "ana", card: () => <SellScene /> },
  { caption: "Book it. Prove it.", sub: "The booker is paid only for a real booking.", paid: 8, active: "maya", card: () => <ProofScene /> },
  { caption: "Beds drawn fairly.", sub: "Nobody gets the double room for shouting first.", paid: 8, card: () => <DrawScene /> },
];

export function Film() {
  const ref = useRef<HTMLElement>(null);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    let raf = 0;
    const look = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - innerHeight;
      const p = Math.min(0.999, Math.max(0, -r.top / Math.max(1, span)));
      setBeat(Math.floor(p * BEATS.length));
    };
    const soon = () => {
      raf = raf || requestAnimationFrame(look);
    };
    addEventListener("scroll", soon, { passive: true });
    addEventListener("resize", soon, { passive: true });
    look();
    return () => {
      removeEventListener("scroll", soon);
      removeEventListener("resize", soon);
    };
  }, []);

  const b = BEATS[beat];
  return (
    <section id="film" ref={ref} style={{ height: `${BEATS.length * 90 + 30}svh` }} className="relative">
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-5">
        <div className="absolute top-[14%]">
          <TripStrip paid={b.paid} active={b.active} clock={b.paid === 8 ? "ready" : "2d 17h"} />
        </div>

        <div className="relative flex min-h-[340px] w-full max-w-[420px] items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {b.card && (
              <motion.div
                key={beat}
                className="glass w-full p-5"
                style={{ originY: 0 }}
                initial={{ opacity: 0, scale: 0.86, y: -90, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)", transition: { duration: 0.2 } }}
                transition={{ type: "spring", visualDuration: 0.5, bounce: 0.18 }}
              >
                {b.card()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-[11%] left-0 right-0 px-5 text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={beat}
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)", transition: { duration: 0.18 } }}
              transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <p className="display text-[clamp(24px,2.6vw,34px)]">{b.caption}</p>
              {b.sub && <p className="mt-1.5 text-[clamp(15px,1.2vw,18px)] text-fg-2">{b.sub}</p>}
            </motion.div>
          </AnimatePresence>
        </div>

        <ol className="absolute right-[clamp(16px,4vw,64px)] top-1/2 hidden -translate-y-1/2 flex-col gap-2 lg:flex" aria-hidden>
          {BEATS.map((_, i) => (
            <li key={i} className={cn("h-1.5 w-1.5 rounded-full transition-colors duration-500", i === beat ? "bg-fg" : "bg-white/15")} />
          ))}
        </ol>
      </div>
    </section>
  );
}
