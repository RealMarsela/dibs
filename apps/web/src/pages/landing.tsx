import { Link } from "react-router";
import { Wordmark } from "@/components/bits";
import { Hero } from "@/components/landing/hero";
import { Closing, Footer, HowItWorks, Problem, Trust, UnderTheHood } from "@/components/landing/sections";

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-rule/60 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-1 text-[14px]">
            <a href="#how" className="focus-ring hidden rounded-full px-3 py-1.5 text-ink-soft hover:text-ink sm:inline-flex">How it works</a>
            <a href="#hood" className="focus-ring hidden rounded-full px-3 py-1.5 text-ink-soft hover:text-ink sm:inline-flex">Under the hood</a>
            <Link to="/t/lis-0312" className="btn-ink btn-sm focus-ring ml-1">Open a trip</Link>
          </nav>
        </div>
      </header>
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Trust />
        <UnderTheHood />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
