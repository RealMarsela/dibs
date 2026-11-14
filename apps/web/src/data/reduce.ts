import { PEOPLE, sampleTrip } from "./sample";
import type { Activity, ChainId, ProofFacts, Trip } from "./types";

/* Preview engine: the same steps the contract takes, on local sample data, for the showcase trip. */
export type Action =
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
const log = (kind: Activity["kind"], text: string, chain?: ChainId): Activity => ({ id: `x${seq++}`, at: "just now", kind, text, chain });
const name = (id?: string) => (id ? PEOPLE[id]?.name ?? id : "someone");

export function reduce(t: Trip, a: Action): Trip {
  switch (a.type) {
    case "pay":
      return {
        ...t,
        spots: t.spots.map((s) => (s.n === a.n ? { ...s, status: "paid", holder: a.who, paidWith: a.chain } : s)),
        activity: [log("paid", `${name(a.who)} paid for bed ${a.n}`, a.chain), ...t.activity],
      };
    case "refuse": {
      const s = t.spots.find((x) => x.n === a.n);
      return { ...t, activity: [log("refused", `${name(s?.holder)} asked for a refund on bed ${a.n}. Refused by the contract.`), ...t.activity] };
    }
    case "list": {
      const s = t.spots.find((x) => x.n === a.n);
      const next = { ...t, spots: t.spots.map((x) => (x.n === a.n ? { ...x, status: "listed" as const } : x)), activity: [log("listed", `${name(s?.holder)} listed bed ${a.n} at face value`), ...t.activity] };
      return next;
    }
    case "resell": {
      const s = t.spots.find((x) => x.n === a.n);
      const buyer = t.waitlist[0];
      if (!s || !buyer) return t;
      return {
        ...t,
        waitlist: t.waitlist.slice(1),
        spots: t.spots.map((x) => (x.n === a.n ? { ...x, status: "paid", holder: buyer, paidWith: "solana" } : x)),
        activity: [log("resold", `${name(buyer)} took bed ${a.n} from the waitlist. $${t.price} went to ${name(s.holder)}.`, s.paidWith), ...t.activity],
      };
    }
    case "join":
      return t.waitlist.includes(a.who) ? t : { ...t, waitlist: [...t.waitlist, a.who] };
    case "proof":
      return { ...t, proof: a.facts, activity: [log("proof", `Booking verified: ${a.facts.signedBy}, ${a.facts.guests} guests, $${a.facts.total}`), ...t.activity] };
    case "draw":
      return { ...t, drawn: true, spots: t.spots.map((s, i) => ({ ...s, bed: t.beds[a.order[i]] })), activity: [log("draw", "Beds drawn fairly by OutLayer VRF"), ...t.activity] };
    case "drawOut":
      return { ...t, drawnOut: true, activity: [log("draw-out", `The crew DAO paid ${name(t.booker)} $${t.price * t.spots.length} for the booking`), ...t.activity] };
    case "reset":
      return sampleTrip();
  }
}
