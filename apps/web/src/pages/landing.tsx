import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Film } from "@/components/landing/film";
import { LandingStage } from "@/components/landing/stage";
import { Footer, Hood, LinkSection, Questions, Terms } from "@/components/landing/sections";

export function LandingPage() {
  return (
    <LandingStage>
      <div className="page-in min-h-dvh overflow-x-clip">
        <Header />
        <main>
          <Hero />
          <Film />
          <LinkSection />
          <Terms />
          <Hood />
          <Questions />
        </main>
        <Footer />
      </div>
    </LandingStage>
  );
}
