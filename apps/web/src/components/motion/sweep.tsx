import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* Hoy's word sweep: each word sharpens in from a blur and a small rise, 55 ms apart. A new line starts the next
   sentence after a short stop; a line marked `pause` waits longer, so it lands alone. Plays once, when it is
   first on screen (or at once with `immediate`). Respects reduced motion through the global media rule. */
export type SweepLine = { text: string; tone?: "fg" | "fg-2"; pause?: boolean };

const WORD_GAP = 55;
const SENTENCE_GAP = 220;
const PAUSE_GAP = 520;

export function Sweep({
  lines,
  className,
  delay = 0,
  immediate = false,
  as: Tag = "h2",
}: {
  lines: SweepLine[];
  className?: string;
  delay?: number;
  immediate?: boolean;
  as?: "h1" | "h2" | "p";
}) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (immediate) {
      // Mount hidden, then switch on next frame so the transition actually plays.
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
      return () => cancelAnimationFrame(id);
    }
    if (!ref.current) return;
    const el = ref.current;
    const look = () => {
      if (el.getBoundingClientRect().top < innerHeight * 0.9) {
        setOn(true);
        removeEventListener("scroll", look);
      }
    };
    addEventListener("scroll", look, { passive: true });
    look();
    return () => removeEventListener("scroll", look);
  }, [immediate]);

  let t = delay;
  return (
    <Tag ref={ref as never} className={cn("display", className)}>
      {lines.map((line, li) => {
        if (li > 0) t += line.pause ? PAUSE_GAP : SENTENCE_GAP;
        const words = line.text.split(" ");
        return (
          <Fragment key={li}>
            {li > 0 && <br />}
            <span className={line.tone === "fg-2" ? "tone-2" : undefined}>
              {words.map((w, wi) => {
                const at = t;
                t += WORD_GAP;
                return (
                  <Fragment key={wi}>
                    <span
                      className="sweep-word inline-block"
                      data-on={on || undefined}
                      style={{ transitionDelay: `${at}ms` }}
                    >
                      {w}
                    </span>
                    {wi < words.length - 1 && " "}
                  </Fragment>
                );
              })}
            </span>
          </Fragment>
        );
      })}
    </Tag>
  );
}
