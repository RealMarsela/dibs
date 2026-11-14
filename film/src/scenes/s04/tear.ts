/* Tear-ticket geometry and a frame-driven tear, ported from apps/web/src/vendor/tear-ticket.tsx (React Bits, MIT +
   Commons Clause; the app's own vendored copy). Horizontal orientation only. The app's sizes (width ~380, height 186,
   stub 104, radius 16, 10 holes of 6 px, notch 3) are scaled by K so the ticket reads at about 900 x 340 in the film. */

export const K = 900 / 380;
export const TW = 900;
export const TH = 340;
export const TS = 240;
const RADIUS = 16 * K;
const HOLES = 10;
const HOLE = 6 * K;
const NOTCH = 3 * K;
const STRETCH = 30 * K;
const LIMIT = (30 * Math.PI) / 180;
const HANG = LIMIT * 0.55;

type Bridge = { x: number; y: number; y0: number; y1: number; mid: number };
const f2 = (n: number) => n.toFixed(2);

function build() {
  const main = TW;
  const cross = TH;
  const x = main - TS;
  const hr = HOLE / 2;
  const n = HOLES;
  const span = cross - 2 * NOTCH;
  const bridge = Math.max(2, (span - n * HOLE) / (n + 1));
  const pt = (u: number, v: number) => `${f2(u)},${f2(v)}`;
  const arc = (r: number, sweep: number, u: number, v: number) => `A${f2(r)},${f2(r)} 0 0 ${sweep} ${pt(u, v)}`;
  const bridges: Bridge[] = [];
  for (let i = 0; i <= n; i += 1) {
    const y0 = NOTCH + i * (bridge + HOLE);
    const y1 = y0 + bridge;
    bridges.push({ y0, y1, mid: (y0 + y1) / 2, x, y: (y0 + y1) / 2 });
  }
  const R = RADIUS;
  let body = `M${pt(R, 0)}L${pt(x - NOTCH, 0)}${arc(NOTCH, 0, x, NOTCH)}`;
  bridges.forEach((b, i) => {
    body += `L${pt(x, b.y1)}`;
    if (i < n) body += arc(hr, 0, x, b.y1 + HOLE);
  });
  body += `${arc(NOTCH, 0, x - NOTCH, cross)}L${pt(R, cross)}${arc(R, 1, 0, cross - R)}L${pt(0, R)}${arc(R, 1, R, 0)}Z`;
  let stub = `M${pt(x + NOTCH, 0)}L${pt(main - R, 0)}${arc(R, 1, main, R)}L${pt(main, cross - R)}${arc(R, 1, main - R, cross)}L${pt(x + NOTCH, cross)}${arc(NOTCH, 0, x, cross - NOTCH)}`;
  for (let i = n; i >= 0; i -= 1) {
    const b = bridges[i];
    stub += `L${pt(x, b.y0)}`;
    if (i > 0) stub += arc(hr, 0, x, b.y0 - HOLE);
  }
  stub += `${arc(NOTCH, 0, x + NOTCH, 0)}Z`;
  const bodyOutline = `M${pt(x, cross - NOTCH)}${arc(NOTCH, 0, x - NOTCH, cross)}L${pt(R, cross)}${arc(R, 1, 0, cross - R)}L${pt(0, R)}${arc(R, 1, R, 0)}L${pt(x - NOTCH, 0)}${arc(NOTCH, 0, x, NOTCH)}`;
  const stubOutline = `M${pt(x, NOTCH)}${arc(NOTCH, 0, x + NOTCH, 0)}L${pt(main - R, 0)}${arc(R, 1, main, R)}L${pt(main, cross - R)}${arc(R, 1, main - R, cross)}L${pt(x + NOTCH, cross)}${arc(NOTCH, 0, x, cross - NOTCH)}`;
  return { body, stub, bodyOutline, stubOutline, bridges, hinge: { x, y: cross - NOTCH } };
}
export const GEO = build();

/* The pull: the stub is grabbed in its upper half, so it hinges on the bottom end of the perforation and turns
   clockwise; bridges far from the hinge stretch and snap first (the app's rule: 2·d·sin(θ/2) + slack > stretch). */
const TU = 16; // frames from first pull to fully free
const SNAP_FADE = 5; // the app's 0.17 s fibre retract
const pullTheta = (u: number) => LIMIT * 1.04 * Math.pow(Math.min(1, Math.max(0, u / TU)), 1.6);
const pullSlack = (u: number) => 4 * K * Math.min(1, Math.max(0, u / TU));
const SNAP_AT: number[] = GEO.bridges.map((b) => {
  const d = Math.abs(b.mid - GEO.hinge.y);
  for (let u = 0; u <= TU; u += 0.25) {
    const th = pullTheta(u);
    if (2 * d * Math.sin(th / 2) + pullSlack(u) > STRETCH || th >= LIMIT) return u;
  }
  return TU;
});
const FIRST_SNAP = Math.min(...SNAP_AT);

export type TearState = { theta: number; sx: number; sy: number; bx: number; fibres: { near: string; far: string; w: number; o: number }[] };

/** State of the tear u frames after the pull starts (u < 0: intact). */
export function tearAt(u: number): TearState {
  let theta = 0;
  let sx = 0;
  let sy = 0;
  if (u > 0 && u <= TU) {
    theta = pullTheta(u);
    sx = pullSlack(u);
  } else if (u > TU) {
    const v = u - TU;
    const settle = Math.min(1, v / 18);
    const ease = 1 - Math.pow(1 - settle, 3);
    theta = HANG + (pullTheta(TU) - HANG) * Math.exp(-v / 7) * Math.cos(v / 3.6) + 0.025 * Math.sin(v / 13);
    sx = pullSlack(TU) + (34 - pullSlack(TU)) * ease;
    sy = 16 * ease + 3 * Math.sin(v / 15);
  }
  // body recoil: a small damped kick from the snaps (the app's bx spring)
  const r = u - FIRST_SNAP;
  const bx = r > 0 ? -8 * Math.exp(-r / 7) * Math.sin(r / 2.4) : 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const { x: hx, y: hy } = GEO.hinge;
  const ly = 1.6 * K;
  const fibres = GEO.bridges.map((b, i) => {
    const dy = b.y - hy;
    const tx = hx - dy * sin + sx;
    const ty = hy + dy * cos + sy;
    const ox = b.x + bx;
    const oy = b.y;
    const gx = tx - ox;
    const gy = ty - oy;
    const gap = Math.hypot(gx, gy);
    const snapped = u >= SNAP_AT[i];
    if (u <= 0) return { near: "", far: "", w: 0, o: 0 };
    if (!snapped) {
      if (gap < 0.35) return { near: "", far: "", w: 0, o: 0 };
      const k = Math.min(1, gap / STRETCH);
      const sag = gap * 0.18;
      const qx = gx / 2;
      const qy = sag + gy / 2;
      return {
        near: `M${f2(ox)},${f2(oy - ly)}Q${f2(ox + qx)},${f2(oy - ly + qy)} ${f2(tx)},${f2(ty - ly)}`,
        far: `M${f2(ox)},${f2(oy + ly)}Q${f2(ox + gx - qx)},${f2(oy + ly + gy - qy)} ${f2(tx)},${f2(ty + ly)}`,
        w: (1.7 - 1.15 * k) * K,
        o: 1,
      };
    }
    const t = (u - SNAP_AT[i]) / SNAP_FADE;
    if (t >= 1) return { near: "", far: "", w: 0, o: 0 };
    const left = (1 - t) * (1 - t);
    const len = STRETCH * 0.5 * left;
    const ux = gap > 0.01 ? gx / gap : 1;
    const uy = gap > 0.01 ? gy / gap : 0;
    return {
      near: `M${f2(ox)},${f2(oy)}L${f2(ox + ux * len)},${f2(oy + uy * len)}`,
      far: `M${f2(tx)},${f2(ty)}L${f2(tx - ux * len)},${f2(ty - uy * len)}`,
      w: 0.9 * K,
      o: left,
    };
  });
  return { theta, sx, sy, bx, fibres };
}

/** Where a stub-local point ends up under the tear transform (rotate about the hinge, then translate). */
export function stubPoint(st: TearState, x: number, y: number) {
  const { x: hx, y: hy } = GEO.hinge;
  const dx = x - hx;
  const dy = y - hy;
  const c = Math.cos(st.theta);
  const s = Math.sin(st.theta);
  return { x: hx + dx * c - dy * s + st.sx, y: hy + dx * s + dy * c + st.sy };
}
