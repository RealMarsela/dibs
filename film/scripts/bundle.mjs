#!/usr/bin/env node
/* Bundle ONCE into out/bundle and reuse it (coordinator disk rule, 14 Nov): every re-bundle used to leave a full copy of
   public/ in $TMPDIR. Rebuilds only when something under src/ or public/ is newer than the bundle. Prints the bundle path. */
import { bundle } from "@remotion/bundler";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "out/bundle");
const stamp = path.join(out, "index.html");

function newest(dir) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }
  return t;
}

export async function ensureBundle({ force = false } = {}) {
  const src = Math.max(newest(path.join(root, "src")), newest(path.join(root, "public")));
  if (!force && fs.existsSync(stamp) && fs.statSync(stamp).mtimeMs >= src) return out;
  fs.rmSync(out, { recursive: true, force: true });
  await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public"), outDir: out });
  fs.utimesSync(stamp, new Date(), new Date());
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(await ensureBundle({ force: process.argv.includes("--force") }));
}
