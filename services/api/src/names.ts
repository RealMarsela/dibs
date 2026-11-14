import { Hono } from "hono";
import { z } from "zod";
import { ApiError, parse, readJson } from "./errors";
import type { Env } from "./env";
import { clientIp } from "./calls";
import { rateLimit } from "./ratelimit";

export const namesRoute = new Hono<{ Bindings: Env }>();

const SKEW_MS = 10 * 60_000;
const SUFFIX = "own-0eb9ae.testnet";
export const SEED_NAMES: Record<string, string> = Object.fromEntries(
  [["maya", "Maya"], ["sam", "Sam"], ["leo", "Leo"], ["ana", "Ana"], ["tomas", "Tomás"], ["jun", "Jun"], ["chloe", "Chloé"], ["kofi", "Kofi"], ["priya", "Priya"]].map(([k, v]) => [`${k}.${SUFFIX}`, v]),
);

const nameRe = /^[\p{L}\p{M}][\p{L}\p{M} ]{0,23}$/u;
const putBody = z
  .object({
    account: z.string().regex(/^[0-9a-f]{64}$/, "account must be a 64-hex implicit account"),
    name: z.string().min(1).max(24).regex(nameRe, "1-24 letters and spaces"),
    ts: z.number().int(),
    sig: z.string().regex(/^[0-9a-fA-F]{128}$|^[A-Za-z0-9+/=_-]{86,90}$/, "ed25519 signature, hex or base64"),
  })
  .strict();

const hex = (s: string) => Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16));
function sigBytes(s: string): Uint8Array {
  if (/^[0-9a-fA-F]{128}$/.test(s)) return hex(s);
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

export const nameMessage = (account: string, name: string, ts: number): string => `dibs-name:v1:${account}:${name}:${ts}`;

async function verify(account: string, msg: string, sig: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", hex(account), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, sig, new TextEncoder().encode(msg));
  } catch {
    return false;
  }
}

namesRoute.put("/names", async (c) => {
  const b = parse(putBody, await readJson(c));
  rateLimit(`names:ip:${clientIp(c)}`, 20, 60_000);
  if (Math.abs(Date.now() - b.ts) > SKEW_MS) throw new ApiError(400, "E_STALE", "timestamp is outside the 10 minute window");
  if (!(await verify(b.account, nameMessage(b.account, b.name, b.ts), sigBytes(b.sig)))) throw new ApiError(401, "E_BAD_SIG", "signature does not match the account key");
  await c.env.NAMES.put(`name/${b.account}`, b.name);
  return c.json({ account: b.account, name: b.name });
});

namesRoute.get("/names", async (c) => {
  const accounts = (c.req.query("accounts") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (accounts.length > 50) throw new ApiError(400, "E_BAD_INPUT", "at most 50 accounts");
  const out: Record<string, string> = {};
  await Promise.all(
    accounts.map(async (a) => {
      if (!/^[a-z0-9._-]{2,64}$/.test(a)) return;
      const n = SEED_NAMES[a] ?? (await c.env.NAMES.get(`name/${a}`));
      if (n) out[a] = n;
    }),
  );
  c.header("cache-control", "public, max-age=10");
  return c.json(out);
});
