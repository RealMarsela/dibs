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
  liveUrl: "dibs-trips.pages.dev",
  repo: "github.com/RealMarsela/dibs",
} as const;
