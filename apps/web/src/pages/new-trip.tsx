import { useState } from "react";
import { useNavigate } from "react-router";
import { Fingerprint, Loader2, Minus, Plus, Wallet } from "lucide-react";
import { Wordmark } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { DateField, ymd } from "@/components/date-field";
import { Sweep } from "@/components/motion/sweep";
import { usd } from "@/lib/utils";
import { authNonce, createTrip } from "@/live/api";
import { signErc191 } from "@/live/evm-wallet";
import { connectNear, disconnectNear, isEthAccount, nearError, signInNear, type NearSession } from "@/live/near-wallet";
import { deviceKey } from "@/live/passkey";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] text-fg-3">{hint}</span>}
    </div>
  );
}

function Stepper({ value, set, min, max, label, format = String }: { value: number; set: (n: number) => void; min: number; max: number; label: string; format?: (n: number) => string }) {
  return (
    <div className="flex h-12 items-center justify-between rounded-2xl border border-line bg-white/[0.04] px-1.5">
      <button type="button" className="press focus-ring rounded-xl p-2 text-fg-2 hover:bg-white/[0.06] hover:text-fg disabled:opacity-30" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => set(Math.max(min, value - 1))}>
        <Minus className="size-4" />
      </button>
      <span className="text-[17px] font-semibold tabular-nums">{format(value)}</span>
      <button type="button" className="press focus-ring rounded-xl p-2 text-fg-2 hover:bg-white/[0.06] hover:text-fg disabled:opacity-30" aria-label={`More ${label}`} disabled={value >= max} onClick={() => set(Math.min(max, value + 1))}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

const input = "h-12 rounded-2xl border-line bg-white/[0.04] px-4 text-[16px] text-fg placeholder:text-fg-3 focus-visible:ring-white/30";
const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/* Creates a real trip on NEAR testnet: the API's relayer calls create_trip, holds bed 1 for the booker, and opens the
   trip's inbox address. The booker signs in with their own NEAR wallet (NEP-413 message, one-time server nonce, no gas)
   and receives the payout there; a passkey on this device is the judge demo for anyone without a wallet. */
export function NewTripPage() {
  const nav = useNavigate();
  const [place, setPlace] = useState("");
  const [stay, setStay] = useState("");
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [beds, setBeds] = useState(4);
  const [price, setPrice] = useState(25);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [booker, setBooker] = useState<NearSession | null>(null);
  const [passkey, setPasskey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // Fetched as soon as the wallet connects, so the tap on "Sign in and create" opens the wallet's signing tab at once
  // (browsers block window.open once a tap is followed by network round trips).
  const [nonce, setNonce] = useState<Awaited<ReturnType<typeof authNonce>> | null>(null);
  const freshNonce = () => authNonce().then(setNonce, () => setNonce(null));
  const ready = place.trim().length > 1 && stay.trim().length > 1 && checkIn && checkOut && checkOut > checkIn && (booker || passkey);

  async function connect() {
    setConnecting(true);
    setErr(null);
    try {
      setBooker(await connectNear("testnet"));
      setPasskey(false);
      void freshNonce();
    } catch (e2) {
      setErr(nearError(e2, "your NEAR wallet"));
    } finally {
      setConnecting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !checkIn || !checkOut) return;
    setBusy(true);
    setErr(null);
    try {
      const base = { place: place.trim(), stay: stay.trim(), check_in: ymd(checkIn), check_out: ymd(checkOut), beds, price_usdc: price };
      let r;
      if (booker) {
        const n = nonce ?? (await authNonce());
        setNonce(null);
        // Ethereum Wallets accounts cannot signMessage through NEAR Connect: the same EVM wallet proves the 0x address (ERC-191).
        const auth = isEthAccount(booker.accountId)
          ? { address: booker.accountId, signature: await signErc191(booker.accountId, n.erc191_message), nonce: n.nonce, message: n.erc191_message }
          : await signInNear("testnet", booker, n.message, n.recipient, n.nonce);
        r = await createTrip({ ...base, booker: booker.accountId, auth });
      } else {
        r = await createTrip({ ...base, booker: (await deviceKey()).accountId });
      }
      nav(r.url);
    } catch (e2) {
      setErr(booker ? nearError(e2, booker.wallet) : e2 instanceof Error ? e2.message : "Could not create the trip");
      setBusy(false);
      if (booker) void freshNonce(); // a nonce is single use; the retry needs a new one
    }
  }

  return (
    <div className="page-in min-h-dvh pb-20">
      <header className="mx-auto flex h-16 max-w-[1120px] items-center px-5">
        <Wordmark />
      </header>
      <main className="mx-auto max-w-[560px] px-5 pt-8">
        <Sweep as="h1" immediate className="text-[clamp(32px,4vw,44px)]" lines={[{ text: "Where’s the crew going?" }, { text: "You hold bed 1. Share the link for the rest.", tone: "fg-2" }]} />
        <form className="glass rise-in mt-8 flex flex-col gap-5 p-6" style={{ animationDelay: "0.5s" }} onSubmit={submit}>
          <Field label="Destination">
            <Input className={input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lisbon" maxLength={40} required />
          </Field>
          <Field label="The stay">
            <Input className={input} value={stay} onChange={(e) => setStay(e.target.value)} placeholder="Alfama flat with a roof terrace" maxLength={60} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in">
              <DateField label="Check in" value={checkIn} min={today()} onChange={(d) => (setCheckIn(d), checkOut && checkOut <= d && setCheckOut(undefined))} />
            </Field>
            <Field label="Check out">
              <DateField label="Check out" value={checkOut} min={checkIn ?? today()} onChange={setCheckOut} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Beds">
              <Stepper label="beds" value={beds} set={setBeds} min={2} max={6} />
            </Field>
            <Field label="Price per bed">
              <Stepper label="price" value={price} set={setPrice} min={1} max={50} format={(n) => usd(n, 0)} />
            </Field>
          </div>
          <p className="display text-[18px]">
            {beds} beds × {usd(price, 0)} = {usd(beds * price, 0)}. <span className="tone-2">Held by a crew DAO until the booking is proven. Book within 3 days or everyone is refunded.</span>
          </p>
          <Field label="You book it" hint={booker ? "The payout goes to this wallet once a real booking is proven. You sign one message; no gas." : undefined}>
            {booker ? (
              <div className="flex h-12 items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.04] pl-4 pr-1.5">
                <span className="flex min-w-0 items-center gap-2 text-[14.5px]">
                  <Wallet className="size-4 shrink-0 text-fg-2" />
                  <span className="truncate font-semibold">{booker.accountId}</span>
                  <span className="shrink-0 text-fg-3">{booker.wallet}</span>
                </span>
                <button type="button" className="press focus-ring shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] text-fg-3 hover:text-fg" onClick={() => void disconnectNear("testnet").then(() => setBooker(null))}>
                  Disconnect
                </button>
              </div>
            ) : passkey ? (
              <div className="flex h-12 items-center justify-between gap-3 rounded-2xl border border-line bg-white/[0.04] pl-4 pr-1.5">
                <span className="flex items-center gap-2 text-[14.5px]"><Fingerprint className="size-4 text-fg-2" /> A passkey on this device</span>
                <button type="button" className="press focus-ring rounded-xl px-3 py-1.5 text-[12.5px] text-fg-3 hover:text-fg" onClick={() => setPasskey(false)}>
                  Use a wallet
                </button>
              </div>
            ) : (
              <>
                <button type="button" className="pill-dark focus-ring press h-12 w-full" disabled={connecting} onClick={connect}>
                  {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                  Connect a NEAR wallet
                </button>
                <button type="button" className="focus-ring mt-2 w-full rounded-md text-center text-[12.5px] text-fg-3 underline decoration-white/20 underline-offset-4 hover:text-fg" onClick={() => setPasskey(true)}>
                  Judge demo: no wallet, use a passkey on this device
                </button>
              </>
            )}
          </Field>
          {err && <p className="rounded-xl bg-refused/10 px-3 py-2 text-[13.5px] text-refused" role="alert">{err}</p>}
          <button type="submit" disabled={!ready || busy} className="pill-light focus-ring press h-11 w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? (booker ? "Sign in your wallet, then creating it on NEAR…" : "Creating it on NEAR…") : booker ? "Sign in and create the trip" : "Create the trip"}
          </button>
          <p className="text-center text-[12px] text-fg-3">NEAR testnet · test USDC · up to 6 beds and $50 a bed</p>
        </form>
      </main>
    </div>
  );
}
