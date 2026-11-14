#!/usr/bin/env node
/* Render several frames of one composition with ONE bundle and ONE browser (cheap on RAM).
   Usage: scripts/stills.sh <CompositionId> <frame,frame,...> <outDir> [--scale=0.5]
   Frames are local to the composition. Writes <outDir>/<CompositionId>-<frame>.jpg */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [comp, framesArg, outDir, ...rest] = process.argv.slice(2);
if (!comp || !framesArg || !outDir) {
  console.error("usage: stills.mjs <CompositionId> <f1,f2,...> <outDir> [--scale=0.5]");
  process.exit(1);
}
const scale = Number((rest.find((a) => a.startsWith("--scale=")) ?? "--scale=1").split("=")[1]);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
const composition = await selectComposition({ serveUrl, id: comp, inputProps: {}, puppeteerInstance: browser });
for (const f of framesArg.split(",").map((x) => Number(x.trim()))) {
  const out = path.join(outDir, `${comp}-${String(f).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, frame: f, output: out, imageFormat: "jpeg", jpegQuality: 88, scale, puppeteerInstance: browser });
  console.log(out);
}
await browser.close({ silent: true });
