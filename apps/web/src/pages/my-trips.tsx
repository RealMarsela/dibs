import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Fingerprint, Loader2, Wallet } from "lucide-react";
import { Face, Wordmark } from "@/components/bits";
import { PEOPLE } from "@/data/sample";
import { register } from "@/live/adapt";
import { myTrips, names, type MyTrip } from "@/live/api";
import { connectNear, nearError, rememberedNear } from "@/live/near-wallet";
import { rememberedEvm } from "@/live/evm-wallet";
import { deviceKey, rememberedDevice } from "@/live/passkey";
import { stayDates, usd } from "@/lib/utils";

/* Every trip this person is in, read from the API's index of who created, holds or waits for what. "This person" is
   whoever this browser is signed in as: the passkey account, a NEAR wallet, an EVM wallet (up to three at once). */
type Who = { id: string; label: string };

function knownAccounts(): Who[] {
  const out: Who[] = [];
  const add = (id: string | null | undefined, label: string) => id && !out.some((w) => w.id === id) && out.push({ id, label });
  add(rememberedDevice(), "this device");
  add(rememberedNear("testnet")?.accountId, "NEAR wallet");
  add(rememberedEvm("testnet"), "EVM wallet");
  add(rememberedNear("mainnet")?.accountId, "NEAR wallet · mainnet");
  add(rememberedEvm("mainnet"), "EVM wallet · mainnet");
  return out.slice(0, 3);
}

const STATUS: Record<MyTrip["status"], { text: (t: MyTrip) => string; tone: string }> = {
  filling: { text: (t) => `${t.paid} of ${t.n_beds} paid`, tone: "bg-white/[0.07] text-fg-2" },
  all_paid: { text: () => "Every bed paid", tone: "bg-paid/15 text-paid" },
  booked: { text: () => "Booked", tone: "bg-paid/15 text-paid" },
  refunded: { text: () => "Refunded", tone: "bg-white/[0.07] text-fg-2" },
};

function roleLine(t: MyTrip): string {
  const parts = t.roles.map((r) => (r.role === "booker" ? "You’re the booker" : r.role === "bed" ? `Bed ${String(r.n ?? "").padStart(2, "0")}` : `Waitlist #${r.n ?? ""}`));
  return [...new Set(parts)].join(" · ");
}

export function MyTripsPage() {
  const [who, setWho] = useState<Who[]>(knownAccounts);
  const [trips, setTrips] = useState<MyTrip[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "passkey" | "near">("");

  const load = useCallback(async (list: Who[]) => {
    if (!list.length) return setTrips([]);
    setErr(null);
    setTrips(null);
    try {
      const ids = list.map((w) => w.id);
      const [r, n] = await Promise.all([myTrips(ids), names(ids).catch(() => ({}))]);
      ids.forEach((id) => register(id, n));
      setTrips(r.trips);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t load your trips");
    }
  }, []);
  useEffect(() => void load(who), [who, load]);

  async function signIn(kind: "passkey" | "near") {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === "passkey") await deviceKey();
      else await connectNear("testnet");
      setWho(knownAccounts());
    } catch (e) {
      setErr(kind === "near" ? nearError(e, "your NEAR wallet") : e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page-in min-h-dvh pb-24">
      <header className="mx-auto flex h-16 max-w-[820px] items-center justify-between px-5">
        <Wordmark />
        <Link to="/new" className="pill-light pill-sm focus-ring press">Start a trip</Link>
      </header>
      <main className="mx-auto max-w-[820px] px-5">
        <h1 className="display mt-10 text-[clamp(34px,5vw,52px)]">Your trips</h1>
        {who.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-fg-3">Signed in as</span>
            {who.map((w) => (
              <span key={w.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-[13px]">
                <Face id={w.id} size={22} />
                <span className="font-semibold">{PEOPLE[w.id]?.name ?? (w.id.length > 20 ? `${w.id.slice(0, 6)}…${w.id.slice(-4)}` : w.id)}</span>
                <span className="text-fg-3">{w.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3" aria-live="polite">
          {err && (
            <div className="rounded-2xl bg-refused/10 px-4 py-3 text-[14px] text-refused">
              {err}{" "}
              <button className="underline underline-offset-4" onClick={() => void load(who)}>Try again</button>
            </div>
          )}
          {trips === null && !err && [0, 1, 2].map((i) => <div key={i} className="glass h-[104px] animate-pulse rounded-[24px]" />)}
          {trips?.map((t) => {
            const st = STATUS[t.status];
            return (
              <Link key={t.code} to={`/t/${t.code}`} className="glass press focus-ring group flex items-center gap-4 rounded-[24px] p-5 hover:bg-white/[0.07]">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="display truncate text-[24px]">{t.place}</span>
                    <span className="font-mono text-[11.5px] text-fg-3">{t.code.toUpperCase()}{t.network === "mainnet" ? " · mainnet" : ""}</span>
                  </div>
                  <p className="mt-1 truncate text-[14px] text-fg-2">{t.stay} · {stayDates(t.check_in, t.check_out).label} · {usd(t.price_usdc, 0)} a bed</p>
                  <p className="mt-2 text-[13px] text-fg-3">{roleLine(t)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium ${st.tone}`}>{st.text(t)}</span>
                <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            );
          })}
          {trips?.length === 0 && (
            <div className="glass rounded-[24px] p-6">
              <p className="display text-[22px]">{who.length ? "No trips yet." : "Sign in to see your trips."}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">
                {who.length
                  ? "Start one and invite your friends, or take a bed from a link someone sent you."
                  : "Trips you start, hold a bed in or wait for show up here, for the passkey on this device or your wallet."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/new" className="pill-light focus-ring press">Start a trip</Link>
                {!who.length && (
                  <>
                    <button className="pill-dark focus-ring press" disabled={!!busy} onClick={() => void signIn("near")}>
                      {busy === "near" ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />} Connect a NEAR wallet
                    </button>
                    <button className="pill-dark focus-ring press" disabled={!!busy} onClick={() => void signIn("passkey")}>
                      {busy === "passkey" ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />} Use this device’s passkey
                    </button>
                  </>
                )}
                <Link to="/t/lis-0312" className="focus-ring self-center px-2 text-[13px] text-fg-2 underline decoration-white/20 underline-offset-4 hover:text-fg">
                  See an example trip
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
