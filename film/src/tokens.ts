/* Dibs brand tokens, ported 1:1 from apps/web/src/index.css and motion.css (Hoy-based theme, 14 Nov).
   The film wears this look end to end. Never add colours outside this file. */
import { Easing } from "remotion";

export const C = {
  void: "#0e0e0e",
  panel: "#191918",
  raise: "#232322",
  glass: "rgba(40, 40, 39, 0.74)",
  line: "rgba(255, 255, 255, 0.08)",
  lineStrong: "rgba(255, 255, 255, 0.14)",
  fg: "#ececea",
  fg2: "#73736f",
  fg3: "#585855",
  paid: "#34d399",
  due: "#fb923c",
  resale: "#38bdf8",
  refused: "#fb7185",
  you: "#facc15",
} as const;

/* People: the exact face colours from apps/web/src/components/bits.tsx and landing/strip.tsx. */
export const PEOPLE = {
  maya: { name: "Maya", color: "#fb923c" },
  sam: { name: "Sam", color: "#38bdf8" },
  leo: { name: "Leo", color: "#4ade80" },
  ana: { name: "Ana", color: "#f472b6" },
  tomas: { name: "Tomás", color: "#facc15" },
  jun: { name: "Jun", color: "#a78bfa" },
  chloe: { name: "Chloé", color: "#2dd4bf" },
  kofi: { name: "Kofi", color: "#fb7185" },
  priya: { name: "Priya", color: "#c084fc" },
} as const;
export type PersonId = keyof typeof PEOPLE;

/* Chain dots from bits.tsx CHAIN_DOT. */
export const CHAIN_DOT = { near: "#ececea", base: "#3b82f6", solana: "#a78bfa", arbitrum: "#38bdf8", ethereum: "#94a3b8" } as const;

/* Type. The app's stack is "SF Pro Display", -apple-system, ..., "Inter Variable". On this Mac, system-ui renders SF Pro.
   Inter (loaded in fonts.ts) is the fallback. Headlines: weight 600, tracking -0.024em, line-height 1.12, two tones. */
export const FONT = `"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, "Inter", sans-serif`;
export const MONO = `"JetBrains Mono", ui-monospace, "SF Mono", monospace`;
export const DISPLAY = { fontFamily: FONT, fontWeight: 600, letterSpacing: "-0.024em", lineHeight: 1.12 } as const;

/* Radii and surfaces (index.css @utility glass / pill). Film scale is 2x the app's CSS px unless a scene says otherwise. */
export const R = { glass: 24, pill: 999, sheet: 28, row: 18 } as const;
export const GLASS = {
  background: C.glass,
  border: `1px solid ${C.line}`,
  borderRadius: R.glass,
  backdropFilter: "blur(24px) saturate(1.2)",
  WebkitBackdropFilter: "blur(24px) saturate(1.2)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px -24px rgba(0,0,0,0.7)",
} as const;

/* Motion tokens from motion.css. ease = everything that arrives; oe = word sweep; spring ~ SwiftUI (.5, .82). */
export const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);
export const OE = Easing.bezier(0, 0, 0.58, 1);
export const OUT_STRONG = Easing.bezier(0.23, 1, 0.32, 1);
export const IN_OUT_STRONG = Easing.bezier(0.77, 0, 0.175, 1);
export const BLINK_BEAT_FRAMES = 66; // 2.2 s at 30 fps, the shared blink beat
export const SPRING = { damping: 18, stiffness: 160, mass: 1 } as const; // ~8% overshoot, like --spring

export const W = 1920;
export const H = 1080;
/* Safe area: nothing important closer than this to the frame edge, including mid-transition. */
export const SAFE = 96;

/* Public facts shown on screen. Each traces to the repo (see PLAN.md, "Numbers and where they come from"). */
export const FACTS = {
  tripCode: "LIS-0312",
  tripId: "lis0312",
  place: "Lisbon",
  stay: "Alfama flat with a roof terrace",
  dates: "12 Mar – 15 Mar",
  nights: 3,
  beds: 8,
  price: 40,
  pot: 320,
  inbox: "lis0312@dibs.larinova.com",
  contractTestnet: "dibs-0eb9ae.testnet",
  daoTestnet: "lis0312-0eb9ae.sputnik-v2.testnet",
  vrfTx: "gADA3SGtrGjsmTVJNZUaWLsxJSUuZdxkhQ7dVGe7c6w",
  checksPassed: 46,
  checksTotal: 46,
  attacksRefused: 35,
  /* The URL on the end card. The team named production on 14 Nov: dibs.larinova.com. ONE-LINE SWAP if it changes. */
  liveUrl: "dibs.larinova.com", // team note 15 Nov 04:50: every try-it URL points to the root
  repo: "github.com/RealMarsela/dibs",
  /* The proof beat uses a REAL booking (coordinator, 14 Nov): trip sin1025, a team member's own booking.com confirmation.
     Redacted: never his name, address or booking reference. */
  proofTrip: "SIN-1025",
  proofTripId: "sin1025",
  proofInbox: "sin1025@dibs.larinova.com",
  proofStay: "Carlton City Hotel Singapore",
  proofDates: "25 Oct – 26 Oct 2025",
  proofNights: 1,
  proofGuests: 2,
  proofTotal: "SGD 226.60", // compared 1:1 to the USDC cap (no FX conversion yet): never claim a USD conversion
  proofCap: "$240",
  proofTx: "54g9Y2qgKPNFamFeN6tQUgpR1AqU322F1J184LB8mYKr", // accepted on testnet (verifier v7); payout Done: DAO paid Maya 226.60 USDC
  proofPaid: "226.60 USDC",
  proofPot: 240,
  forgedTx: "93AJG9P2g7ZaTQacNb6dS1csZZRLpX8gxAFy1imTrBFF",
} as const;

/* Until the coordinator confirms the live proof was ACCEPTED on chain, nothing in motion graphics may say "verified" or
   show a payout for the real booking; that end-state lives only in the `proof` footage slot. Flip to true on his word. */
export const PROOF_ACCEPTED = true; // coordinator, 14 Nov: sin1025 proof accepted on chain (tx 54g9Y2qg…), payout Done

/* v2 scale (coordinator review): focal UI fills ~55-70% of the frame. Shared by handoff poses and scenes. */
export const LIST_SCALE = 1.25; // "The beds" list: 860 x 688 -> 1075 x 860
export const CARD_W = 1000; // the trip card at H6
export const INBOX_SCALE = 1.3; // the inbox panel at H7: 1000 -> 1300 wide
