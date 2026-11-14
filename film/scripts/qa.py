#!/usr/bin/env python3
"""Technical QA of an encoded film + frame sheets around every seam.
Usage: python3 -I scripts/qa.py out/dibs-film-v1.mp4 [extra_frame ...]
Writes out/qa/<name>/ : seam strips (b-6, b-2, b, b+2, b+6 for each scene boundary) and a probe summary."""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mp4 = sys.argv[1]; extra = [int(x) for x in sys.argv[2:]]
name = os.path.splitext(os.path.basename(mp4))[0]
qd = os.path.join(ROOT, "out/qa", name); os.makedirs(qd, exist_ok=True)
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4], capture_output=True, text=True).stdout)
v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]; a = [s for s in pr["streams"] if s["codec_type"] == "audio"]
summ = {k: v.get(k) for k in ["codec_name", "width", "height", "pix_fmt", "color_range", "color_space", "color_transfer", "color_primaries", "r_frame_rate", "nb_frames"]}
summ["duration"] = pr["format"]["duration"]; summ["bit_rate"] = pr["format"].get("bit_rate")
summ["audio"] = [{k: s.get(k) for k in ["codec_name", "sample_rate", "channels"]} for s in a]
dec = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-f", "null", "-"], capture_output=True, text=True)
summ["decode_errors"] = len([l for l in dec.stderr.splitlines() if l.strip()])
print(json.dumps(summ, indent=1))
src = open(os.path.join(ROOT, "src/scene.tsx")).read()
shift = int(re.search(r"SHIFT = (\d+)", open(os.path.join(ROOT, "src/timeline.generated.ts")).read()).group(1))
bounds = sorted({eval(m.replace("S", str(shift))) for m in re.findall(r"from: ([0-9 +S]+),", src)} - {0})
frames = sorted({f for b in bounds for f in (b - 6, b - 2, b, b + 2, b + 6)} | set(extra))
sel = "+".join(f"eq(n\\,{f})" for f in frames)
tmp = os.path.join(qd, "tmp_%04d.jpg")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", f"select={sel},scale=960:-1", "-fps_mode", "passthrough", "-q:v", "3", tmp])
for i, f in enumerate(frames, 1):
    t = os.path.join(qd, f"tmp_{i:04d}.jpg")
    if os.path.exists(t): os.replace(t, os.path.join(qd, f"f{f:05d}.jpg"))
print("seams", bounds); print("frames in", qd)
json.dump(summ, open(os.path.join(qd, "probe.json"), "w"), indent=1)
