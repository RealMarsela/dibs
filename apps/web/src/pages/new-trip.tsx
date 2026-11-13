import { useState } from "react";
import { useNavigate } from "react-router";
import { Minus, Plus } from "lucide-react";
import { Wordmark } from "@/components/bits";
import { usd } from "@/lib/utils";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow mb-1.5 block">{children}</span>;
}

const input = "focus-ring h-12 w-full rounded-xl border border-rule-strong bg-card px-4 text-[16px] placeholder:text-ink-faint";

export function NewTripPage() {
  const nav = useNavigate();
  const [beds, setBeds] = useState(8);
  const [price, setPrice] = useState(40);

  return (
    <div className="min-h-dvh pb-16">
      <header className="mx-auto flex h-14 max-w-[1120px] items-center px-4 sm:px-6">
        <Wordmark />
      </header>
      <main className="mx-auto max-w-[560px] px-4 pt-6 sm:px-6">
        <p className="eyebrow">New trip</p>
        <h1 className="mt-2 text-[36px] font-extrabold leading-[1.02] tracking-[-0.035em]">Where’s the crew going?</h1>
        <form
          className="ticket mt-7 flex flex-col gap-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            nav("/t/lis-0312");
          }}
        >
          <label>
            <Label>Destination</Label>
            <input className={input} defaultValue="Lisbon" required />
          </label>
          <label>
            <Label>The stay</Label>
            <input className={input} defaultValue="Alfama flat with a roof terrace" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <Label>Check in</Label>
              <input type="date" className={input} defaultValue="2027-03-12" required />
            </label>
            <label>
              <Label>Check out</Label>
              <input type="date" className={input} defaultValue="2027-03-15" required />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Beds</Label>
              <div className="flex h-12 items-center justify-between rounded-xl border border-rule-strong bg-card px-2">
                <button type="button" className="focus-ring rounded-lg p-2 hover:bg-paper-deep" aria-label="Fewer beds" onClick={() => setBeds((b) => Math.max(2, b - 1))}>
                  <Minus className="size-4" />
                </button>
                <span className="font-mono text-[18px] font-semibold">{beds}</span>
                <button type="button" className="focus-ring rounded-lg p-2 hover:bg-paper-deep" aria-label="More beds" onClick={() => setBeds((b) => Math.min(20, b + 1))}>
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <label>
              <Label>Price per bed (USD)</Label>
              <input type="number" min={1} className={input} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} required />
            </label>
          </div>
          <label>
            <Label>Book by</Label>
            <input type="datetime-local" className={input} required defaultValue="2026-11-20T18:00" />
            <span className="mt-1.5 block text-[13px] text-ink-faint">No verified booking by then and every bed is refunded automatically.</span>
          </label>
          <div className="rounded-xl bg-paper-deep/60 px-4 py-3 text-[14px]">
            {beds} beds × {usd(price, 0)} = <span className="font-semibold">{usd(beds * price, 0)}</span> held by the crew’s own DAO until the booking is proven.
          </div>
          <button type="submit" className="btn-ink focus-ring w-full">
            Create the trip
          </button>
        </form>
      </main>
    </div>
  );
}
