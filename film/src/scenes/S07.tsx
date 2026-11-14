import React from "react";
import { Easing, Sequence } from "remotion";
import { World } from "../components/World";
import { At, Stage } from "../components/Stage";
import { AppWindow, FootageSlot } from "../components/Footage";
import { TripCard } from "../components/Trip";
import { H6, H7, H7_ITEM } from "../handoffs";
import { SCENES, useScene } from "../scene";
import { C, CARD_W, EASE, FACTS, GLASS, INBOX_SCALE, IN_OUT_STRONG, MONO, OE, OUT_STRONG, PROOF_ACCEPTED } from "../tokens";
import { kf, lerp, prog } from "../lib/anim";
import { BODY_AT, EH, EW, EmailCard } from "./s07/Email";
import { CheckTile } from "./s07/CheckTile";
import { CHIP_K, CROP_H_FACTS, CROP_H_FULL, CROP_W, CROP_X, CROP_Y, FACT_AT, FACT_VALUES, FactBlock, HIDDEN_TEXT, K, ProofPlaceholder, SmallLine, WIN_C, WIN_TOP, WIN_W, stageOf } from "./s07/Proof";
import { InboxLayer, TripChip, type InboxLook } from "./s07/Layers";

/* S07 "Prove it" (v2, the REAL booking: trip sin1025). H6 card -> it flicks away -> a real booking.com confirmation flies
   in ("Trip SIN-1025 · a real booking") and is filed into that trip's own inbox -> it opens; the camera pushes in, then
   pulls back as the layers engage one at a time (DKIM in an Intel TDX enclave, NEAR AI's private read) -> the email
   dissolves and only dates, guests and total lift out -> they dock into the proof sheet's facts card (slot `proof`) as the
   contract's on-chain check engages -> push in on the DAO line -> the inbox returns = H7.
   Honesty (PROOF_ACCEPTED false): no "verified", no green pass, no payout in motion graphics; the layers light white. */
const LAST = SCENES.S07.to - SCENES.S07.from - 1;
/** The inbox row's rect (stage px) inside the InboxPanel (measured at scale 1: centre y 56, 944 x 84), at INBOX_SCALE. */
const ROW = { y: 56 * INBOX_SCALE, w: 944 * INBOX_SCALE, h: 84 * INBOX_SCALE, r: 22 * INBOX_SCALE };
const E1 = 1.42; // the arriving email, ~1080 px wide
const E2 = WIN_W / EW; // the email in the left column, as wide as the proof window
const LEFT = WIN_C;
const EMAIL_Y = 30;
const TILE_X = 450;
const TILE_Y = [-180, 0, 180];
/** Composition frames (30 fps) into the `proof` clip where this use starts: 2.0 s, the sheet is open and still from 1.75 s. */
const PROOF_START = 60;
/** Width of HIDDEN_TEXT (12 px app text, 311 px in the recording) at the pre-dock scale 2 (so it can dock by its top-left). */
const HIDDEN_K = 2;
const HIDDEN_W = 311 * HIDDEN_K;

const TILES = [
  { title: "DKIM signature checked", sub: "Intel TDX enclave · OutLayer", accent: "ring", chip: "DKIM: signed by booking.com" },
  { title: "Read privately by NEAR AI", sub: "GPU enclave · nobody sees the email", accent: "bloom" },
  { title: PROOF_ACCEPTED ? "Signed result verified on chain" : "Signed result checked on chain", sub: "ed25519 · dibs contract", accent: "stamp" },
] as const;

const CHIP_PAD = { x: 28, y: 20 };
const CHIPS = [
  { id: "dates", w: 475, pre: { x: LEFT.x - 238, y: -205 }, ...FACT_VALUES.dates },
  { id: "guests", w: 240, pre: { x: LEFT.x - 370, y: -46 }, ...FACT_VALUES.guests },
  { id: "total", w: 464, pre: { x: LEFT.x - 94, y: -46 }, ...FACT_VALUES.total },
] as const;

/** Child anchored by its top-left in stage px (for things that dock onto exact points). */
const TL = ({ x, y, z = 0, s = 1, opacity = 1, style, children }: { x: number; y: number; z?: number; s?: number; opacity?: number; style?: React.CSSProperties; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${s})`, opacity, ...style }}>{children}</div>
);

export const S07: React.FC = () => {
  const { f, cue } = useScene();
  const c = (w: string, n = 0) => cue("L07", w, n);
  const t = {
    conf: c("confirmation"), landing: c("landing"), an: c("An"), checks: c("checks"), bk1: c("booking.com", 1), signed: c("signed"),
    near: c("NEAR"), privately: c("privately"), friends: c("friends"), only: c("only"), dates: c("dates"), guests: c("guests"),
    total: c("total"), when: c("When"), verifies: c("verifies"), chain: c("chain"), crews: c("crew's"), releases: c("releases"), own: c("own", 2),
  };
  if (f <= 2) return <World><H6 /></World>;
  if (f >= LAST - 7) return <World><H7 /></World>;

  /* Camera: follow the email in, settle on the inbox, push into the opened email's header, pull back for the layers,
     truck + push onto the proof window for the DAO line, back to neutral for H7. A small drift keeps it alive. */
  const eIn = 6;
  const open = t.an - 2;
  const camF = [0, eIn, eIn + 18, eIn + 48, t.landing + 28, open, open + 21, t.checks + 9, t.bk1 + 34, t.crews - 2, t.crews + 30, t.own + 2, t.own + 36];
  const env = kf(f, [0, 12, LAST - 24, LAST - 12], [0, 1, 1, 0]);
  const cam = {
    s: kf(f, camF, [1, 1, 1, 1, 1, 1.02, 1.02, 1.25, 1, 1, 1.12, 1.15, 1]),
    x: kf(f, camF, [0, 0, 70, 0, 0, 0, 0, LEFT.x * 1.25, 5, 5, LEFT.x * 1.12, LEFT.x * 1.15, 0]) + Math.sin(f / 47) * 4 * env,
    y: kf(f, camF, [0, 0, 0, 0, 0, 0, 0, (LEFT.y - 80) * 1.25, 0, 0, LEFT.y * 1.12, LEFT.y * 1.15, 0]) + (Math.cos(f / 61) - 1) * 3 * env,
    ry: kf(f, [t.bk1 + 34, t.privately + 12, t.verifies, t.crews - 2], [0, -2, 1.5, 0]),
  };
  const camT = `translate(${-cam.x}px, ${-cam.y}px) scale(${cam.s})`;

  const sw = prog(f, 2, 20, OUT_STRONG); // the card flicks away (Maya books with it)
  const chipO = prog(f, t.conf + 6, 14, OE) * (1 - prog(f, t.landing - 6, 12));

  /* The email: flies in, is filed into the row, opens into the left column, dissolves into the facts. */
  const mF = [t.landing, t.landing + 32, open, open + 32];
  const ex = kf(f, [eIn, eIn + 34, open, open + 32], [1700, 0, 0, LEFT.x]);
  const ey = kf(f, [eIn, eIn + 34, t.landing, t.landing + 32, open, open + 32], [90, EMAIL_Y, EMAIL_Y, ROW.y, ROW.y, LEFT.y]);
  const eo = kf(f, [t.landing + 28, t.landing + 36, open - 1, open, t.friends, t.total - 6], [1, 0, 0, 1, 1, 0], [EASE, EASE, EASE, EASE, OE]);
  const dis = prog(f, t.friends, t.total - 10 - t.friends, EASE);

  /* Fact chips lift out of the email's body, then dock onto the facts card before the window appears around them. */
  const dock0 = t.when + 1;
  const wIn = t.verifies + 1;
  const fadeAt = wIn + 16;
  const sd = K / CHIP_K;
  const s0 = (22 * E2) / (14 * CHIP_K);
  const chips = CHIPS.map((ch, i) => {
    const lp = prog(f, [t.dates, t.guests, t.total][i], 20);
    const dp = prog(f, dock0 + i * 3, 24);
    const out = prog(f, fadeAt, 8);
    if (lp <= 0 || out >= 1) return null;
    const b = BODY_AT[ch.id];
    const start = { x: LEFT.x + b.x * E2 - CHIP_PAD.x * s0, y: LEFT.y + b.y * E2 - CHIP_PAD.y * s0 };
    const tgt = stageOf(FACT_AT[ch.id]);
    const end = { x: tgt.x - CHIP_PAD.x * sd, y: tgt.y - CHIP_PAD.y * sd };
    return (
      <TL key={ch.id} x={lerp(lerp(start.x, ch.pre.x, lp), end.x, dp)} y={lerp(lerp(start.y, ch.pre.y, lp), end.y, dp)} z={lerp(lerp(-40, 30, lp), 2, dp)} s={lerp(lerp(s0, 1, lp), sd, dp)} opacity={Math.min(1, lp * 2.5) * (1 - out)}>
        <div style={{ position: "relative", width: ch.w, boxSizing: "border-box", padding: `${CHIP_PAD.y}px ${CHIP_PAD.x}px` }}>
          <div style={{ ...GLASS, position: "absolute", inset: 0, borderRadius: 28, opacity: 1 - prog(f, wIn + 4, 12) }} />
          <FactBlock k={CHIP_K} label={ch.label} value={ch.value} style={{ position: "relative" }} />
        </div>
      </TL>
    );
  });

  /* The dim "Hidden" line: appears on "only", docks into the facts card's hidden line after the chips have passed. */
  const hIn = prog(f, t.only + 4, 16, OE);
  const hd = prog(f, dock0 + 10, 22);
  const hOut = prog(f, fadeAt, 8);
  const hT = stageOf(FACT_AT.hidden);

  /* The proof window materialises around the docked facts, grows down on "releases" to reveal the DAO line (from the
     real footage when present), recedes on "own". It is anchored by its top so the facts never move while it grows. */
  const wp = prog(f, wIn, 18);
  const wr = prog(f, t.own + 4, 22, IN_OUT_STRONG);
  const grow = prog(f, t.releases - 6, 16, EASE);
  const cropH = lerp(CROP_H_FACTS, CROP_H_FULL, grow);
  const winH = cropH * K;
  const txP = prog(f, t.releases + 14, 14, OE);

  /* The layers dim while the facts have the stage, and leave as the camera moves onto the window. */
  const dim = kf(f, [t.friends, t.friends + 16, t.verifies + 6, t.verifies + 26], [1, 0.4, 0.4, 1]);

  /* The inbox: assembles under the landing email, recedes when it opens, returns for H7. */
  const back = t.own + 14;
  let inbox: InboxLook | null = null;
  if (f >= t.landing && f < open + 26) {
    const r = prog(f, t.landing + 24, 12);
    inbox = {
      o: kf(f, [t.landing + 2, t.landing + 24, open, open + 24], [0, 1, 1, 0]),
      s: kf(f, [t.landing + 2, t.landing + 28, open, open + 24], [0.96, 1, 1, 0.95]),
      blur: kf(f, [open, open + 24], [0, 8]),
      addr: prog(f, t.landing + 12, 14),
      lab: prog(f, t.landing + 18, 12),
      row: r * (1 - prog(f, open, 6)),
      rowY: -12 * (1 - r),
      glow: 0,
      status: "received",
    };
  } else if (f >= back) {
    inbox = {
      o: prog(f, back, 22),
      s: 0.94 + 0.06 * prog(f, back, 26),
      blur: 8 * (1 - prog(f, back, 22)),
      lab: 1, addr: 1, row: 1, rowY: 0,
      glow: PROOF_ACCEPTED ? kf(f, [back + 8, back + 16, LAST - 7], [0, 1, 0]) : 0,
      status: H7_ITEM.status,
    };
  }
  const inboxLayer = inbox && <InboxLayer look={inbox} camT={camT} />;

  return (
    <World>
      {sw < 1 && (
        <div style={{ position: "absolute", left: 960 + sw * 1700, top: 540 - sw * 1000, transform: `translate(-50%, -50%) rotate(${sw * 16}deg) scale(${1 - sw * 0.25})` }}>
          <TripCard width={CARD_W} />
        </div>
      )}
      {f < back && inboxLayer}
      <Stage cam={cam}>
        {chipO > 0 && (
          <At x={0} y={-335 + (1 - prog(f, t.conf + 6, 14, OE)) * 12} opacity={chipO}>
            <TripChip />
          </At>
        )}
        {eo > 0 && (
          <At x={ex} y={ey} z={-dis * 60} ry={kf(f, [eIn, eIn + 34], [-32, 0])} rz={kf(f, [eIn, eIn + 34], [5, 0])} s={1 - dis * 0.04} opacity={eo} style={{ filter: dis > 0 ? `blur(${dis * 14}px)` : undefined }}>
            <EmailCard
              w={kf(f, mF, [EW * E1, ROW.w, ROW.w, EW * E2])}
              h={kf(f, mF, [EH * E1, ROW.h, ROW.h, EH * E2])}
              radius={kf(f, mF, [36 * E1, ROW.r, ROW.r, 36 * E2])}
              chrome={kf(f, mF, [1, 0, 0, 1])}
              content={kf(f, [t.landing + 6, t.landing + 26, open + 2, open + 22], [1, 0, 0, 1])}
              blur={kf(f, [t.privately - 18, t.privately + 8], [2.2, 12])}
              bodyO={kf(f, [t.privately - 18, t.privately + 8], [1, 0.5])}
              sheen={(f - (t.privately - 22)) / 34}
              seal={PROOF_ACCEPTED ? prog(f, t.signed, 10) : 0}
            />
          </At>
        )}
        {TILES.map((tile, i) => {
          const a = prog(f, [t.bk1 + 14, t.near - 2, t.verifies + 15][i], 22);
          const x = prog(f, t.crews - 12 + i * 2, 12, Easing.in(Easing.cubic));
          const xo = prog(f, t.crews - 12 + i * 2, 10, Easing.linear);
          if (a <= 0 || xo >= 1) return null;
          return (
            <At key={i} x={TILE_X + (1 - a) * 90 + x * 140} y={TILE_Y[i]} z={-(1 - a) * 120 - x * 160} ry={-7 - (1 - a) * 14} rx={[3, 0, -3][i]} opacity={Math.min(1, a * 1.4) * (1 - xo) * (i < 2 ? dim : 1)}>
              <CheckTile title={tile.title} sub={tile.sub} accent={tile.accent} f={f} lightAt={[t.signed, t.privately, t.chain][i]} pass={PROOF_ACCEPTED} chip={"chip" in tile ? tile.chip : undefined} chipAt={t.signed + 14} />
            </At>
          );
        })}
        {wp > 0 && wr < 1 && (
          <At x={WIN_C.x} y={WIN_TOP + winH / 2 + (1 - wp) * 16 - wr * 20} z={-(1 - wp) * 60 - wr * 520} s={1 - (1 - wp) * 0.02 - wr * 0.08} opacity={wp * (1 - wr)} style={{ filter: wp < 1 ? `blur(${(1 - wp) * 6}px)` : undefined }}>
            <div style={{ position: "relative" }}>
              <Sequence from={wIn} layout="none">
                <AppWindow width={WIN_W} height={winH}>
                  <FootageSlot
                    id="proof"
                    width={WIN_W}
                    height={winH}
                    crop={{ x: CROP_X, y: CROP_Y, w: CROP_W, h: cropH }}
                    startFrom={PROOF_START}
                    placeholder={<ProofPlaceholder factsIn={prog(f, fadeAt - 2, 8)} hiddenIn={prog(f, fadeAt - 2, 8)} line={prog(f, t.releases - 2, 12, OE)} />}
                  />
                </AppWindow>
              </Sequence>
              {PROOF_ACCEPTED && txP > 0 && (
                <span style={{ position: "absolute", right: 34, bottom: -21, height: 42, padding: "0 18px", display: "inline-flex", alignItems: "center", borderRadius: 99, background: C.void, border: `1px solid ${C.lineStrong}`, fontFamily: MONO, fontSize: 20, color: C.fg2, whiteSpace: "nowrap", opacity: txP, transform: `translateY(${(1 - txP) * 8}px)` }}>
                  tx {FACTS.proofTx.slice(0, 8)}… · NEAR testnet
                </span>
              )}
            </div>
          </At>
        )}
        {chips}
        {hIn > 0 && hOut < 1 && (
          <TL x={lerp(LEFT.x - HIDDEN_W / 2, hT.x, hd)} y={lerp(128 + (1 - hIn) * 10, hT.y, hd)} z={2} s={lerp(1, K / HIDDEN_K, hd)} opacity={hIn * (1 - hOut)} style={{ filter: hIn < 1 ? `blur(${(1 - hIn) * 8}px)` : undefined }}>
            <SmallLine k={HIDDEN_K} color={C.fg3}>{HIDDEN_TEXT}</SmallLine>
          </TL>
        )}
      </Stage>
      {f >= back && inboxLayer}
    </World>
  );
};
