import type { Chain, ChainId, Person, Trip } from "./types";

export const CHAINS: Record<ChainId, Chain> = {
  near: { id: "near", name: "NEAR", token: "USDC", fee: 0, eta: "2 s" },
  base: { id: "base", name: "Base", token: "USDC", fee: 0.0105, eta: "about 35 s" },
  solana: { id: "solana", name: "Solana", token: "USDC", fee: 0.009, eta: "about 25 s" },
  arbitrum: { id: "arbitrum", name: "Arbitrum", token: "USDC", fee: 0.011, eta: "about 40 s" },
  ethereum: { id: "ethereum", name: "Ethereum", token: "USDC", fee: 0.018, eta: "about 3 min" },
};

export const PEOPLE: Record<string, Person> = {
  maya: { id: "maya", name: "Maya", hue: 14 },
  sam: { id: "sam", name: "Sam", hue: 200 },
  leo: { id: "leo", name: "Leo", hue: 140 },
  ana: { id: "ana", name: "Ana", hue: 330 },
  tomas: { id: "tomas", name: "Tomás", hue: 42 },
  jun: { id: "jun", name: "Jun", hue: 260 },
  chloe: { id: "chloe", name: "Chloé", hue: 100 },
  priya: { id: "priya", name: "Priya", hue: 290 },
  kofi: { id: "kofi", name: "Kofi", hue: 24 },
};

/** Book-by deadline: two days from now at 18:00 local, so the countdown always reads live. */
function bookByIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export function sampleTrip(): Trip {
  return {
    code: "LIS-0312",
    place: "Lisbon",
    country: "Portugal",
    stay: "Alfama flat with a roof terrace",
    checkIn: "2027-03-12",
    checkOut: "2027-03-15",
    price: 40,
    bookBy: bookByIso(),
    booker: "maya",
    beds: [
      "Double room, window side",
      "Double room, courtyard side",
      "Bunk room A, top",
      "Bunk room A, bottom",
      "Bunk room B, top",
      "Bunk room B, bottom",
      "Loft single",
      "Sofa bed by the terrace",
    ],
    spots: [
      { n: 1, status: "paid", holder: "maya", paidWith: "near" },
      { n: 2, status: "paid", holder: "sam", paidWith: "base" },
      { n: 3, status: "held", holder: "leo" },
      { n: 4, status: "paid", holder: "ana", paidWith: "solana" },
      { n: 5, status: "paid", holder: "tomas", paidWith: "arbitrum" },
      { n: 6, status: "paid", holder: "jun", paidWith: "base" },
      { n: 7, status: "paid", holder: "chloe", paidWith: "near" },
      { n: 8, status: "paid", holder: "kofi", paidWith: "ethereum" },
    ],
    waitlist: ["priya"],
    drawn: false,
    drawnOut: false,
    activity: [
      { id: "a8", at: "6 min ago", kind: "paid", text: "Kofi paid for spot 8", chain: "ethereum" },
      { id: "a7", at: "18 min ago", kind: "paid", text: "Chloé paid for spot 7", chain: "near" },
      { id: "a6", at: "1 h ago", kind: "paid", text: "Jun paid for spot 6", chain: "base" },
      { id: "a5", at: "3 h ago", kind: "paid", text: "Tomás paid for spot 5", chain: "arbitrum" },
      { id: "a4", at: "yesterday", kind: "paid", text: "Ana paid for spot 4", chain: "solana" },
      { id: "a3", at: "yesterday", kind: "paid", text: "Sam paid for spot 2", chain: "base" },
      { id: "a2", at: "2 days ago", kind: "paid", text: "Maya paid for spot 1", chain: "near" },
      { id: "a1", at: "2 days ago", kind: "created", text: "Maya opened the trip: 8 beds at $40" },
    ],
  };
}
