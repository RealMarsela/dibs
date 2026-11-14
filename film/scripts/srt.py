#!/usr/bin/env python3
"""Write an .srt caption file from src/timeline.generated.ts (one cue per sentence chunk, max ~42 chars a line)."""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "src/timeline.generated.ts")).read()
W = json.loads(re.search(r"WORDS: Word\[\] = (\[.*\]);", src).group(1))
fps = 30
def ts(f):
    s = f / fps; h = int(s // 3600); m = int(s % 3600 // 60); sec = s % 60
    return f"{h:02d}:{m:02d}:{sec:06.3f}".replace(".", ",")
cues, cur = [], []
for w in W:
    cur.append(w)
    text = " ".join(x["w"] for x in cur)
    if w["w"][-1] in ".,;?" and len(text) > 28 or len(text) > 70 or w is W[-1] or W[W.index(w) + 1]["line"] != w["line"]:
        cues.append((cur[0]["f0"], cur[-1]["f1"] + 6, text)); cur = []
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out/dibs-film.srt")
cues = [(a, min(b, cues[i + 1][0] - 1) if i + 1 < len(cues) else b, t) for i, (a, b, t) in enumerate(cues)]
with open(out, "w") as fh:
    for i, (a, b, t) in enumerate(cues, 1):
        fh.write(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n\n")
print(out, len(cues), "cues")
