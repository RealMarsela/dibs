import { Link } from "react-router";
import { Link2, Plus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LetterFace } from "@/components/motion/face";
import { Rise } from "@/components/motion/rise";
import { Sweep } from "@/components/motion/sweep";
import { Wordmark } from "@/components/bits";

const wrap = "mx-auto w-full max-w-[1680px] px-[clamp(20px,6vw,128px)]";

const FLOAT = [
  { k: "f", name: "Zara", x: 8, y: 30, s: 46 },
  { k: "c", t: "USDC on Base", x: 20, y: 62 },
  { k: "f", name: "Ravi", x: 30, y: 18, s: 38 },
  { k: "c", t: "SOL", x: 34, y: 78 },
  { k: "f", name: "Elif", x: 62, y: 74, s: 42 },
  { k: "c", t: "USDC on Arbitrum", x: 70, y: 22 },
  { k: "f", name: "Mateo", x: 84, y: 48, s: 50 },
  { k: "c", t: "ETH", x: 88, y: 76 },
  { k: "f", name: "Aiko", x: 14, y: 84, s: 34 },
  { k: "c", t: "NEAR", x: 50, y: 88 },
  { k: "f", name: "Kwame", x: 76, y: 8, s: 36 },
] as const;

export function LinkSection() {
  return (
    <section className="relative flex min-h-[86svh] items-center justify-center overflow-hidden px-5 py-24">
      <Rise className="pointer-events-none absolute inset-0">
        {FLOAT.map((f, i) => (
          <div
            key={i}
            className="cf-b absolute"
            style={{ left: `${f.x}%`, top: `${f.y}%`, ["--bob" as string]: "4px", ["--bobT" as string]: `${2.4 + (i % 4) * 0.4}s`, ["--ph1" as string]: `${-i * 0.37}s` }}
          >
            {f.k === "f" ? (
              <LetterFace name={f.name} size={f.s} />
            ) : (
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-medium text-fg-2 ring-1 ring-white/10">{f.t}</span>
            )}
          </div>
        ))}
      </Rise>
      <div className="relative z-10 flex flex-col items-center text-center">
        <Sweep className="flex items-center gap-3 text-[clamp(30px,3.6vw,48px)]" lines={[{ text: "A link is all it takes." }]} />
        <Link2 className="mt-4 size-6 text-fg-2" aria-hidden />
        <Rise delay={500} className="mt-7">
          <Link to="/t/lis-0312" className="pill-light focus-ring press h-11 px-6 text-[15px]">
            Open the Lisbon trip
          </Link>
        </Rise>
      </div>
    </section>
  );
}

const TERMS = [
  ["Dibs is free.", "You pay network fees: cents, not percent."],
  ["No refunds. Ever.", "Sell your bed at what you paid. The waitlist takes it on the spot."],
  ["Nobody holds the money.", "The crew’s own DAO does, and only a verified booking unlocks it."],
  ["Miss the deadline?", "Everyone is refunded automatically. No one has to ask."],
];

export function Terms() {
  return (
    <section className={`${wrap} py-[clamp(80px,12vw,180px)]`}>
      <div className="flex max-w-[900px] flex-col gap-7">
        {TERMS.map(([a, b], i) => (
          <Rise key={a} delay={i * 60}>
            <p className="display text-[clamp(26px,2.9vw,42px)]">
              {a} <span className="tone-2">{b}</span>
            </p>
          </Rise>
        ))}
        <Rise delay={300}>
          <Link to="/new" className="pill-light focus-ring press mt-2">
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
  ["NEAR Intents.", "Pay from Base, Solana, Arbitrum or Ethereum. Resale money goes back out to the chain you came from."],
  ["OutLayer.", "The trip contract itself asks an Intel TDX enclave whether the booking email is real, then checks the signed answer."],
  ["NEAR AI Cloud.", "Reads the email inside a GPU enclave. Friends see dates, guests and the total. Never names, address or card."],
  ["A fair draw.", "A verifiable random number decides who sleeps where."],
  ["Passkeys.", "No wallet, no seed phrase, no gas. Your phone is the key to your bed."],
];

export function Hood() {
  return (
    <section id="hood" className={`${wrap} py-[clamp(60px,9vw,140px)]`}>
      <Rise>
        <p className="mb-8 text-[13.5px] text-fg-2">Under the hood</p>
      </Rise>
      <div className="grid max-w-[1100px] gap-x-16 gap-y-8 md:grid-cols-2">
        {HOOD.map(([a, b], i) => (
          <Rise key={a} delay={(i % 2) * 80}>
            <p className="text-[clamp(18px,1.5vw,23px)] font-medium leading-snug tracking-[-0.012em]">
              {a} <span className="tone-2">{b}</span>
            </p>
          </Rise>
        ))}
      </div>
    </section>
  );
}

const QS = [
  ["What if someone never pays?", "Their bed stays held only until the deadline you set. After that it goes to the first person on the waitlist, and nobody books until every bed is paid."],
  ["What if the booker never books?", "Then nobody is paid. If there’s no verified booking by the deadline, the contract refunds every bed automatically."],
  ["Can I get a refund?", "No. Your money holds a bed your friends are counting on. You can sell the bed at exactly what you paid; the first person on the waitlist takes it and the money goes straight to you."],
  ["Could someone resell a bed for profit?", "No. The contract has no price field: a bed only ever changes hands at face value."],
  ["Who can see the booking email?", "Nobody. It is checked inside two enclaves. Friends see the dates, the number of guests and the total."],
  ["Do I need a wallet or crypto?", "You need USDC on any of the supported chains, or on NEAR. A passkey on your phone holds your bed, and Dibs pays the gas."],
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
