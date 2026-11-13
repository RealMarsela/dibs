import { Link } from "react-router";
import { ArrowRight, Check, X } from "lucide-react";
import { Wordmark } from "@/components/bits";

export function Problem() {
  return (
    <section className="border-y border-rule bg-card/50">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.2fr] md:py-20">
        <div>
          <p className="eyebrow">The problem</p>
          <h2 className="mt-3 text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[42px]">
            Someone always fronts the money. Someone always flakes.
          </h2>
        </div>
        <figure className="ticket self-start p-6">
          <blockquote className="text-[20px] font-medium leading-snug tracking-[-0.01em]">
            “Last year, I had to pay $600 from my pocket as everyone was saying ‘pay me later.’ Only half of them actually paid me later, though.”
          </blockquote>
          <figcaption className="mt-4 font-mono text-[12px] text-ink-faint">A group-trip organiser on Reddit, February 2026</figcaption>
        </figure>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Everyone pays for their own bed", d: "Each bed is its own account on NEAR. Pay in USDC from Base, Solana, Arbitrum, Ethereum or NEAR. Nobody books until all of them are paid." },
  { n: "02", t: "The booker books, then proves it", d: "Drop in the confirmation email. It is checked privately inside two enclaves, and the crew DAO pays the booker only if it’s real." },
  { n: "03", t: "Can’t make it? Sell your bed", d: "There are no refunds. List your bed at what you paid; the first person on the waitlist takes it and you’re paid on your own chain." },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 md:py-24">
      <p className="eyebrow">How it works</p>
      <h2 className="mt-3 max-w-[640px] text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[42px]">Three rules. The contract keeps them, so you don’t have to.</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="ticket p-6">
            <p className="font-mono text-[30px] font-semibold tracking-[-0.04em] text-ink-faint">{s.n}</p>
            <h3 className="mt-3 text-[20px] font-bold leading-snug tracking-[-0.02em]">{s.t}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TRUST = [
  { risk: "The booker fronts the money", today: "Chases friends for weeks", dibs: "Never fronts a cent: every bed is paid first" },
  { risk: "Friends trust the booker", today: "Hope the money became a booking", dibs: "Money moves only for a verified booking" },
  { risk: "Someone drops out", today: "The rest cover their share", dibs: "They sell the bed; the waitlist fills it" },
  { risk: "Nobody books in time", today: "Money stuck with one person", dibs: "Everyone refunded automatically" },
];

export function Trust() {
  return (
    <section className="mx-auto max-w-[1120px] px-4 pb-16 sm:px-6 md:pb-24">
      <div className="ticket overflow-hidden">
        <div className="hidden grid-cols-[1.1fr_1fr_1.2fr] border-b border-rule bg-paper-deep/50 px-4 py-3 sm:grid font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint sm:px-6">
          <span>Who’s at risk</span>
          <span>Today</span>
          <span>With Dibs</span>
        </div>
        {TRUST.map((r) => (
          <div key={r.risk} className="flex flex-col gap-2 border-b border-dashed border-rule px-4 py-4 text-[14px] last:border-0 sm:grid sm:grid-cols-[1.1fr_1fr_1.2fr] sm:items-start sm:gap-3 sm:px-6 sm:text-[15px]">
            <span className="font-semibold">{r.risk}</span>
            <span className="flex gap-1.5 text-ink-soft"><X className="mt-0.5 size-4 shrink-0 text-stamp" />{r.today}</span>
            <span className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-paid" />{r.dibs}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const STACK = [
  { k: "Sputnik DAO + Trezu", v: "The crew’s pot lives in its own DAO. The booker’s payout is a DAO proposal anyone can open in Trezu." },
  { k: "Global contracts", v: "Every bed is its own keyless account, all running one shared contract. About a tenth of a cent each." },
  { k: "NEAR Intents · 1Click", v: "Pay from any chain in. Resale money and refunds go back out to the chain you paid from." },
  { k: "OutLayer", v: "The trip contract itself asks an Intel TDX enclave whether the booking email is real, and verifies the signed answer on-chain." },
  { k: "NEAR AI Cloud", v: "Reads the email inside a GPU enclave. Friends see dates, guests and total. Never names, address or card." },
  { k: "OutLayer VRF", v: "A verifiable random draw decides who sleeps where. No dibs for whoever shouts first." },
  { k: "Passkeys + gasless calls", v: "Friends never touch NEAR tokens, gas or a seed phrase." },
];

export function UnderTheHood() {
  return (
    <section id="hood" className="bg-ink text-card">
      <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 md:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-card/50">Under the hood</p>
        <h2 className="mt-3 max-w-[680px] text-[34px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[42px]">Nobody has to trust anybody. NEAR does the checking.</h2>
        <dl className="mt-10 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {STACK.map((s) => (
            <div key={s.k} className="border-t border-card/15 pt-4">
              <dt className="font-mono text-[13px] font-semibold text-sun">{s.k}</dt>
              <dd className="mt-1.5 text-[15.5px] leading-relaxed text-card/80">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className="mx-auto max-w-[1120px] px-4 py-20 text-center sm:px-6">
      <h2 className="mx-auto max-w-[620px] text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[48px]">Call dibs. Then actually pay for it.</h2>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/t/lis-0312" className="btn-ink focus-ring">Open the Lisbon trip <ArrowRight className="size-4" /></Link>
        <Link to="/new" className="btn-paper focus-ring">Start a trip</Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-8 text-[13px] text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Wordmark />
        <p>Built at NEAR HACKATHON, November 2026. Open source.</p>
      </div>
    </footer>
  );
}
