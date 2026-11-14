import { PEOPLE } from "@/data/sample";
import type { Activity, ChainId, Spot, SpotStatus, Trip } from "@/data/types";
import type { TripView } from "@/live/api";

/* The contract's view of a trip, turned into the shape the UI already draws. Display names come from the API's
   name book; a person without a name shows as "Friend 1a2b". Each account is registered in PEOPLE once, so every
   face and label in the app resolves the same way in preview and live. */

const PLACES: Record<string, { place: string; country: string; beds: string[] }> = {
  lis0312: {
    place: "Lisbon",
    country: "Portugal",
    beds: ["Double room, window side", "Double room, courtyard side", "Bunk room A, top", "Bunk room A, bottom", "Bunk room B, top", "Bunk room B, bottom", "Loft single", "Sofa bed by the terrace"],
  },
  get lis0314() {
    return PLACES.lis0312;
  },
  sin1025: { place: "Singapore", country: "Singapore", beds: ["Twin bed by the window", "Twin bed by the door"] },
  drw0001: { place: "Draw test", country: "Testnet", beds: ["Bed one", "Bed two"] },
  lismain: { place: "Lisbon", country: "Portugal", beds: ["Double room, window side", "Double room, courtyard side"] },
  lismain2: { place: "Lisbon", country: "Portugal", beds: ["Double room, river view", "Twin room, garden side"] },
};

const CHAIN: Record<string, ChainId> = { base: "base", sol: "solana", solana: "solana", arb: "arbitrum", arbitrum: "arbitrum", eth: "ethereum", ethereum: "ethereum", near: "near" };

function hueOf(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function displayName(account: string, names: Record<string, string>): string {
  if (names[account]) return names[account];
  const first = account.split(".")[0];
  if (/^[0-9a-f]{64}$/.test(account)) return `Friend ${account.slice(0, 4)}`;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Registers an account so Face/PEOPLE lookups work; known demo friends keep their colours. */
export function register(account: string, names: Record<string, string>): string {
  if (!PEOPLE[account]) {
    const short = account.split(".")[0];
    const known = PEOPLE[short];
    PEOPLE[account] = { id: account, name: displayName(account, names), hue: known?.hue ?? hueOf(account) };
  } else if (names[account]) {
    PEOPLE[account].name = names[account];
  }
  return account;
}

export function toTrip(view: TripView, names: Record<string, string>, activity: Activity[]): Trip {
  const t = view.trip;
  const meta = PLACES[view.code] ?? { place: view.meta?.place ?? view.code.toUpperCase(), country: view.meta?.country ?? "", beds: t.beds.map((_, i) => `Bed ${i + 1}`) };
  const price = Number(t.price) / 1e6;
  const drawn = Array.isArray(t.drawn) && t.drawn.length === t.beds.length ? t.drawn : null;
  const spots: Spot[] = t.beds.map((b, i) => {
    const status = b.status.toLowerCase() as SpotStatus;
    const holder = b.holder ? register(b.holder, names) : undefined;
    return {
      n: i + 1,
      status,
      holder,
      paidWith: b.paid_from_chain ? CHAIN[b.paid_from_chain.toLowerCase()] ?? "near" : status === "paid" ? "near" : undefined,
      bed: drawn ? meta.beds[(drawn[i] ?? i + 1) - 1] : undefined,
    };
  });
  const payoutDone = typeof t.payout === "string" ? /done|approved/i.test(t.payout) : !!t.payout && /Done|Approved/.test(JSON.stringify(t.payout));
  return {
    code: view.code.toUpperCase(),
    place: meta.place,
    country: meta.country,
    stay: t.stay ?? "",
    checkIn: t.check_in,
    checkOut: t.check_out,
    price,
    bookBy: new Date(Number(BigInt(t.book_by) / 1_000_000n)).toISOString(),
    booker: register(t.booker, names),
    beds: meta.beds,
    spots,
    waitlist: t.waitlist.map((w) => register(w.buyer, names)),
    proof: t.proof
      ? {
          stay: t.proof.stay,
          checkIn: t.proof.check_in,
          checkOut: t.proof.check_out,
          guests: t.proof.guests,
          total: Number(t.proof.total) / 1e6,
          signedBy: t.proof.dkim_domain,
          currency: t.proof.currency,
        }
      : undefined,
    drawn: !!drawn,
    drawnOut: payoutDone,
    activity,
  };
}
