import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import { Crowd } from "@/components/landing/crowd";
import { LetterFace } from "@/components/motion/face";
import { Sweep } from "@/components/motion/sweep";

/* The hello. Maya (the booker) rises from below the fold and bobs; the crowd rises around her; the headline sweeps
   in word by word, the grey line lands alone after a pause; then the button rises. */
export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-28 text-center">
      <Crowd />
      <div className="relative z-10 flex flex-col items-center">
        <div className="hello-face">
          <div className="hello-bob group relative rounded-full text-[#fb923c]">
            <span className="sonar absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <LetterFace name="Maya" seed="maya" size={typeof window !== "undefined" && window.innerWidth < 640 ? 84 : 104} color="#fb923c" className="shadow-[0_18px_50px_-12px_rgba(251,146,60,0.5)] ring-4 ring-void" />
          </div>
        </div>
        <Sweep
          as="h1"
          delay={900}
          immediate
          className="mt-8 max-w-[15ch] text-[clamp(34px,4.2vw,58px)] sm:max-w-none"
          lines={[
            { text: "Every bed paid" },
            { text: "before anyone books." },
            { text: "No IOUs. No chasing.", tone: "fg-2", pause: true },
            { text: "Nobody fronts the money.", tone: "fg-2" },
          ]}
        />
        <div className="rise-in mt-9 flex flex-col items-center gap-3" style={{ animationDelay: "2.6s" }}>
          <Link id="hello-cta" to="/t/lis-0312" className="pill-light focus-ring press h-11 px-6 text-[15px]">
            Open the Lisbon trip
          </Link>
          <p className="text-[12.5px] text-fg-3">
            Pay from any chain <span className="mx-1.5">·</span> No wallet needed
          </p>
        </div>
      </div>
      <a href="#film" aria-label="Scroll to how it works" className="cue rise-in absolute bottom-7 left-1/2 -ml-3 text-fg-3 hover:text-fg-2" style={{ animationDelay: "3.2s" }}>
        <ChevronDown className="size-6" />
      </a>
    </section>
  );
}
