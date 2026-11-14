#!/usr/bin/env python3
"""After the coordinator's go: put L03J (journey line) in the cut. Places L03A 0.45 s after L03J's speech ends and moves
L04-L09 and the total by the same delta. Run after scripts/voice.py L03J."""
import json, os, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "voice/placement.json"); d = json.load(open(p))
mp3 = os.path.join(ROOT, "public/audio/vo/L03J.mp3")
out = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp3, "-af", "silencedetect=n=-45dB:d=0.3", "-f", "null", "-"], capture_output=True, text=True).stderr
ends = [float(l.split("silence_start: ")[1]) for l in out.splitlines() if "silence_start" in l]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], capture_output=True, text=True).stdout)
speech_end = ends[-1] if ends and ends[-1] > dur - 1.5 else dur
new_a = round(d["starts"]["L03"] + speech_end + 0.45 - 0.33, 3)  # L03A's "We" sits 0.33 s into its file
delta = round(new_a - d["starts"]["L03A"], 3)
d["head"] = "L03J"; d["starts"]["L03A"] = new_a
for k in ["L04", "L05", "L06", "L07", "L08", "L09"]: d["starts"][k] = round(d["starts"][k] + delta, 3)
d["total_seconds"] = round(d["total_seconds"] + delta, 3)
json.dump(d, open(p, "w"), indent=2)
print("speech_end", speech_end, "L03A", new_a, "delta", delta, "total", d["total_seconds"])
