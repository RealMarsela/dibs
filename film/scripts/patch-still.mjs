#!/usr/bin/env node
/* Render one PayPatch still at scale 1.5 (2880x1620 PNG, transparent unless bg given). Usage: patch-still.mjs <props.json> <out.png> */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
const [propsFile, out] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const inputProps = JSON.parse(fs.readFileSync(propsFile, "utf8"));
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "PayPatch", inputProps });
await renderStill({ composition, serveUrl, frame: 0, output: out, imageFormat: "png", scale: 1.5, inputProps });
console.log(out);
