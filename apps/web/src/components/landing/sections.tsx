import { useRef } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Rise } from "@/components/motion/rise";
import { Wordmark } from "@/components/bits";
import { MARKS } from "./marks";

export { LinkSection } from "./link";

const wrap = "mx-auto w-full max-w-[1680px] px-[clamp(20px,6vw,128px)]";

const TERMS = [
  ["Dibs is free.", "You pay network fees: cents, not percent."],
  ["No refunds. Ever.", "Sell your bed at what you paid. The waitlist takes it on the spot."],
  ["Nobody holds the money.", "The crew’s own DAO does, and only a verified booking unlocks it."],
  ["Miss the deadline?", "Everyone is refunded automatically. No one has to ask."],
];

/* Each term reads grey and turns white as it scrolls up through the middle of the screen. */
function Term({ a, b }: { a: string; b: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "start 52%"] });
  const color = useTransform(scrollYProgress, [0, 1], ["#5c5b58", "#ececea"]);
  return (
    <motion.p ref={ref} className="text-[clamp(28px,3.25vw,46.8px)] font-medium leading-[1.08] tracking-[-0.024em]" style={{ color: still ? "#ececea" : color }}>
      {a} <span className="tone-2">{b}</span>
    </motion.p>
  );
}

export function Terms() {
  return (
    <section className={`${wrap} py-[clamp(80px,12vw,180px)]`}>
      <div className="flex max-w-[980px] flex-col gap-[clamp(22px,2.6vw,36px)]">
        {TERMS.map(([a, b]) => (
          <Term key={a} a={a} b={b} />
        ))}
        <Rise delay={200}>
          <Link to="/new" className="pill-light focus-ring press mt-3 h-[46px] px-6 shadow-[0_13px_24px_-6px_#0000002b,0_5px_10px_-4px_#00000029]">
            Start a trip
          </Link>
        </Rise>
      </div>
    </section>
  );
}

const HOOD = [
  ["Sputnik DAO.", "The crew’s pot lives in its own DAO. The booker’s payout is a DAO proposal you can open in Trezu."],
  ["Keyless bed accounts.", "Every bed is a NEAR account with no keys at all. Its one job: hand your payment to the trip, tagged with your bed."],
  ["NEAR Intents.", "Pay from Base, Solana, Arbitrum or Ethereum. Your bed’s own NEAR account receives exactly the bed price in USDC."],
  ["OutLayer.", "The trip contract itself asks an Intel TDX enclave whether the booking email is real, then checks the signed answer."],
  ["NEAR AI Cloud.", "Reads the email inside a GPU enclave. Friends see dates, guests and the total. Never names, address or card."],
  ["Your own wallet.", "NEAR Connect, MetaMask, OKX or Phantom pays. No NEAR wallet? A passkey holds your bed and Dibs pays the gas."],
];

/* No boxes: the rules as two-tone lines beside a phone showing the live trip, then the stack as one plain row. */
export function Hood() {
  return (
    <section id="hood" className={`${wrap} py-[clamp(60px,9vw,140px)]`}>
      <Rise>
        <h2 className="display mb-10 max-w-[20ch] text-[clamp(30px,3.2vw,44px)]">
          Under the hood. <span className="tone-2">Every rule is code.</span>
        </h2>
      </Rise>
      <div className="grid items-start gap-[clamp(40px,6vw,96px)] lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex max-w-[640px] flex-col gap-6">
          {HOOD.map(([a, b], i) => (
            <Rise key={a} delay={i * 50}>
              <p className="text-[clamp(18px,1.5vw,23px)] font-medium leading-snug tracking-[-0.012em]">
                {a} <span className="tone-2">{b}</span>
              </p>
            </Rise>
          ))}
        </div>
        <Rise className="mx-auto lg:mx-0">
          <Phone />
        </Rise>
      </div>
      <Rise className="mt-[clamp(56px,7vw,104px)]">
        <p className="mb-5 text-[13.5px] text-fg-2">Runs on</p>
        <ul className="flex flex-wrap items-center gap-x-[clamp(24px,3.4vw,52px)] gap-y-5">
          {MARKS.map((m) => (
            <li key={m.slug} className="group flex items-center gap-2.5 text-fg-2 transition-colors duration-300 hover:text-fg" style={{ "--brand": m.hover } as React.CSSProperties} title={m.role}>
              <svg viewBox="0 0 24 24" role="img" aria-label={m.name} className="size-6 fill-current transition-colors duration-300 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:text-[var(--brand)]">
                <path d={m.path} />
              </svg>
              <span className="text-[14.5px] font-medium">{m.name}</span>
            </li>
          ))}
        </ul>
      </Rise>
    </section>
  );
}

/* The live Lisbon trip in a phone. `embed` keeps the page from asking for a passkey inside the frame. */
function Phone() {
  return (
    <div className="relative h-[608px] w-[296px] rounded-[48px] bg-[#0b0b0c] p-[8px] shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_40px_80px_-30px_rgb(0_0_0/0.9)]">
      <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-void">
        <iframe
          src="/t/lis0312?embed=1"
          title="The live Lisbon trip"
          loading="lazy"
          tabIndex={-1}
          className="pointer-events-none origin-top-left border-0"
          style={{ width: 390, height: 784, transform: "scale(0.718)" }}
        />
        <span className="absolute left-1/2 top-2.5 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

const QS = [
  ["What if someone never pays?", "Their bed stays held only until the deadline you set. After that it goes to the first person on the waitlist, and nobody books until every bed is paid."],
  ["What if the booker never books?", "Then nobody is paid. If there’s no verified booking by the deadline, the contract refunds every bed automatically."],
  ["Can I get a refund?", "No. Your money holds a bed your friends are counting on. You can sell the bed at exactly what you paid; the first person on the waitlist takes it and the money goes straight to you."],
  ["Could someone resell a bed for profit?", "No. The contract has no price field: a bed only ever changes hands at face value."],
  ["Who can see the booking email?", "Nobody. It is checked inside two enclaves. Friends see the dates, the number of guests and the total."],
  ["Do I need a wallet or crypto?", "You pay USDC from your own wallet: a NEAR wallet, or MetaMask, OKX or Phantom on Base, Arbitrum, Ethereum or Solana. No NEAR wallet? A passkey on your phone holds your bed, and Dibs pays the gas."],
];

export function Questions() {
  return (
    <section className={`${wrap} py-[clamp(60px,9vw,140px)]`}>
      <Rise>
        <h2 className="display mb-8 text-[clamp(30px,3.2vw,44px)]">Questions</h2>
      </Rise>
      <Rise className="max-w-[760px]">
        <Accordion type="single" collapsible className="border-t border-line">
          {QS.map(([q, a]) => (
            <AccordionItem key={q} value={q} className="border-line">
              <AccordionTrigger className="group py-4 text-left text-[16px] font-medium text-fg hover:no-underline [&>svg]:hidden">
                {q}
                <Plus className="size-4 shrink-0 text-fg-2 transition-transform duration-300 ease-[var(--ease)] group-data-[state=open]:rotate-45" />
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-relaxed text-fg-2">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Rise>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={`${wrap} flex flex-col gap-4 border-t border-line py-8 text-[12.5px] text-fg-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex items-center gap-3">
        <Wordmark className="text-[17px] text-fg-2" />
        <span>Built at NEAR HACKATHON, November 2026</span>
      </div>
      <nav className="flex gap-4">
        <a href="#film" className="transition-colors hover:text-fg">how it works</a>
        <a href="#hood" className="transition-colors hover:text-fg">under the hood</a>
        <a href="https://github.com/RealMarsela/dibs" className="transition-colors hover:text-fg">source</a>
      </nav>
    </footer>
  );
}
