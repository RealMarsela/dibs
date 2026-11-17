import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { Crowd } from "@/components/landing/crowd";
import { Avatar } from "@/components/motion/avatar";
import { Sweep } from "@/components/motion/sweep";
import { useLanding } from "@/components/landing/stage";

/* The hello. Maya (the booker) rises from below the fold and bobs; the crowd rises around her; the headline sweeps
   in word by word, the grey lines land after a pause; then the two buttons rise. When the visitor scrolls into the
   story, Maya's face flies from here into the trip strip (shared layout). */
const LIFT = "shadow-[0_13px_24px_-6px_#0000002b,0_5px_10px_-4px_#00000029]";

export function Hero() {
  const { pastHero } = useLanding();
  const small = typeof window !== "undefined" && window.innerWidth < 640;
  const size = small ? 104 : 144;
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-28 text-center">
      <Crowd />
      <div className="relative z-10 flex flex-col items-center">
        <div className="hello-face" style={{ width: size + 12, height: size + 12 }}>
          {!pastHero && (
            <div className="hello-bob group relative rounded-full">
              <span className="sonar absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <motion.div layoutId="maya-face" className="rounded-full" transition={{ type: "spring", visualDuration: 0.6, bounce: 0.2 }}>
                <Avatar name="Maya" seed="maya" size={size} className="shadow-[0_0_0_6px_var(--color-void),0_0_0_7px_rgb(255_255_255/0.08),0_24px_60px_-18px_rgb(0_0_0/0.85)]" />
              </motion.div>
            </div>
          )}
        </div>
        <Sweep
          as="h1"
          delay={900}
          immediate
          className="mt-7 max-w-[15ch] text-[clamp(28px,3.4vw,49px)] sm:max-w-none"
          lines={[
            { text: "Every bed paid" },
            { text: "before anyone books." },
            { text: "No IOUs. No chasing.", tone: "fg-2", pause: true },
            { text: "Nobody fronts the money.", tone: "fg-2" },
          ]}
        />
        <div className="rise-in mt-9 flex flex-col items-center gap-3.5" style={{ animationDelay: "2.6s" }}>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Link id="hello-cta" to="/new" className={`pill-light focus-ring press h-[46px] px-6 ${LIFT}`}>
              Start a trip
            </Link>
            <Link to="/t/lis-0312" className={`pill-dark focus-ring press h-[46px] px-6 ${LIFT}`}>
              See an example trip
            </Link>
          </div>
          <p className="text-[12.5px] text-fg-3">
            Pay from your own wallet <span className="mx-1.5">·</span> Any chain
          </p>
        </div>
      </div>
      <a href="#film" aria-label="Scroll to how it works" className="cue rise-in absolute bottom-7 left-1/2 -ml-3 text-fg-3 hover:text-fg-2" style={{ animationDelay: "3.2s" }}>
        <ChevronDown className="size-6" />
      </a>
    </section>
  );
}
