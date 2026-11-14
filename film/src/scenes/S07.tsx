import React from "react";
import { Easing, Sequence } from "remotion";
import { World } from "../components/World";
import { At, Stage } from "../components/Stage";
import { AppWindow, FootageSlot } from "../components/Footage";
import { TripCard } from "../components/Trip";
import { H6, H7 } from "../handoffs";
import { SCENES, useScene } from "../scene";
import { C, EASE, FACTS, FONT, GLASS, IN_OUT_STRONG, OE, OUT_STRONG } from "../tokens";
import { kf, lerp, prog } from "../lib/anim";
import { BODY_AT, EH, EW, EmailCard } from "./s07/Email";
import { CheckTile } from "./s07/CheckTile";
import { CHIP_K, CROP, FACT_AT, FactBlock, HIDDEN_TEXT, K, ProofPlaceholder, WIN_C, WIN_H, WIN_W, stageOf } from "./s07/Proof";
import { CrewCheer, InboxLayer, type InboxLook } from "./s07/Layers";

/* S07 "Prove it", the film's one magic moment. H6 (card) -> the card swipes away as Maya books -> the booking.com email
   flies in and is filed into the trip's own inbox ("Checking…") -> it opens again; the camera pushes in, then pulls
   back as three checks light one at a time (DKIM in an Intel TDX enclave, NEAR AI's private read, the contract's
   on-chain verdict) -> the email dissolves and only dates, guests and total lift out -> they dock into the proof
   sheet's facts card (footage slot `proof`) as the DAO pays Maya and the crew cheers -> the inbox returns Verified = H7. */
const LAST = SCENES.S07.to - SCENES.S07.from - 1;
/** The inbox row's rect (stage px) inside the InboxPanel centred on the frame. */
const ROW = { y: 56, w: 944, h: 84, r: 22 };
const EMAIL_LEFT = -400;
const EMAIL_FACTS_Y = -70;
const TILE_X = 440;
const TILE_Y = [-180, 0, 180];
/** Frames into the `proof` clip where the facts card is already on screen (set when the clip lands). */
const PROOF_START = 0;
/** Rendered width of HIDDEN_TEXT at 24 px (so it can dock by its top-left). */
const HIDDEN_W = 562;

const TILES = [
  { title: "DKIM: booking.com really signed it", sub: "Intel TDX enclave · OutLayer", accent: "ring" },
  { title: "Read privately by NEAR AI", sub: "GPU enclave · nobody sees the email", accent: "bloom" },
  { title: "Signed result verified on chain", sub: "ed25519 · dibs contract", accent: "stamp" },
] as const;

const CHIP_PAD = { x: 28, y: 20 };
const CHIPS = [
  { id: "dates", w: 360, pre: { x: -180, y: -200 }, label: "Dates", value: FACTS.dates },
  { id: "guests", w: 240, pre: { x: -258, y: -33 }, label: "Guests", value: String(FACTS.beds) },
  { id: "total", w: 240, pre: { x: 18, y: -33 }, label: "Total", value: `$${FACTS.pot}` },
] as const;

/** Child anchored by its top-left in stage px (for things that dock onto exact points). */
const TL = ({ x, y, z = 0, s = 1, opacity = 1, style, children }: { x: number; y: number; z?: number; s?: number; opacity?: number; style?: React.CSSProperties; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${s})`, opacity, ...style }}>{children}</div>
);

export const S07: React.FC = () => {
  const { f, A, cue } = useScene();
  const c = (w: string, n = 0) => cue("L07", w, n);
  const t = {
    then: c("Then"), lands: c("lands"), an: c("An"), bk1: c("booking.com", 1), signed: c("signed"), near: c("NEAR"),
    privately: c("privately"), contract: c("contract"), chain: c("chain"), friends: c("Friends"), only: c("only"),
    dates: c("dates"), guests: c("guests"), total: c("total"), crews: c("crew's"), releases: c("releases"), own: c("own", 1),
  };
  if (f <= 2) return <World><H6 /></World>;
  if (f >= LAST - 7) return <World><H7 /></World>;

  /* Camera: follow the email in, settle on the inbox, push into the opened email, pull back for the checks,
     neutral for the facts, slow push on the window, neutral again for H7. A small drift keeps it alive. */
  const open = t.an - 2;
  const camF = [0, t.then + 1, t.then + 19, t.then + 49, t.lands + 28, open, open + 10, open + 60, open + 96, t.contract + 19, t.friends - 4, t.friends + 34, t.crews - 6, t.own + 2, t.own + 34];
  const env = kf(f, [0, 12, LAST - 24, LAST - 12], [0, 1, 1, 0]);
  const cam = {
    s: kf(f, camF, [1, 1, 1, 1, 1, 1.02, 1.02, 1.18, 1.02, 1.02, 0.97, 1, 1, 1.04, 1]),
    x: kf(f, camF, [0, 0, 80, 0, 0, 0, 0, 0, 12, 12, 12, 0, 0, 0, 0]) + Math.sin(f / 47) * 4 * env,
    y: kf(f, camF, [0, 0, 0, 0, 0, 0, 0, -60, 0, 0, 0, 0, 0, -8, 0]) + Math.cos(f / 61) * 3 * env - 3 * env,
    ry: kf(f, [open + 96, t.privately + 12, t.friends - 4, t.friends + 34], [0, -2, 1.5, 0]),
  };
  const camT = `translate(${-cam.x}px, ${-cam.y}px) scale(${cam.s})`;

  /* The card swipes off right-up (Maya books with it). */
  const sw = prog(f, 2, 20, OUT_STRONG);

  /* The email: flies in, is filed into the row, opens again, slides left for the checks, recentres, dissolves. */
  const eIn = t.then + 1;
  const mF = [t.lands, t.lands + 32, open, open + 32];
  const ex = kf(f, [eIn, eIn + 34, open + 60, open + 96, t.friends + 10, t.friends + 38], [1500, 0, 0, EMAIL_LEFT, EMAIL_LEFT, 0]);
  const ey = kf(f, [eIn, eIn + 34, t.lands, t.lands + 32, open, open + 32, open + 60, open + 96, t.friends + 10, t.friends + 38], [60, -20, -20, ROW.y, ROW.y, -10, -10, 0, 0, EMAIL_FACTS_Y]);
  const eo = kf(f, [t.lands + 28, t.lands + 36, open - 1, open, t.friends + 14, t.total + 6], [1, 0, 0, 1, 1, 0], [EASE, EASE, EASE, EASE, OE]);
  const dis = prog(f, t.friends + 14, t.total - t.friends - 14, EASE);

  /* Fact chips lift out of the email's body, then dock onto the window's facts card. */
  const dock0 = t.crews - 12;
  const fadeAt = t.releases - 4;
  const wIn = t.crews + 6;
  const sd = K / CHIP_K;
  const chips = CHIPS.map((ch, i) => {
    const lp = prog(f, [t.dates, t.guests, t.total][i], 22);
    const dp = prog(f, dock0 + i * 3, 24);
    const out = prog(f, fadeAt, 8);
    if (lp <= 0 || out >= 1) return null;
    const s0 = 0.56;
    const b = BODY_AT[ch.id];
    const start = { x: b.x - CHIP_PAD.x * s0, y: EMAIL_FACTS_Y + b.y - CHIP_PAD.y * s0 };
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

  /* The dim "Hidden" line: appears on "only", docks into the facts card's hidden line. */
  const hIn = prog(f, t.only + 4, 16, OE);
  const hd = prog(f, dock0 + 10, 22);
  const hOut = prog(f, fadeAt, 8);
  const hT = stageOf(FACT_AT.hidden);
  const hs = (12 * K) / 24;

  /* The proof window materialises around the docked facts (a short rise from depth), recedes on "own". */
  const wp = prog(f, wIn, 18);
  const wr = prog(f, t.own + 2, 22, IN_OUT_STRONG);

  /* The inbox: assembles under the landing email, recedes when it opens, returns Verified for H7. */
  const back = t.own + 16;
  let inbox: InboxLook | null = null;
  if (f >= t.lands && f < open + 26) {
    const r = prog(f, t.lands + 24, 12);
    inbox = {
      o: kf(f, [t.lands + 2, t.lands + 24, open, open + 24], [0, 1, 1, 0]),
      s: kf(f, [t.lands + 2, t.lands + 28, open, open + 24], [0.96, 1, 1, 0.95]),
      blur: kf(f, [open, open + 24], [0, 8]),
      addr: prog(f, t.lands + 12, 14),
      lab: prog(f, t.lands + 18, 12),
      row: r * (1 - prog(f, open, 6)),
      rowY: -12 * (1 - r),
      glow: 0,
      status: "checking",
    };
  } else if (f >= back) {
    inbox = {
      o: prog(f, back, 22),
      s: 0.94 + 0.06 * prog(f, back, 26),
      blur: 8 * (1 - prog(f, back, 22)),
      lab: 1, addr: 1, row: 1, rowY: 0,
      glow: kf(f, [back + 8, back + 16, LAST - 7], [0, 1, 0]),
      status: "verified",
    };
  }
  const inboxLayer = inbox && <InboxLayer look={inbox} camT={camT} />;

  return (
    <World>
      {sw < 1 && (
        <div style={{ position: "absolute", left: 960 + sw * 1500, top: 540 - sw * 900, transform: `translate(-50%, -50%) rotate(${sw * 16}deg) scale(${1 - sw * 0.25})` }}>
          <TripCard width={640} />
        </div>
      )}
      {f < back && inboxLayer}
      <Stage cam={cam}>
        {eo > 0 && (
          <At x={ex} y={ey} z={-dis * 60} ry={kf(f, [eIn, eIn + 34], [-32, 0])} rz={kf(f, [eIn, eIn + 34], [5, 0])} s={1 - dis * 0.04} opacity={eo} style={{ filter: dis > 0 ? `blur(${dis * 14}px)` : undefined }}>
            <EmailCard
              w={kf(f, mF, [EW, ROW.w, ROW.w, EW])}
              h={kf(f, mF, [EH, ROW.h, ROW.h, EH])}
              radius={kf(f, mF, [36, ROW.r, ROW.r, 36])}
              chrome={kf(f, mF, [1, 0, 0, 1])}
              content={kf(f, [t.lands + 6, t.lands + 26, open + 2, open + 22], [1, 0, 0, 1])}
              blur={kf(f, [t.privately - 18, t.privately + 8], [2.2, 12])}
              bodyO={kf(f, [t.privately - 18, t.privately + 8], [1, 0.5])}
              sheen={(f - (t.privately - 22)) / 34}
              seal={prog(f, t.signed, 10)}
            />
          </At>
        )}
        {TILES.map((tile, i) => {
          const a = prog(f, [t.bk1 + 7, t.near - 1, t.contract - 3][i], 22);
          const x = prog(f, t.friends - 6 + i * 2, 14, Easing.in(Easing.cubic));
          if (a <= 0 || x >= 1) return null;
          return (
            <At key={i} x={TILE_X + (1 - a) * 90 + x * 120} y={TILE_Y[i]} z={-(1 - a) * 120 - x * 160} ry={-7 - (1 - a) * 14} rx={[3, 0, -3][i]} opacity={Math.min(1, a * 1.4) * (1 - x)}>
              <CheckTile title={tile.title} sub={tile.sub} accent={tile.accent} f={f} lightAt={[t.signed, t.privately, t.chain][i]} />
            </At>
          );
        })}
        {wp > 0 && wr < 1 && (
          <At x={WIN_C.x} y={WIN_C.y + (1 - wp) * 16 - wr * 20} z={-(1 - wp) * 60 - wr * 520} s={1 - (1 - wp) * 0.02 - wr * 0.08} opacity={wp * (1 - wr)} style={{ filter: wp < 1 ? `blur(${(1 - wp) * 6}px)` : undefined }}>
            <Sequence from={wIn} layout="none">
              <AppWindow width={WIN_W} height={WIN_H}>
                <FootageSlot
                  id="proof"
                  width={WIN_W}
                  height={WIN_H}
                  crop={CROP}
                  startFrom={PROOF_START}
                  placeholder={<ProofPlaceholder factsIn={prog(f, fadeAt - 2, 8)} hiddenIn={prog(f, fadeAt - 2, 8)} line={prog(f, t.releases - 10, 12, OE)} />}
                />
              </AppWindow>
            </Sequence>
          </At>
        )}
        {chips}
        {hIn > 0 && hOut < 1 && (
          <TL x={lerp(-HIDDEN_W / 2, hT.x, hd)} y={lerp(168 + (1 - hIn) * 10, hT.y, hd)} z={2} s={lerp(1, hs, hd)} opacity={hIn * (1 - hOut)} style={{ filter: hIn < 1 ? `blur(${(1 - hIn) * 8}px)` : undefined }}>
            <div style={{ fontFamily: FONT, fontSize: 24, lineHeight: "36px", color: C.fg3, whiteSpace: "nowrap" }}>{HIDDEN_TEXT}</div>
          </TL>
        )}
      </Stage>
      <CrewCheer f={f} A={A} inAt={t.releases - 4} outAt={t.own - 4} />
      {f >= back && inboxLayer}
    </World>
  );
};
