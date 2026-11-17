import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Wordmark } from "@/components/bits";
import { cn } from "@/lib/utils";

/* Hoy's bar: a blur band appears once anything scrolls under it; its text links make way for two pills
   once the hello's own button has gone under the bar. */
export function Header({ ctaId = "hello-cta" }: { ctaId?: string }) {
  const [float, setFloat] = useState(false);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const look = () => {
      setFloat(scrollY > 8);
      const cta = document.getElementById(ctaId);
      setPast(cta ? cta.getBoundingClientRect().bottom < 64 : scrollY > 400);
    };
    addEventListener("scroll", look, { passive: true });
    addEventListener("resize", look, { passive: true });
    look();
    return () => {
      removeEventListener("scroll", look);
      removeEventListener("resize", look);
    };
  }, [ctaId]);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          float ? "opacity-100" : "opacity-0",
        )}
        style={{ background: "linear-gradient(rgb(14 14 14 / 0.86), rgb(14 14 14 / 0.6))", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
      />
      <div className="relative mx-auto flex h-16 max-w-[1680px] items-center justify-between px-[clamp(20px,6vw,128px)]">
        <Wordmark />
        <nav className="relative flex h-9 items-center">
          <div
            className={cn(
              "flex items-center gap-1 text-[13.5px] transition-[opacity,translate] duration-300 ease-[var(--ease)]",
              past ? "pointer-events-none -translate-y-2 opacity-0" : "opacity-100",
            )}
          >
            <a href="#film" className="focus-ring hidden rounded-md px-1.5 py-2 text-fg-2 transition-colors hover:text-fg sm:inline">
              how it works
            </a>
            <a href="#hood" className="focus-ring hidden rounded-md px-1.5 py-2 text-fg-2 transition-colors hover:text-fg sm:inline">
              under the hood
            </a>
            <Link to="/trips" className="focus-ring rounded-md px-1.5 py-2 text-fg-2 transition-colors hover:text-fg">
              my trips
            </Link>
            <Link to="/new" className="pill-light pill-sm focus-ring press ml-2">
              Start a trip
            </Link>
          </div>
          <div
            className={cn(
              "absolute right-0 flex items-center gap-2 transition-[opacity,translate] duration-[450ms] ease-[var(--ease)]",
              past ? "translate-y-0 opacity-100 delay-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <Link to="/trips" className="pill-dark pill-sm focus-ring press hidden sm:inline-flex">
              My trips
            </Link>
            <Link to="/new" className="pill-light pill-sm focus-ring press whitespace-nowrap">
              Start a trip
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
