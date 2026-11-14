import { useState } from "react";
import { Link2 } from "lucide-react";
import { LetterFace } from "@/components/motion/face";
import { cn } from "@/lib/utils";

export const CREW = [
  { id: "maya", name: "Maya", color: "#fb923c" },
  { id: "sam", name: "Sam", color: "#38bdf8" },
  { id: "leo", name: "Leo", color: "#4ade80" },
  { id: "ana", name: "Ana", color: "#f472b6" },
  { id: "tomas", name: "Tomás", color: "#facc15" },
  { id: "jun", name: "Jun", color: "#a78bfa" },
  { id: "chloe", name: "Chloé", color: "#2dd4bf" },
  { id: "kofi", name: "Kofi", color: "#fb7185" },
];

/* The trip strip, the way Hoy's menu bar sits over everything: the invite link, a battery of eight beds,
   the crew's faces stacked (they part around the one under the pointer), and the clock to the booking deadline.
   `active` pulses with sonar: whoever is doing something in this beat. */
export function TripStrip({ paid, active, clock = "2d 17h" }: { paid: number; active?: string; clock?: string }) {
  const [over, setOver] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-4 text-fg-2 sm:gap-6" aria-label={`${paid} of 8 beds paid`}>
      <Link2 className="size-5" aria-hidden />
      <Battery paid={paid} />
      <div className="flex items-center" onMouseLeave={() => setOver(null)}>
        {CREW.map((c, i) => {
          const shift = over === null ? 0 : i < over ? -7 : i > over ? 7 : 0;
          const lift = over === i ? -4 : 0;
          return (
            <span
              key={c.id}
              onMouseEnter={() => setOver(i)}
              className={cn("relative -ml-2.5 rounded-full first:ml-0", active === c.id && "sonar")}
              style={{
                color: c.color,
                translate: `${shift}px ${lift}px`,
                scale: over === i ? "1.14" : "1",
                zIndex: over === i ? 20 : active === c.id ? 10 : 8 - i,
                transition: "translate .5s var(--ease), scale .4s var(--ease)",
              }}
            >
              <LetterFace name={c.name} seed={c.id} color={c.color} size={30} className="ring-[2.5px] ring-void" />
            </span>
          );
        })}
      </div>
      <span className="font-mono text-[14px] tabular-nums text-fg">{clock}</span>
    </div>
  );
}

function Battery({ paid }: { paid: number }) {
  return (
    <span className="flex h-[18px] items-center rounded-[6px] border-[1.5px] border-fg-2 p-[2px]" title={`${paid} of 8 paid`}>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="mx-[0.5px] h-full w-[4px] rounded-[1.5px] transition-colors duration-500"
          style={{ background: i < paid ? (paid === 8 ? "var(--color-paid)" : "var(--color-fg)") : "rgb(255 255 255 / 0.12)", transitionDelay: `${i * 30}ms` }}
        />
      ))}
      <span className="-mr-[5px] ml-[2px] h-[7px] w-[2px] rounded-r-sm bg-fg-2" />
    </span>
  );
}
