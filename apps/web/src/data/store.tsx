import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { PEOPLE, sampleTrip } from "./sample";
import type { Activity, ChainId, ProofFacts, Trip } from "./types";

/* Preview store. Every action here maps to one contract call in the wired build:
   pay -> bed account sweep, refuse -> request_refund (always panics), list -> list_for_resale,
   resell -> fill_from_waitlist, proof -> submit_booking_proof (OutLayer callback),
   draw -> draw_beds (OutLayer VRF), drawOut -> booker_draw (Sputnik transfer proposal). */

type Action =
  | { type: "pay"; n: number; who: string; chain: ChainId }
  | { type: "refuse"; n: number }
  | { type: "list"; n: number }
  | { type: "resell"; n: number }
  | { type: "join"; who: string }
  | { type: "proof"; facts: ProofFacts }
  | { type: "draw"; order: number[] }
  | { type: "drawOut" }
  | { type: "reset" };

let seq = 100;
const log = (kind: Activity["kind"], text: string, chain?: ChainId): Activity => ({
  id: `x${seq++}`,
  at: "just now",
  kind,
  text,
  chain,
});

function reduce(t: Trip, a: Action): Trip {
  const name = (id?: string) => (id ? PEOPLE[id]?.name ?? id : "someone");
  switch (a.type) {
    case "pay":
      return {
        ...t,
        spots: t.spots.map((s) => (s.n === a.n ? { ...s, status: "paid", holder: a.who, paidWith: a.chain } : s)),
        activity: [log("paid", `${name(a.who)} paid for spot ${a.n}`, a.chain), ...t.activity],
      };
    case "refuse": {
      const s = t.spots.find((x) => x.n === a.n);
      return { ...t, activity: [log("refused", `${name(s?.holder)} asked for a refund on spot ${a.n}. Refused by the contract.`), ...t.activity] };
    }
    case "list": {
      const s = t.spots.find((x) => x.n === a.n);
      return {
        ...t,
        spots: t.spots.map((x) => (x.n === a.n ? { ...x, status: "listed" } : x)),
        activity: [log("listed", `${name(s?.holder)} listed spot ${a.n} at face value`), ...t.activity],
      };
    }
    case "resell": {
      const s = t.spots.find((x) => x.n === a.n);
      const buyer = t.waitlist[0];
      if (!s || !buyer) return t;
      return {
        ...t,
        waitlist: t.waitlist.slice(1),
        spots: t.spots.map((x) => (x.n === a.n ? { ...x, status: "paid", holder: buyer, paidWith: "solana" } : x)),
        activity: [
          log("resold", `${name(buyer)} took spot ${a.n} from the waitlist. $${t.price} went to ${name(s.holder)} on ${s.paidWith === "solana" ? "Solana" : "their own chain"}.`, s.paidWith),
          ...t.activity,
        ],
      };
    }
    case "join":
      return t.waitlist.includes(a.who) ? t : { ...t, waitlist: [...t.waitlist, a.who] };
    case "proof":
      return { ...t, proof: a.facts, activity: [log("proof", `Booking verified: ${a.facts.signedBy}, ${a.facts.guests} guests, $${a.facts.total}`), ...t.activity] };
    case "draw":
      return {
        ...t,
        drawn: true,
        spots: t.spots.map((s, i) => ({ ...s, bed: t.beds[a.order[i]] })),
        activity: [log("draw", "Beds drawn fairly by OutLayer VRF"), ...t.activity],
      };
    case "drawOut":
      return { ...t, drawnOut: true, activity: [log("draw-out", `The crew DAO paid ${name(t.booker)} $${t.price * t.spots.length} for the booking`), ...t.activity] };
    case "reset":
      return sampleTrip();
  }
}

interface Ctx {
  trip: Trip;
  dispatch: (a: Action) => void;
  paidCount: number;
  funded: boolean;
}

const TripCtx = createContext<Ctx | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [trip, dispatch] = useReducer(reduce, undefined, sampleTrip);
  const value = useMemo(() => {
    const paidCount = trip.spots.filter((s) => s.status === "paid" || s.status === "listed").length;
    return { trip, dispatch, paidCount, funded: paidCount === trip.spots.length };
  }, [trip]);
  return <TripCtx.Provider value={value}>{children}</TripCtx.Provider>;
}

export function useTrip(): Ctx {
  const v = useContext(TripCtx);
  if (!v) throw new Error("useTrip outside TripProvider");
  return v;
}

/** Fisher-Yates on [0..n). Stand-in for the VRF output in the preview. */
export function shuffledOrder(n: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
