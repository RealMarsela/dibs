import React from "react";
import { AbsoluteFill, Audio, Freeze, Img, interpolate, OffthreadVideo, Sequence, getStaticFiles, staticFile, useCurrentFrame } from "remotion";
import { SceneProvider, SCENES } from "../scene";
import { S01 } from "../scenes/S01";
import { S02 } from "../scenes/S02";
import { S09 } from "../scenes/S09";
import { C, MONO } from "../tokens";
import { LINES } from "../timeline.generated";

/* Gabriel, 15 Nov 04:25 IST: the app plays FULL SCREEN after a <=20 s explainer opening. One continuous real journey
   (journey-testnet-meteor.mp4, 1440x810 -> 1920x1080, ~2 fps app burst, smooth Meteor frames), in order, with a cut to the
   REAL explorer page after each transaction and back to the same app frame. Then the real mainnet receipts, the card,
   the booking proof, the close. No crops, no frames around the UI. Existing VO lines only. */
type Clip = { kind: "clip"; file: string; startS: number; rate?: number; hold?: boolean; dur: number; label?: string; crop?: { x: number; y: number; w: number; h: number; bg: string } };
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
const NR = (y: number, h: number) => ({ x: 262, y, w: 816, h, bg: "rgb(7,10,16)" });
const ex = (all: string[], any: string[], dur: number, label: string, crop?: Clip["crop"]): Clip[] => {
  const f = explorer(all, any);
  return f ? [{ kind: "clip", file: f, startS: 0.3, rate: 1, dur, label, crop }] : [];
};

const OPENING: Seg[] = [
  { kind: "scene", id: "S01", dur: SCENES.S01.to - SCENES.S01.from },
  { kind: "scene", id: "S02", dur: SCENES.S02.to - SCENES.S02.from },
];
const JOURNEY: Seg[] = [
  { kind: "clip", file: J, startS: 182.0, hold: true, dur: 45 },
  { kind: "clip", file: J, startS: 370.4, rate: 1.5, dur: 85 },
  { kind: "clip", file: J, startS: 388.4, hold: true, dur: 40 },
  ...ex(["testnet"], ["create", "j3ujb"], 75, "NEAR testnet · near.rocks · create_trip · J3UJBx8x…", NR(28, 600)),
  { kind: "clip", file: J, startS: 388.4, hold: true, dur: 20 },
  { kind: "clip", file: J, startS: 456.4, hold: true, dur: 40 },
  { kind: "clip", file: J, startS: 461.6, hold: true, dur: 28 },
  { kind: "clip", file: J, startS: 490.0, hold: true, dur: 30 },
  { kind: "clip", file: J, startS: 502.0, rate: 1.4, dur: 120 },
  ...ex(["testnet"], ["pay", "dsx9"], 75, "NEAR testnet · near.rocks · 40 USDC from Meteor · DSX9QnWA…", NR(28, 600)),
  { kind: "clip", file: J, startS: 507.4, hold: true, dur: 16 },
  { kind: "clip", file: J, startS: 518.2, hold: true, dur: 60 },
  { kind: "clip", file: J, startS: 521.0, rate: 26, dur: 135 },
  { kind: "clip", file: J, startS: 640.5, hold: true, dur: 45 },
];
const TAIL: Seg[] = [
  { kind: "clip", file: "footage/mainnet-pay-a.mp4", startS: 28.0, hold: true, dur: 66, label: "NEAR mainnet · real USDC from Base" },
  ...ex(["mainnet"], ["base", "0x6141", "blockscout"], 75, "Base mainnet · USDC sent to NEAR Intents · tx 0x6141…73bf", { x: 240, y: 160, w: 1060, h: 400, bg: "rgb(16,17,18)" }),
  { kind: "clip", file: explorer(["mainnet"], ["intents"]) ?? "footage/mainnet-receipt-intents.mp4", startS: 0.5, hold: true, dur: 75, label: "NEAR Intents · landed in b01-lismain.dibsapp.near" },
  { kind: "clip", file: explorer(["mainnet"], ["sweep", "9nppm"]) ?? "footage/mainnet-receipt-sweep.mp4", startS: 0.6, hold: true, dur: 70, label: "NEAR mainnet · near.rocks · swept into the crew DAO · 9nPPmuaZ…", crop: NR(28, 560) },
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

function Still({ file, crop }: { file: string; crop?: Clip["crop"] }) {
  const f = useCurrentFrame();
  if (!crop) return <Img src={staticFile(file)} style={{ width: 1920, height: 1080, objectFit: "cover", transform: `scale(${1 + f * 0.0006})` }} />;
  // Only the cropped block (keeps out ads and personal rows), scaled to 1600 wide on the page's own background.
  const k = Math.min(1600 / crop.w, 940 / crop.h);
  return (
    <AbsoluteFill style={{ background: crop.bg, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: crop.w * k, height: crop.h * k, overflow: "hidden", position: "relative", transform: `scale(${1 + f * 0.0006})` }}>
        <Img src={staticFile(file)} style={{ position: "absolute", left: -crop.x * k, top: -crop.y * k, width: 1920 * k, height: 1080 * k }} />
      </div>
    </AbsoluteFill>
  );
}

function ClipView({ g }: { g: Clip }) {
  if (/\.(png|jpe?g)$/i.test(g.file)) {
    return (
      <AbsoluteFill style={{ background: C.void }}>
        <Still file={g.file} crop={g.crop} />
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
