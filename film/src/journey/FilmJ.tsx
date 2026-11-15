import React from "react";
import { AbsoluteFill, Audio, Freeze, Img, interpolate, OffthreadVideo, Sequence, getStaticFiles, staticFile, useCurrentFrame } from "remotion";
import { SceneProvider, SCENES } from "../scene";
import { S01 } from "../scenes/S01";
import { S02 } from "../scenes/S02";
import { S09 } from "../scenes/S09";
import { C, MONO } from "../tokens";
import { LINES } from "../timeline.generated";

/* Team note, 15 Nov 04:25 IST: the app plays FULL SCREEN after a <=20 s explainer opening. One continuous real journey
   (journey-testnet-meteor.mp4, 1440x810 -> 1920x1080, ~2 fps app burst, smooth Meteor frames), in order, with a cut to the
   REAL explorer page after each transaction and back to the same app frame. Then the real mainnet receipts, the card,
   the booking proof, the close. No crops, no frames around the UI. Existing VO lines only. */
/** cur: the overlay cursor arrives at `to` (comp px) at frame `at` of this clip; `click` only where a real click happened. */
type Cur = { to: [number, number]; at: number; click?: boolean };
type Clip = { kind: "clip"; file: string; startS: number; rate?: number; hold?: boolean; dur: number; label?: string; url?: string; cur?: Cur; crop?: { x: number; y: number; w: number; h: number; bg: string } };
type Scene = { kind: "scene"; id: "S01" | "S02" | "S09"; dur: number };
type Seg = Clip | Scene;

const J = "footage/journey-testnet-meteor.mp4";
const files = (() => {
  try {
    return getStaticFiles().map((f) => f.name);
  } catch {
    return [] as string[];
  }
})();
/** An explorer capture in footage/explorers/ (png or mp4) whose name contains every `all` key and any `any` key. */
const explorer = (all: string[], any: string[] = [""]) => {
  const hits = files.filter((n) => {
    const l = n.toLowerCase();
    return l.startsWith("footage/explorers/") && /\.(png|jpe?g|mp4)$/.test(l) && all.every((k) => l.includes(k)) && any.some((k) => l.includes(k));
  });
  return hits.find((n) => n.includes("nearrocks")) ?? hits[0]; // near.rocks (NEAR's own explorer) first, RPC logs as fallback
};
const ex = (all: string[], any: string[], dur: number, label: string, url: string, crop?: Clip["crop"]): Clip[] => {
  const f = explorer(all, any);
  return f ? [{ kind: "clip", file: f, startS: 0.3, rate: 1, dur, label, url, crop }] : [];
};
const URL_CREATE = "testnet.near.rocks/tx/J3UJBx8xTynvxLcWZUoiXmVJiF9xvAqdssfS6MqGE6bb";
const URL_PAY = "testnet.near.rocks/tx/DSX9QnWAAu9P3Vwg58SEMbhi8zSC3gfWvsgiKWKTBcUa";
const URL_INTENTS = "explorer.near-intents.org/transactions/0xfdF223c4438053E9F84B9342CCd56575ae4039D2";
const URL_SWEEP = "near.rocks/tx/9nPPmuaZcBv6YYrB77d6jjNaHGzkbeTY3Fu5CzqMQ7YU";
/* Base: Blockscout is dropped (sponsored ad on every load, tabs still syncing). The NEAR Intents page proves the Base
   deposit 0x6141…b973bf, the swap and the withdrawal to the bed, with no ad and no wallet address. */

const OPENING: Seg[] = [
  { kind: "scene", id: "S01", dur: SCENES.S01.to - SCENES.S01.from },
  { kind: "scene", id: "S02", dur: SCENES.S02.to - SCENES.S02.from },
];
const JOURNEY: Seg[] = [
  // /new, filled. Its "Sign in and create the trip" button sits below the fold in every recorded frame, so no click is drawn.
  { kind: "clip", file: J, startS: 182.0, hold: true, dur: 55, cur: { to: [1180, 930], at: 0 } },
  { kind: "clip", file: J, startS: 370.4, rate: 1.5, dur: 85, cur: { to: [1078, 916], at: 78, click: true } }, // Meteor: Sign Message (374.3 s)
  { kind: "clip", file: J, startS: 388.4, hold: true, dur: 40 },
  ...ex(["testnet"], ["create", "j3ujb"], 75, "NEAR testnet · near.rocks · create_trip · J3UJBx8x…", URL_CREATE),
  { kind: "clip", file: J, startS: 388.4, hold: true, dur: 26, cur: { to: [1360, 486], at: 22, click: true } }, // Pay $40 from any chain
  { kind: "clip", file: J, startS: 456.4, hold: true, dur: 34, cur: { to: [960, 583], at: 26, click: true } }, // Connect a NEAR wallet
  { kind: "clip", file: J, startS: 461.6, hold: true, dur: 26, cur: { to: [960, 888], at: 20, click: true } }, // Get my NEAR address
  { kind: "clip", file: J, startS: 463.6, hold: true, dur: 22, cur: { to: [894, 514], at: 16, click: true } }, // Pay with a NEAR wallet
  { kind: "clip", file: J, startS: 490.0, hold: true, dur: 24, cur: { to: [959, 529], at: 18, click: true } }, // Approve 40.00 test USDC in Meteor Wallet
  { kind: "clip", file: J, startS: 502.0, rate: 1.4, dur: 110, cur: { to: [1078, 916], at: 71, click: true } }, // Meteor: Approve (505.3 s), then Executing
  { kind: "clip", file: J, startS: 518.2, hold: true, dur: 40, cur: { to: [900, 639], at: 32, click: true } }, // "Sent from Meteor Wallet · DSX9…" link
  ...ex(["testnet"], ["pay", "dsx9"], 75, "NEAR testnet · near.rocks · 40 USDC from Meteor · DSX9QnWA…", URL_PAY),
  { kind: "clip", file: J, startS: 518.2, hold: true, dur: 22 },
  { kind: "clip", file: J, startS: 521.0, rate: 26, dur: 135, cur: { to: [1560, 960], at: 30 } },
  { kind: "clip", file: J, startS: 640.5, hold: true, dur: 45 },
];
const TAIL: Seg[] = [
  { kind: "clip", file: "footage/mainnet-pay-a.mp4", startS: 28.0, hold: true, dur: 66, label: "NEAR mainnet · real USDC from Base" },
  { kind: "clip", file: explorer(["mainnet"], ["intents"]) ?? "footage/mainnet-receipt-intents.mp4", startS: 0.5, hold: true, dur: 90, label: "NEAR Intents · Base deposit 0x6141…b973bf → b01-lismain.dibsapp.near", url: URL_INTENTS },
  { kind: "clip", file: explorer(["mainnet"], ["sweep", "9nppm"]) ?? "footage/mainnet-receipt-sweep.mp4", startS: 0.6, hold: true, dur: 70, label: "NEAR mainnet · near.rocks · swept into the crew DAO · 9nPPmuaZ…", url: URL_SWEEP },
  { kind: "clip", file: "footage/mainnet-lismain-paid.mp4", startS: 0.4, dur: 66 },
];
const CARD: Seg[] = [
  { kind: "clip", file: "footage/card.mp4", startS: 1.2, rate: 1.6, dur: 255 },
  { kind: "clip", file: "footage/card.mp4", startS: 15.0, rate: 2.2, dur: 213 },
  { kind: "clip", file: "footage/card.mp4", startS: 30.6, hold: true, dur: 150 },
];
const PROOF: Seg[] = [
  { kind: "clip", file: "footage/proof.mp4", startS: 0.0, rate: 1, dur: 300 },
  { kind: "clip", file: "footage/proof.mp4", startS: 9.9, hold: true, dur: 460 },
];
/* The attack suite is cut, so the close skips S09's first 24 frames (where "35 attacks…" sweeps out); its VO starts 24
   frames earlier to stay in sync. */
const S09_SKIP = 24;
const CLOSE: Seg[] = [{ kind: "scene", id: "S09", dur: SCENES.S09.to - SCENES.S09.from - S09_SKIP }];

const sum = (s: Seg[]) => s.reduce((a, g) => a + g.dur, 0);
export const J_T = { journey: sum(OPENING), tail: 0, card: 0, proof: 0, close: 0, total: 0 };
J_T.tail = J_T.journey + sum(JOURNEY);
J_T.card = J_T.tail + sum(TAIL);
J_T.proof = J_T.card + sum(CARD);
J_T.close = J_T.proof + sum(PROOF);
J_T.total = J_T.close + sum(CLOSE);
const ALL = [...OPENING, ...JOURNEY, ...TAIL, ...CARD, ...PROOF, ...CLOSE];

const line = (id: string) => LINES.find((l) => l.id === id)!;
/** VO placement: [line id, audio file, start frame]. */
const VO: [string, number][] = [
  ["L01", line("L01").from],
  ["L02", line("L02").from],
  ["L03A", J_T.tail + 6],
  ["L06", J_T.card + 8],
  ["L07", J_T.proof + 8],
  ["L09", J_T.close - S09_SKIP],
];
const voDur = (id: string) => Math.ceil((line(id).dur + 0.6) * 30);

const BAR = 50;
/** A real explorer capture, whole and unzoomed, under a thin browser bar that shows its real URL. */
function Browser({ file, url, crop }: { file: string; url?: string; crop?: Clip["crop"] }) {
  const k = (1080 - BAR) / 1080; // the full 1920x1080 capture, fitted below the bar
  return (
    <AbsoluteFill style={{ background: "#202124" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: BAR, display: "flex", alignItems: "center", gap: 14, padding: "0 22px" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ marginLeft: 18, flex: 1, height: 32, borderRadius: 16, background: "#35363a", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, fontFamily: MONO, fontSize: 19, color: "#e8eaed", whiteSpace: "nowrap", overflow: "hidden" }}>
          <svg width="13" height="15" viewBox="0 0 13 15"><rect x="1" y="6.5" width="11" height="8" rx="1.6" fill="#9aa0a6" /><path d="M3.5 6.5V4.6a3 3 0 0 1 6 0v1.9" stroke="#9aa0a6" strokeWidth="1.6" fill="none" /></svg>
          {url}
        </div>
      </div>
      <div style={{ position: "absolute", top: BAR, left: (1920 - 1920 * k) / 2, width: 1920 * k, height: 1080 * k, overflow: "hidden", background: crop?.bg ?? "#000" }}>
        {crop ? (
          <div style={{ position: "absolute", left: crop.x * k, top: crop.y * k, width: crop.w * k, height: crop.h * k, overflow: "hidden" }}>
            <Img src={staticFile(file)} style={{ position: "absolute", left: -crop.x * k, top: -crop.y * k, width: 1920 * k, height: 1080 * k }} />
          </div>
        ) : (
          <Img src={staticFile(file)} style={{ width: 1920 * k, height: 1080 * k }} />
        )}
      </div>
    </AbsoluteFill>
  );
}

function ClipView({ g }: { g: Clip }) {
  if (/\.(png|jpe?g)$/i.test(g.file)) {
    return (
      <AbsoluteFill style={{ background: C.void }}>
        <Browser file={g.file} url={g.url} crop={g.crop} />
        {g.label && <Chip text={g.label} />}
      </AbsoluteFill>
    );
  }
  const startFrom = Math.round(g.startS * 30);
  const v = <OffthreadVideo src={staticFile(g.file)} muted startFrom={startFrom} playbackRate={g.rate ?? 1} style={{ width: 1920, height: 1080, objectFit: "cover" }} />;
  return (
    <AbsoluteFill style={{ background: C.void }}>
      {g.hold ? <Freeze frame={0}>{v}</Freeze> : v}
      {g.label && <Chip text={g.label} />}
    </AbsoluteFill>
  );
}

/* Overlay cursor across the app journey: keyframes from each clip's `cur`, eased 16-frame moves, a ripple only on real
   clicks. Hidden on explorer pages; it returns where it left. */
type K = { f: number; x: number; y: number; click: boolean };
const MOVE = 16;
function cursorTrack(): { keys: K[]; app: [number, number][] } {
  const keys: K[] = [];
  const app: [number, number][] = [];
  let t = 0;
  for (const g of ALL) {
    if (g.kind === "clip" && g.file === J) {
      app.push([t, t + g.dur]);
      if (g.cur) keys.push({ f: t + g.cur.at, x: g.cur.to[0], y: g.cur.to[1], click: !!g.cur.click });
    }
    t += g.dur;
  }
  return { keys, app };
}
const TRACK = cursorTrack();
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function Cursor() {
  const f = useCurrentFrame();
  if (!TRACK.app.some(([a, b]) => f >= a && f < b)) return null;
  const { keys } = TRACK;
  let i = keys.findIndex((k) => k.f > f) - 1;
  if (i === -2) i = keys.length - 1;
  let x: number, y: number;
  if (i < 0) {
    x = keys[0].x;
    y = keys[0].y;
  } else {
    const a = keys[i];
    const b = keys[i + 1];
    x = a.x;
    y = a.y;
    if (b && f > b.f - MOVE) {
      const u = ease(Math.min(1, (f - Math.max(a.f, b.f - MOVE)) / Math.max(1, b.f - Math.max(a.f, b.f - MOVE))));
      x = a.x + (b.x - a.x) * u;
      y = a.y + (b.y - a.y) * u;
    }
  }
  const last = [...keys].reverse().find((k) => k.click && f >= k.f && f < k.f + 14);
  const p = last ? (f - last.f) / 14 : 0;
  const press = last && f - last.f < 4 ? 0.86 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {last && (
        <div style={{ position: "absolute", left: last.x - 10 - 34 * p, top: last.y - 10 - 34 * p, width: 20 + 68 * p, height: 20 + 68 * p, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.18)", opacity: 1 - p }} />
      )}
      <svg width="34" height="46" viewBox="0 0 17 23" style={{ position: "absolute", left: x - 2, top: y - 2, transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}>
        <path d="M1 1 L1 18 L5.2 14.2 L8.2 21 L11 19.8 L8.1 13.2 L14 13.2 Z" fill="#fff" stroke="#000" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", left: 48, bottom: 44, padding: "12px 22px", borderRadius: 999, background: "rgba(14,14,14,0.86)", border: `1px solid ${C.lineStrong}`, fontFamily: MONO, fontSize: 26, color: C.fg, letterSpacing: "-0.01em" }}>
      {text}
    </div>
  );
}

export const FilmJ: React.FC = () => {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.void }}>
      {ALL.map((g, i) => {
        const from = at;
        at += g.dur;
        return (
          <Sequence key={i} from={from} durationInFrames={g.dur}>
            {g.kind === "scene" ? (
              <SceneProvider id={g.id}>
                {g.id === "S01" ? <S01 /> : g.id === "S02" ? <S02 /> : (
                  <Sequence from={-S09_SKIP} layout="none">
                    <S09 />
                  </Sequence>
                )}
              </SceneProvider>
            ) : (
              <ClipView g={g} />
            )}
          </Sequence>
        );
      })}
      <Cursor />
      {VO.map(([id, from]) => (
        <Sequence key={id} from={from} durationInFrames={voDur(id)} layout="none">
          <Audio src={staticFile(`audio/vo/${line(id).file}.mp3`)} />
        </Sequence>
      ))}
      <Audio
        src={staticFile("audio/music/mixkit-1168.mp3")}
        volume={(f) => {
          const speaking = VO.some(([id, from]) => f >= from - 6 && f <= from + voDur(id));
          const fade = interpolate(f, [0, 20, J_T.total - 60, J_T.total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return fade * (speaking ? 0.13 : 0.32);
        }}
      />
    </AbsoluteFill>
  );
};
