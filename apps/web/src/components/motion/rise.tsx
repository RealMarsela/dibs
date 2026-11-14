import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* A section arrives once: it rises 8 px and fades in when its top passes 90% of the viewport.
   Checked on scroll, one look per frame, so nothing can stay hidden (Hoy's site.js rule). */
export function Rise({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const look = () => {
      raf = 0;
      if (el.getBoundingClientRect().top < innerHeight * 0.9) {
        setSeen(true);
        removeEventListener("scroll", soon);
        removeEventListener("resize", soon);
      }
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
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={cn("rise", className)} data-seen={seen || undefined} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
