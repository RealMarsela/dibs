export type ChainId = "near" | "base" | "solana" | "arbitrum" | "ethereum";

export interface Chain {
  id: ChainId;
  name: string;
  token: string;
  /** Rough 1Click route fee for display in the preview, as a fraction. */
  fee: number;
  eta: string;
}

export interface Person {
  id: string;
  name: string;
  /** Hue for the avatar dot; 0-360. */
  hue: number;
}

export type SpotStatus = "open" | "held" | "paid" | "listed";

export interface Spot {
  n: number;
  status: SpotStatus;
  holder?: string;
  paidWith?: ChainId;
  /** Bed assigned by the fair draw once every spot is paid. */
  bed?: string;
}

export type ActivityKind = "paid" | "listed" | "resold" | "refused" | "proof" | "draw" | "draw-out" | "created";

export interface Activity {
  id: string;
  at: string;
  kind: ActivityKind;
  text: string;
  chain?: ChainId;
}

export interface ProofFacts {
  stay: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  signedBy: string;
}

export interface Trip {
  code: string;
  place: string;
  country: string;
  stay: string;
  checkIn: string;
  checkOut: string;
  price: number;
  bookBy: string;
  booker: string;
  beds: string[];
  spots: Spot[];
  waitlist: string[];
  proof?: ProofFacts;
  drawn: boolean;
  drawnOut: boolean;
  activity: Activity[];
}
