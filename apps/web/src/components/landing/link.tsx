import { Link } from "react-router";
import { Link2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/motion/avatar";
import { hash } from "@/components/motion/face";
import { Sweep } from "@/components/motion/sweep";

/* "A link is all it takes": the moment a trip link lands in a group chat. Forty-odd friends drop in and settle into
   a pile along the bottom on a spring, and a few say hello. Laid out once from a seed so every load matches. */
const NAMES = [
  "Zara", "Mateo", "Aiko", "Noah", "Lina", "Ravi", "Elif", "Oscar", "Nia", "Hugo", "Mei", "Theo", "Sofia", "Kwame",
  "Ines", "Yuki", "Arjun", "Lea", "Omar", "Maren", "Chidi", "Ana", "Felix", "Rosa", "Sami", "Iris", "Tariq", "Bea",
  "Jonas", "Amara", "Luca", "Hana", "Diego", "Freya", "Kenji", "Ada", "Malik", "Elsa", "Tomas", "Wren", "Pavel", "Noor",
  "Joao", "Kira",
];
const SAYS: Record<number, string> = { 3: "Count me in", 11: "Dibs on the window bed", 19: "Paid from Base", 26: "Lisbon!!", 33: "In. Sending now", 40: "Who’s booking?" };

function rnd(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

const PILE = (() => {
  const r = rnd(hash("dibs-pile"));
  return NAMES.map((name, i) => {
    const row = i % 3; // three loose rows, the back row smaller
    const size = row === 0 ? 34 + r() * 8 : row === 1 ? 42 + r() * 10 : 52 + r() * 14;
    return { name, x: 1 + r() * 95, bottom: row === 0 ? 108 + r() * 26 : row === 1 ? 56 + r() * 22 : 6 + r() * 18, size: Math.round(size), tilt: (r() - 0.5) * 50, drop: 280 + r() * 260, delay: 0.15 + i * 0.022 + r() * 0.1, blur: row === 0 && r() < 0.5 };
  });
})();

export function LinkSection() {
  const still = useReducedMotion();
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center overflow-hidden px-5 pb-[240px] pt-[clamp(96px,14vh,160px)]">
      <div className="relative z-10 flex flex-col items-center text-center">
        <Sweep className="flex items-center gap-3 text-[clamp(30px,3.6vw,48px)]" lines={[{ text: "A link is all it takes." }]} />
        <Link2 className="mt-4 size-6 text-fg-2" aria-hidden />
        <Link to="/t/lis-0312" className="pill-light focus-ring press mt-7 h-[46px] px-6 shadow-[0_13px_24px_-6px_#0000002b,0_5px_10px_-4px_#00000029]">
          Open the Lisbon trip
        </Link>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[230px]">
        {PILE.map((p, i) => (
          <motion.div
            key={p.name}
            className="absolute"
            style={{ left: `${p.x}%`, bottom: p.bottom, zIndex: Math.round(200 - p.bottom) }}
            initial={still ? false : { y: -p.drop, opacity: 0, rotate: p.tilt }}
            whileInView={{ y: 0, opacity: 1, rotate: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ type: "spring", stiffness: 150, damping: 13, mass: 0.9, delay: p.delay }}
          >
            {SAYS[i] && (
              <motion.span
                className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-2xl rounded-bl-md bg-fg px-3 py-1.5 text-[13px] font-medium text-void shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)]"
                initial={still ? false : { opacity: 0, scale: 0.6, y: 6 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 1.4 + (i % 7) * 0.12 }}
              >
                {SAYS[i]}
              </motion.span>
            )}
            <span className="block" style={{ filter: p.blur ? "blur(1.5px)" : undefined, opacity: p.blur ? 0.75 : 1 }}>
              <Avatar name={p.name} seed={`pile-${p.name}`} size={p.size} className="shadow-[0_0_0_3px_var(--color-void)]" />
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
