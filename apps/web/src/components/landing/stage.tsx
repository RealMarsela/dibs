import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LayoutGroup, MotionConfig } from "motion/react";

/* Shared landing state. `pastHero` flips once the visitor has scrolled a little over half a screen: Maya's face then
   leaves the hero and lands in the trip strip (one layoutId, so it flies). Motion follows the OS reduced-motion
   setting throughout the page. */
const Ctx = createContext<{ pastHero: boolean }>({ pastHero: false });
export const useLanding = () => useContext(Ctx);

export function LandingStage({ children }: { children: ReactNode }) {
  const [pastHero, setPast] = useState(false);
  useEffect(() => {
    let raf = 0;
    const look = () => {
      raf = 0;
      setPast(scrollY > innerHeight * 0.55);
    };
    const soon = () => {
      raf = raf || requestAnimationFrame(look);
    };
    addEventListener("scroll", soon, { passive: true });
    look();
    return () => removeEventListener("scroll", soon);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <Ctx.Provider value={{ pastHero }}>{children}</Ctx.Provider>
      </LayoutGroup>
    </MotionConfig>
  );
}
