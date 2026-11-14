import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { TripStrip } from "@/components/landing/strip";
import { CrewScene, DrawScene, PayScene, ProofScene, SellScene } from "@/components/landing/scenes";
import { useLanding } from "@/components/landing/stage";

/* The film: a sticky stage the page scrolls through, one beat per ~130svh. It opens with the trip strip large
   (2.6x) settling to its size over the first 60svh while Maya's face arrives from the hero. The glass card launches
   out of the strip on a spring the first time it is needed, then swaps its contents in place. Each beat has one
   two-tone caption, said once. */
interface Beat {
  caption: string;
  tone: string;
  paid: number;
  active?: string;
  card?: () => ReactNode;
}

const BEATS: Beat[] = [
  { caption: "Your crew.", tone: "Every bed accounted for.", paid: 7, active: "maya", card: () => <CrewScene /> },
  { caption: "Pay from any chain.", tone: "Nobody holds your money.", paid: 7, active: "leo", card: () => <PayScene /> },
  { caption: "Can’t make it?", tone: "Sell your bed.", paid: 8, active: "ana", card: () => <SellScene /> },
  { caption: "Book it.", tone: "Prove it.", paid: 8, active: "maya", card: () => <ProofScene /> },
  { caption: "Beds drawn fairly.", tone: "No shouting first.", paid: 8, card: () => <DrawScene /> },
];
const PER_BEAT = 130; // svh

export function Film() {
  const ref = useRef<HTMLElement>(null);
  const [beat, setBeat] = useState(0);
  const { pastHero } = useLanding();
  const still = useReducedMotion();
  const raw = useMotionValue(still ? 1 : 2.6);
  const scale = useSpring(raw, { stiffness: 220, damping: 32, mass: 0.6 });
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
      // The opening: from the moment the film reaches the top, 60svh of scroll take the strip from 2.6x to 1x.
      const into = Math.min(1, Math.max(0, (innerHeight - r.top) / innerHeight - 0.4) / 0.6);
      raw.set(still ? 1 : 2.6 - 1.6 * into);
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
  }, [raw, still]);

  const b = BEATS[beat];
  return (
    <section id="film" ref={ref} style={{ height: `${BEATS.length * PER_BEAT + 30}svh` }} className="relative">
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-4">
        <motion.div className="absolute top-[12%] origin-top" style={{ scale }}>
          <TripStrip paid={b.paid} active={b.active} clock={b.paid === 8 ? "ready" : "2d 17h"} landing={{ pastHero }} />
        </motion.div>

        <div className="relative flex w-full max-w-[440px] items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {b.card && (
              <motion.div
                key={beat}
                className="glass w-full rounded-[34px] p-3"
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

        <div className="absolute bottom-[9%] left-0 right-0 px-5 text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={beat}
              className="display mx-auto max-w-[22ch] text-[clamp(26px,3vw,38px)] sm:max-w-none"
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)", transition: { duration: 0.18 } }}
              transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {b.caption} <span className="tone-2">{b.tone}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
