#!/usr/bin/env python3
"""Re-label two progress steps in public/footage/pay-base-orig.mp4 to the live app's testnet copy (coordinator, 14 Nov):
"Deposit seen on your chain" -> "Test deposit sent by the faucet", "Swapped by NEAR Intents" -> "No swap needed on testnet".
1) Render the label patches in Chrome at the recording's scale (PayPatch composition, scale 1.5):
     node scripts/patch-still.mjs tools-data/paybase-patch/<state>.json out/qa/patch/<state>.png   (state: p_track_dim, p_track, p_in)
2) python3 -I scripts/patch-paybase.py  -> sub-pixel shift (-1.5, +0.5 px) and blur 0.7 px fitted against the recording's own
   unchanged labels (mean abs error ~2.6/255), alpha only over the two label rows, composited frame-exactly:
   frames 243-275 tracking with step 2 still grey, 276-482 tracking, 483-559 "You're in" (rows 75 px higher)."""
import os, subprocess
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "out/qa/patch")
for name, dy in (("p_track_dim", 0), ("p_track", 0), ("p_in", -75)):
    im = Image.open(os.path.join(P, name + ".png")).convert("RGB")
    im = im.transform(im.size, Image.AFFINE, (1, 0, -1.5, 0, 1, 0.5), resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.7))
    a = np.zeros((1620, 2880), np.uint8)
    for y0, y1 in ((750, 792), (816, 858)):
        a[y0 + dy:y1 + dy, 1198:1600] = 255
    Image.fromarray(np.dstack([np.asarray(im), a]), "RGBA").save(os.path.join(P, name + "_ov.png"))
src = os.path.join(ROOT, "public/footage/pay-base-orig.mp4")
out = os.path.join(ROOT, "public/footage/pay-base.mp4")
fc = "[0][1]overlay=enable='between(n,243,275)'[a];[a][2]overlay=enable='between(n,276,482)'[b];[b][3]overlay=enable='gte(n,483)',format=yuv420p[v]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src] + sum((["-i", os.path.join(P, n + "_ov.png")] for n in ("p_track_dim", "p_track", "p_in")), []) +
               ["-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-r", "24", "-movflags", "+faststart", out], check=True)
print(out)
