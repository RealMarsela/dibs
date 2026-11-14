import { useState } from "react";
import { useNavigate } from "react-router";
import { Minus, Plus } from "lucide-react";
import { Wordmark } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { Sweep } from "@/components/motion/sweep";
import { usd } from "@/lib/utils";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] text-fg-3">{hint}</span>}
    </label>
  );
}

const input = "h-12 rounded-2xl border-line bg-white/[0.04] px-4 text-[16px] text-fg placeholder:text-fg-3 focus-visible:ring-white/30";

export function NewTripPage() {
  const nav = useNavigate();
  const [beds, setBeds] = useState(8);
  const [price, setPrice] = useState(40);

  return (
    <div className="page-in min-h-dvh pb-20">
      <header className="mx-auto flex h-16 max-w-[1120px] items-center px-5">
        <Wordmark />
      </header>
      <main className="mx-auto max-w-[560px] px-5 pt-8">
        <Sweep
          as="h1"
          immediate
          className="text-[clamp(32px,4vw,44px)]"
          lines={[{ text: "Where’s the crew going?" }, { text: "Set the beds, the price, the deadline.", tone: "fg-2" }]}
        />
        <form
          className="glass rise-in mt-8 flex flex-col gap-5 p-6"
          style={{ animationDelay: "0.5s" }}
          onSubmit={(e) => {
            e.preventDefault();
            nav("/t/lis-0312");
          }}
        >
          <Field label="Destination">
            <Input className={input} defaultValue="Lisbon" required />
          </Field>
          <Field label="The stay">
            <Input className={input} defaultValue="Alfama flat with a roof terrace" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in">
              <Input type="date" className={input} defaultValue="2027-03-12" required />
            </Field>
            <Field label="Check out">
              <Input type="date" className={input} defaultValue="2027-03-15" required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label mb-1.5 block">Beds</span>
              <div className="flex h-12 items-center justify-between rounded-2xl border border-line bg-white/[0.04] px-1.5">
                <button type="button" className="press focus-ring rounded-xl p-2 text-fg-2 hover:bg-white/[0.06] hover:text-fg" aria-label="Fewer beds" onClick={() => setBeds((b) => Math.max(2, b - 1))}>
                  <Minus className="size-4" />
                </button>
                <span className="text-[17px] font-semibold tabular-nums">{beds}</span>
                <button type="button" className="press focus-ring rounded-xl p-2 text-fg-2 hover:bg-white/[0.06] hover:text-fg" aria-label="More beds" onClick={() => setBeds((b) => Math.min(16, b + 1))}>
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <Field label="Price per bed (USDC)">
              <Input type="number" min={1} className={input} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} required />
            </Field>
          </div>
          <Field label="Book by" hint="No verified booking by then, and every bed is refunded automatically.">
            <Input type="datetime-local" className={input} required defaultValue="2026-11-20T18:00" />
          </Field>
          <p className="display text-[18px]">
            {beds} beds × {usd(price, 0)} = {usd(beds * price, 0)}. <span className="tone-2">Held by the crew’s own DAO until the booking is proven.</span>
          </p>
          <button type="submit" className="pill-light focus-ring press h-11 w-full">
            Create the trip
          </button>
        </form>
      </main>
    </div>
  );
}
